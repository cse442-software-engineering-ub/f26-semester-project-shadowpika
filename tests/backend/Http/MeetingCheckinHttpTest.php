<?php
namespace Karavan\Tests\Http;

use DateTimeImmutable;
use DateTimeZone;
use Karavan\Tests\Support\CheckinFixture;
use Karavan\Tests\Support\Fixtures;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

final class MeetingCheckinHttpTest extends TestCase
{
    private static $server;
    private static string $dir;
    private static string $url;
    private PDO $pdo;
    private array $ids;

    public static function setUpBeforeClass(): void
    {
        self::$dir = Fixtures::tempDir('karavan_checkin_http_');
        mkdir(self::$dir . '/sessions');
        $socket = stream_socket_server('tcp://127.0.0.1:0');
        $address = stream_socket_get_name($socket, false);
        fclose($socket);
        self::$url = 'http://' . $address;
        $root = dirname(__DIR__, 3) . '/deploy';
        $command = [PHP_BINARY, '-d', 'session.save_path=' . self::$dir . '/sessions', '-S', $address, '-t', $root];
        self::$server = proc_open($command, [1 => ['file', self::$dir . '/server.log', 'a'], 2 => ['file', self::$dir . '/server.log', 'a']], $pipes, $root,
            array_merge(getenv(), ['KARAVAN_DB_DSN' => 'sqlite:' . self::$dir . '/test.sqlite']));
        for ($i = 0; $i < 50; $i++) {
            $probe = @fsockopen('127.0.0.1', (int) substr(strrchr($address, ':'), 1));
            if ($probe) { fclose($probe); return; }
            usleep(100000);
        }
        self::fail('Test HTTP server failed to start.');
    }

    public static function tearDownAfterClass(): void
    {
        if (is_resource(self::$server)) { proc_terminate(self::$server); proc_close(self::$server); }
        Fixtures::removeDir(self::$dir);
    }

    protected function setUp(): void
    {
        @unlink(self::$dir . '/test.sqlite');
        $this->pdo = TestDatabase::create('sqlite:' . self::$dir . '/test.sqlite');
        $now = new DateTimeImmutable('now', new DateTimeZone('America/New_York'));
        $this->ids = CheckinFixture::create($this->pdo, $now->format('Y-m-d'), $now->format('H:i:00'));
    }

