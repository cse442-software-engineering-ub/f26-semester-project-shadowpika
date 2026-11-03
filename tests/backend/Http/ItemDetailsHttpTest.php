<?php
namespace Karavan\Tests\Http;

use Karavan\Tests\Support\Fixtures;
use Karavan\Tests\Support\TestDatabase;
use PHPUnit\Framework\TestCase;

// Backend task card #152 (View Item Details): boots `php -S` against api/get_item_details.php,
// backed by a throwaway SQLite copy of the search seed books. Requests are made as a logged-in
// student, who is automatically in All of UB (the seed books' community).
final class ItemDetailsHttpTest extends TestCase
{
    private const ENDPOINT = '/api/get_item_details.php';
    private const INVALID_ID = ['success' => false, 'error' => 'A valid listing_id is required.'];

    private static $server;
    private static string $baseUrl;
    private static string $workDir;
    private static string $dbFile;
    private static string $sessionDir;
    private string $sessionId;

    public static function setUpBeforeClass(): void
    {
        self::$workDir = Fixtures::tempDir('karavan_item_');
        self::$dbFile = self::$workDir . '/test.sqlite';
        self::$sessionDir = self::$workDir . '/sessions';
        mkdir(self::$sessionDir);

        $port = self::freePort();
        self::$baseUrl = "http://127.0.0.1:$port";
        $docRoot = dirname(__DIR__, 3) . '/deploy';

        $command = [PHP_BINARY, '-d', 'session.save_path=' . self::$sessionDir, '-S', "127.0.0.1:$port", '-t', $docRoot];
        $env = array_merge(getenv(), ['KARAVAN_DB_DSN' => 'sqlite:' . self::$dbFile]);
        $null = PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null';

        self::$server = proc_open($command, [1 => ['file', $null, 'w'], 2 => ['file', $null, 'w']], $pipes, $docRoot, $env);

        for ($i = 0; $i < 50; $i++) {
            if (@fsockopen('127.0.0.1', $port)) {
                return;
            }
            usleep(100_000);
        }
        self::fail('PHP built-in server did not start.');
    }

    public static function tearDownAfterClass(): void
    {
        if (is_resource(self::$server)) {
            proc_terminate(self::$server);
            proc_close(self::$server);
        }
        Fixtures::removeDir(self::$workDir);
    }

    protected function setUp(): void
    {
        @unlink(self::$dbFile);
        $pdo = TestDatabase::create('sqlite:' . self::$dbFile);
        $userId = TestDatabase::addUser($pdo, 'item.viewer@test.com');
        $this->sessionId = bin2hex(random_bytes(16));
        file_put_contents(self::$sessionDir . "/sess_{$this->sessionId}", "user_id|i:$userId;");
        // 91001 keeps the legacy "Books" label some shared databases still have.
        $pdo->exec(
            "INSERT INTO listings (listing_id, name, price, `condition`, image_url, category, community, description, status) VALUES
                (91001, 'Calculus Textbook', 35.00, 'Good',     'uploads/calculus-textbook.jpg', 'Books',     'All of UB', NULL, 'active'),
                (91002, 'Calculus Workbook', 20.00, 'Like New', 'uploads/calculus-workbook.jpg', 'Textbooks', 'All of UB', NULL, 'active'),
                (91004, 'Calculus Notes',     5.00, 'Fair',     'uploads/calculus-notes.jpg',    'Textbooks', 'All of UB', NULL, 'sold')"
        );
        // Same statement as database/migrations/item_details.sql
        $pdo->exec("UPDATE listings SET description = 'Used for one semester. No writing or highlighting.' WHERE listing_id = 91001");
    }

    private static function freePort(): int
    {
        $socket = stream_socket_server('tcp://127.0.0.1:0');
        $name = stream_socket_get_name($socket, false);
        fclose($socket);
        return (int) substr($name, strrpos($name, ':') + 1);
    }

    /** @return array{0: int, 1: string} status code and raw body */
    private function request(string $method, string $query, bool $authenticated = true): array
    {
        $context = stream_context_create(['http' => [
            'method' => $method,
            'ignore_errors' => true,
            'header' => $authenticated ? "Cookie: PHPSESSID={$this->sessionId}" : '',
        ]]);
        $body = file_get_contents(self::$baseUrl . self::ENDPOINT . $query, false, $context);
        preg_match('{HTTP/\S+ (\d{3})}', $http_response_header[0], $match);
        return [(int) $match[1], $body];
    }

