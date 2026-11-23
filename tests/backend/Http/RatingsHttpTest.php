<?php
namespace Karavan\Tests\Http;

use Karavan\Tests\Support\Fixtures;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

// Cards #132/#133 against the assembled release: boots `php -S` on deploy/ so the
// api/ paths and includes are the ones the server runs, backed by a throwaway SQLite database.
final class RatingsHttpTest extends TestCase
{
    private static $server;
    private static string $baseUrl;
    private static string $workDir;
    private static string $dbFile;
    private static string $sessionDir;
    private PDO $pdo;
    private array $ids = [];
    private array $sessions = [];

    public static function setUpBeforeClass(): void
    {
        self::$workDir = Fixtures::tempDir('karavan_rating_');
        self::$dbFile = self::$workDir . '/test.sqlite';
        self::$sessionDir = self::$workDir . '/sessions';
        mkdir(self::$sessionDir);

        $socket = stream_socket_server('tcp://127.0.0.1:0');
        $name = stream_socket_get_name($socket, false);
        fclose($socket);
        $port = (int) substr($name, strrpos($name, ':') + 1);
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
        $this->pdo = TestDatabase::create('sqlite:' . self::$dbFile);
        foreach (['seller' => 'morgan.keller1', 'buyer' => 'taylor.shopper'] as $role => $username) {
            $this->ids[$role] = TestDatabase::addUser($this->pdo, $username);
            $this->sessions[$role] = bin2hex(random_bytes(16));
            file_put_contents(self::$sessionDir . "/sess_{$this->sessions[$role]}", "user_id|i:{$this->ids[$role]};");
        }
        $this->ids['listing'] = TestDatabase::addListing($this->pdo, $this->ids['seller'], ['name' => 'Desk Lamp']);
    }

    /** @return array{0: int, 1: array} */
    private function call(string $method, string $path, ?string $as, ?array $body = null): array
    {
        $headers = $as === null ? [] : ["Cookie: PHPSESSID={$this->sessions[$as]}"];
        if ($body !== null) $headers[] = 'Content-Type: application/json';
        $context = stream_context_create(['http' => [
            'method' => $method, 'ignore_errors' => true, 'header' => implode("\r\n", $headers),
            'content' => $body === null ? '' : json_encode($body),
        ]]);
        $raw = file_get_contents(self::$baseUrl . $path, false, $context);
        preg_match('{HTTP/\S+ (\d{3})}', $http_response_header[0], $match);
        return [(int) $match[1], json_decode($raw, true) ?? ['raw' => $raw]];
    }

    public function testEndpointRequiresLoginAndRejectsOtherMethods(): void
    {
        $this->assertSame(401, $this->call('POST', '/api/ratings.php', null, ['seller_id' => 1, 'rating' => 5])[0]);
        $this->assertSame(405, $this->call('PUT', '/api/ratings.php', 'buyer')[0]);
    }

    public function testRatingAfterPurchaseShowsOnTheSellersListing(): void
    {
        [$status, $body] = $this->call('POST', '/api/ratings.php', 'buyer', ['seller_id' => $this->ids['seller'], 'rating' => 5]);
        $this->assertSame(403, $status);
        $this->assertSame('You can only rate a seller after completing a purchase with them.', $body['error']);

        TestDatabase::addMeeting($this->pdo, $this->ids['buyer'], $this->ids['listing'],
            ['checked_in_at' => '2026-11-02 17:00:00', 'seller_checked_in_at' => '2026-11-02 17:01:00']);
        [$status, $body] = $this->call('POST', '/api/ratings.php', 'buyer',
            ['seller_id' => $this->ids['seller'], 'rating' => 4, 'review' => 'Friendly']);
        $this->assertSame(200, $status, json_encode($body));
        $this->assertSame('Rating saved successfully.', $body['message']);

        [$status, $body] = $this->call('GET', "/api/ratings.php?seller_id={$this->ids['seller']}", 'buyer');
        $this->assertSame(200, $status);
        $this->assertSame(4.0, (float) $body['averageRating']);
        $this->assertSame('Friendly', $body['ratings'][0]['review']);

        [$status, $body] = $this->call('GET', "/api/get_item_details.php?listing_id={$this->ids['listing']}", 'buyer');
        $this->assertSame(200, $status);
        $this->assertEquals(['id' => $this->ids['seller'], 'username' => 'morgan.keller1', 'average_rating' => 4, 'rating_count' => 1],
            $body['listing']['seller']);
    }
}