    private function request(string $method, string $path, ?array $body = null, ?int $user = null): array
    {
        $curl = curl_init(self::$url . (str_starts_with($path, '/') ? $path : '/api/' . $path));
        $headers = ['Content-Type: application/json'];
        if ($user !== null) {
            $session = bin2hex(random_bytes(16));
            file_put_contents(self::$dir . '/sessions/sess_' . $session, "user_id|i:$user;");
            $headers[] = 'Cookie: PHPSESSID=' . $session;
        }
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 10]);
        if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body));
        $raw = curl_exec($curl);
        $this->assertIsString($raw);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $this->assertStringContainsString('application/json', curl_getinfo($curl, CURLINFO_CONTENT_TYPE));
        return [$status, json_decode($raw, true)];
    }

    private function body(): array
    {
        return ['request_id' => $this->ids['request'], 'latitude' => 43, 'longitude' => -78.78,
            'accuracy_m' => 20, 'captured_at' => round(microtime(true) * 1000)];
    }

    public function testMethodsLoginAndOwnershipAreEnforcedByEndpoints(): void
    {
        $this->assertSame(405, $this->request('POST', 'get_meeting_checkin.php')[0]);
        $this->assertSame(405, $this->request('GET', 'check_in_meeting.php')[0]);
        $this->assertSame(401, $this->request('GET', 'get_meeting_checkin.php?request_id=1')[0]);
        $this->assertSame(401, $this->request('POST', 'check_in_meeting.php', $this->body())[0]);
        $outsider = TestDatabase::addUser($this->pdo, 'http-unrelated');
        $this->assertSame(404, $this->request('GET', 'get_meeting_checkin.php?request_id=1', null, $outsider)[0]);
        $this->assertSame(404, $this->request('POST', 'check_in_meeting.php', $this->body(), $outsider)[0]);
        $this->assertSame(400, $this->request('GET', 'get_meeting_checkin.php?request_id[]=1', null, $this->ids['buyer'])[0]);
        $this->assertSame(400, $this->request('POST', 'check_in_meeting.php', [], $this->ids['buyer'])[0]);
    }

    public function testSuccessPersistsAndReplayReturnsTheSameTimestamp(): void
    {
        $buyer = $this->ids['buyer'];
        $before = $this->request('GET', 'get_meeting_checkin.php?request_id=1', null, $buyer);
        $this->assertSame('open', $before[1]['meeting']['checkin_state']);
        $bad = $this->body();
        $bad['latitude'] = 42;
        $this->assertSame(422, $this->request('POST', 'check_in_meeting.php', $bad, $buyer)[0]);
        $good = $this->request('POST', 'check_in_meeting.php', $this->body(), $buyer);
        $this->assertSame(200, $good[0]);
        $this->assertSame($good, $this->request('POST', 'check_in_meeting.php', ['request_id' => 1], $buyer));
        $after = $this->request('GET', 'get_meeting_checkin.php?request_id=1', null, $buyer);
        $this->assertSame('checked_in', $after[1]['meeting']['checkin_state']);
        $this->assertSame($good[1]['checked_in_at'], $after[1]['meeting']['checked_in_at']);
        $this->assertNotNull($this->pdo->query('SELECT checked_in_at FROM meeting_requests')->fetchColumn());
        $list = $this->request('GET', 'get_my_meeting_requests.php', null, $buyer);
        $this->assertSame(1, $list[1]['requests'][0]['request_id']);
    }

    public function testSellerFirstAndBuyerSecondUnlockOnlyASellerRequestedSale(): void
    {
        $seller = $this->ids['seller'];
        $buyer = $this->ids['buyer'];
        $sold = ['action' => 'update_status', 'listing_id' => $this->ids['listing'], 'status' => 'sold'];
        $endpoint = '/listing/api/update_listing.php';
        $this->assertSame(401, $this->request('POST', $endpoint, $sold)[0]);
        $blocked = $this->request('POST', $endpoint, $sold, $seller);
        $this->assertSame(409, $blocked[0]);
        $this->assertSame('checkins_required', $blocked[1]['code']);
        $one = $this->request('POST', 'check_in_meeting.php', $this->body(), $seller);
        $this->assertSame(200, $one[0]);
        $this->assertSame('seller', $one[1]['participant_role']);
        $this->assertNull($one[1]['buyer_checked_in_at']);
        $this->assertFalse($one[1]['both_checked_in']);
        $this->assertSame(409, $this->request('POST', $endpoint, $sold, $seller)[0]);
        $two = $this->request('POST', 'check_in_meeting.php', $this->body(), $buyer);
        $this->assertSame(200, $two[0]);
        $this->assertTrue($two[1]['both_checked_in']);
        $this->assertSame('active', $this->pdo->query('SELECT status FROM listings')->fetchColumn());
        $eligible = $this->request('GET', '/listing/api/get_my_listings.php', null, $seller);
        $this->assertSame(200, $eligible[0]);
        $this->assertTrue($eligible[1]['results'][0]['can_mark_sold']);
        $this->assertSame($this->ids['request'], $eligible[1]['results'][0]['sale_request_id']);
        $this->assertSame(404, $this->request('POST', $endpoint, $sold, $buyer)[0]);
        $before = $this->pdo->query('SELECT * FROM meeting_requests')->fetch();
        $this->assertSame(200, $this->request('POST', $endpoint, $sold, $seller)[0]);
        $this->assertSame('sold', $this->pdo->query('SELECT status FROM listings')->fetchColumn());
        $this->assertSame($before, $this->pdo->query('SELECT * FROM meeting_requests')->fetch());
        $progress = $this->request('GET', 'get_incoming_meeting_requests.php', null, $seller)[1]['requests'][0];
        $this->assertTrue($progress['both_checked_in']);
        $this->assertSame('sold', $progress['listing_status']);
        $this->assertFalse($progress['can_mark_sold']);
        $this->assertSame($one[1]['checked_in_at'],
            $this->request('POST', 'check_in_meeting.php', ['request_id' => $this->ids['request']], $seller)[1]['checked_in_at']);
    }

    public function testBothAccountsReceiveProgressAndApprovedLocationCannotBeChanged(): void
    {
        $seller = $this->ids['seller'];
        $buyer = $this->ids['buyer'];
        $requestId = $this->ids['request'];
        $before = $this->request('GET', 'get_incoming_meeting_requests.php', null, $seller);
        $this->assertSame(200, $before[0]);
        $this->assertNull($before[1]['requests'][0]['checked_in_at']);
        $good = $this->request('POST', 'check_in_meeting.php', $this->body(), $buyer);
        $this->assertSame(200, $good[0]);
        foreach ([['get_my_meeting_requests.php', $buyer], ['get_incoming_meeting_requests.php', $seller]] as [$endpoint, $user]) {
            $result = $this->request('GET', $endpoint, null, $user);
            $this->assertSame(200, $result[0]);
            $this->assertSame($good[1]['checked_in_at'], $result[1]['requests'][0]['checked_in_at']);
            $this->assertSame('approved', $result[1]['requests'][0]['status']);
        }
        $original = $this->pdo->query('SELECT * FROM meeting_requests')->fetch();
        $newLocation = TestDatabase::addLocation($this->pdo, 42, -78, 'Other meeting spot');
        $change = $this->request('POST', 'respond_meeting_request.php',
            ['request_id' => $requestId, 'action' => 'change_location', 'location_id' => $newLocation], $seller);
        $this->assertSame(409, $change[0]);
        $this->assertSame('The meeting location is locked after approval.', $change[1]['error']);
        $this->assertSame($original, $this->pdo->query('SELECT * FROM meeting_requests')->fetch());
        $outsider = TestDatabase::addUser($this->pdo, 'http-outsider');
        $this->assertSame([], $this->request('GET', 'get_incoming_meeting_requests.php', null, $outsider)[1]['requests']);
        $this->assertSame(401, $this->request('GET', 'get_incoming_meeting_requests.php')[0]);
    }
}
