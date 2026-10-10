<?php
namespace Karavan\Tests\Http;

use Karavan\Tests\Support\Fixtures;
use PDO;
use PHPUnit\Framework\TestCase;

// Backend task card #152 (View Item Details): boots `php -S` against api/get_item_details.php,
// backed by a throwaway SQLite copy of the search seed books.
final class ItemDetailsHttpTest extends TestCase
{
    private const ENDPOINT = '/api/get_item_details.php';
    private const INVALID_ID = ['success' => false, 'error' => 'A valid listing_id is required.'];

    private static $server;
    private static string $baseUrl;
    private static string $workDir;
    private static string $dbFile;

    public static function setUpBeforeClass(): void
    {
        self::$workDir = Fixtures::tempDir('karavan_item_');
        self::$dbFile = self::$workDir . '/test.sqlite';

        $port = self::freePort();
        self::$baseUrl = "http://127.0.0.1:$port";
        $docRoot = dirname(__DIR__, 3) . '/deploy';

        $command = [PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $docRoot];
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
        $pdo = new PDO('sqlite:' . self::$dbFile);
        $pdo->exec(
            "CREATE TABLE listings (
                listing_id  INTEGER PRIMARY KEY,
                name        TEXT NOT NULL,
                price       NUMERIC NOT NULL,
                `condition` TEXT NOT NULL,
                image_url   TEXT,
                category    TEXT NOT NULL DEFAULT 'Other',
                description TEXT,
                status      TEXT NOT NULL DEFAULT 'active'
            )"
        );
        // 91001 keeps the legacy "Books" label some shared databases still have.
        $pdo->exec(
            "INSERT INTO listings (listing_id, name, price, `condition`, image_url, category, description, status) VALUES
                (91001, 'Calculus Textbook', 35.00, 'Good',     'uploads/calculus-textbook.jpg', 'Books',     NULL, 'active'),
                (91002, 'Calculus Workbook', 20.00, 'Like New', 'uploads/calculus-workbook.jpg', 'Textbooks', NULL, 'active'),
                (91004, 'Calculus Notes',     5.00, 'Fair',     'uploads/calculus-notes.jpg',    'Textbooks', NULL, 'sold')"
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
    private function request(string $method, string $query): array
    {
        $context = stream_context_create(['http' => ['method' => $method, 'ignore_errors' => true]]);
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
            'description' => 'Used for one semester. No writing or highlighting.',
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
            'description' => null,
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
}