    private function assertResponse(int $status, array $expected, string $query, string $method = 'GET'): void
    {
        [$actualStatus, $body] = $this->request($method, $query);
        $this->assertSame($status, $actualStatus, $body);
        $this->assertSame(json_encode($expected, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $body);
    }

    public function testReturnsAnItemsCompleteDetails(): void
    {
        $this->assertResponse(200, ['success' => true, 'listing' => [
            'listing_id'  => 91001,
            'name'        => 'Calculus Textbook',
            'price'       => '35.00',
            'condition'   => 'Good',
            'image_url'   => 'uploads/calculus-textbook.jpg',
            'category'    => 'Textbooks',
            'community'   => 'All of UB',
            'description' => 'Used for one semester. No writing or highlighting.',
            'meeting_location' => null,
            'meeting_location_id' => null,
            'meeting_location_details' => null,
        ]], '?listing_id=91001');
    }

    public function testReturnsNullForAListingWithNoDescription(): void
    {
        $this->assertResponse(200, ['success' => true, 'listing' => [
            'listing_id'  => 91002,
            'name'        => 'Calculus Workbook',
            'price'       => '20.00',
            'condition'   => 'Like New',
            'image_url'   => 'uploads/calculus-workbook.jpg',
            'category'    => 'Textbooks',
            'community'   => 'All of UB',
            'description' => null,
            'meeting_location' => null,
            'meeting_location_id' => null,
            'meeting_location_details' => null,
        ]], '?listing_id=91002');
    }

    public function testReportsMissingAndSoldListingsAsNotFound(): void
    {
        $notFound = ['success' => false, 'error' => 'Listing not found.'];
        $this->assertResponse(404, $notFound, '?listing_id=99999');
        $this->assertResponse(404, $notFound, '?listing_id=91004');
    }

    public function testRejectsAMissingOrInvalidListingId(): void
    {
        $this->assertResponse(400, self::INVALID_ID, '');
        $this->assertResponse(400, self::INVALID_ID, '?listing_id=0');
        $this->assertResponse(400, self::INVALID_ID, '?listing_id=abc');
        $this->assertResponse(400, self::INVALID_ID, '?listing_id=' . rawurlencode('91001 OR 1=1'));
        $this->assertResponse(400, self::INVALID_ID, '?listing_id[]=91001');
    }

    public function testRejectsMethodsOtherThanGet(): void
    {
        $this->assertResponse(405, ['success' => false, 'error' => 'Method not allowed.'], '?listing_id=91001', 'POST');
    }

    public function testReturnsTheSelectedLocationsNumericCoordinatesAndNotAnotherSameNamedSpot(): void
    {
        $pdo = $this->pdo();
        $id = TestDatabase::addLocation($pdo, 43.000822, -78.789203, 'Capen Hall', null, 'All of UB');
        TestDatabase::addLocation($pdo, 42, -77, 'Capen Hall', null, 'Elsewhere');
        $pdo->exec("UPDATE listings SET meeting_location_id = $id, meeting_location = 'Capen Hall' WHERE listing_id = 91001");
        [$status, $body] = $this->request('GET', '?listing_id=91001');
        $this->assertSame(200, $status, $body);
        $listing = json_decode($body, true, 512, JSON_THROW_ON_ERROR)['listing'];
        $this->assertSame($id, $listing['meeting_location_id']);
        $this->assertSame('Capen Hall', $listing['meeting_location']);
        $this->assertSame([
            'location_id' => $id, 'label' => 'Capen Hall', 'lat' => 43.000822, 'lng' => -78.789203,
        ], $listing['meeting_location_details']);
        $pdo->exec("UPDATE approved_locations SET label = 'Renamed Entrance', lat = 0, lng = 0 WHERE id = $id");
        [, $body] = $this->request('GET', '?listing_id=91001');
        $details = json_decode($body, true)['listing']['meeting_location_details'];
        $this->assertSame('Renamed Entrance', $details['label']);
        $this->assertSame(0, $details['lat']);
        $this->assertSame(0, $details['lng']);
    }

    public function testUnusableLocationsKeepLegacyTextWithoutAMap(): void
    {
        $pdo = $this->pdo();
        $id = TestDatabase::addLocation($pdo, 43, -78, 'Capen Hall', null, 'All of UB');
        $pdo->exec("UPDATE listings SET meeting_location_id = $id, meeting_location = 'Legacy label' WHERE listing_id = 91001");
        foreach (["community = 'Elsewhere'", "community = 'All of UB', lat = 91", "lat = 'bad'", "lat = 43, lng = 181"] as $change) {
            $pdo->exec("UPDATE approved_locations SET $change WHERE id = $id");
            [$status, $body] = $this->request('GET', '?listing_id=91001');
            $this->assertSame(200, $status, $body);
            $listing = json_decode($body, true)['listing'];
            $this->assertSame('Legacy label', $listing['meeting_location']);
            $this->assertNull($listing['meeting_location_details']);
        }
        $pdo->exec("PRAGMA foreign_keys = ON");
        $pdo->exec("DELETE FROM approved_locations WHERE id = $id");
        [$status, $body] = $this->request('GET', '?listing_id=91001');
        $this->assertSame(200, $status, $body);
        $this->assertNull(json_decode($body, true)['listing']['meeting_location_details']);
        $this->assertNull(json_decode($body, true)['listing']['meeting_location_id']);
    }

    public function testLocationDataIsNotReturnedWithoutAuthenticationOrCommunityAccess(): void
    {
        $pdo = $this->pdo();
        $id = TestDatabase::addLocation($pdo, 43, -78, 'Private Office', null, 'Private Community');
        $pdo->exec("UPDATE listings SET community = 'Private Community', meeting_location_id = $id WHERE listing_id = 91001");
        [$status, $body] = $this->request('GET', '?listing_id=91001');
        $this->assertSame(403, $status, $body);
        $this->assertArrayNotHasKey('listing', json_decode($body, true));
        [$status, $body] = $this->request('GET', '?listing_id=91001', false);
        $this->assertSame(401, $status, $body);
        $this->assertArrayNotHasKey('listing', json_decode($body, true));
        // The listing owner remains entitled to view their own item.
        $pdo->exec('UPDATE listings SET owner_id = 1 WHERE listing_id = 91001');
        [$status, $body] = $this->request('GET', '?listing_id=91001');
        $this->assertSame(200, $status, $body);
        $this->assertSame($id, json_decode($body, true)['listing']['meeting_location_details']['location_id']);
    }

    private function pdo(): \PDO
    {
        return new \PDO('sqlite:' . self::$dbFile, null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
    }
}
