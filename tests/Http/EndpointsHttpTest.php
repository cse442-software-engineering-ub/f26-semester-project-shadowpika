<?php
namespace Karavan\Tests\Http;

use CURLFile;
use Karavan\Tests\Support\Fixtures;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

// Boots `php -S` against the real endpoint files, backed by a throwaway SQLite database.
final class EndpointsHttpTest extends TestCase
{
    private static $server;
    private static string $baseUrl;
    private static string $workDir;
    private static string $dbFile;
    private static string $uploadDir;
    private static string $sessionDir;

    private PDO $pdo;

    public static function setUpBeforeClass(): void
    {
        self::$workDir = Fixtures::tempDir('karavan_http_');
        self::$dbFile = self::$workDir . '/test.sqlite';
        self::$uploadDir = self::$workDir . '/uploads';
        self::$sessionDir = self::$workDir . '/sessions';
        mkdir(self::$sessionDir);

        $port = self::freePort();
        self::$baseUrl = "http://127.0.0.1:$port";
        $docRoot = dirname(__DIR__, 2);

        $command = [
            PHP_BINARY,
            '-d', 'session.save_path=' . self::$sessionDir,
            '-d', 'upload_max_filesize=11M',
            '-d', 'post_max_size=12M',
            '-S', "127.0.0.1:$port",
            '-t', $docRoot,
        ];
        $env = array_merge(getenv(), [
            'KARAVAN_DB_DSN'     => 'sqlite:' . self::$dbFile,
            'KARAVAN_UPLOAD_DIR' => self::$uploadDir,
        ]);

        self::$server = proc_open($command, [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, $docRoot, $env);

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
        Fixtures::removeDir(self::$uploadDir);
        $this->pdo = TestDatabase::create('sqlite:' . self::$dbFile);
    }

    private static function freePort(): int
    {
        $socket = stream_socket_server('tcp://127.0.0.1:0');
        $name = stream_socket_get_name($socket, false);
        fclose($socket);
        return (int) substr($name, strrpos($name, ':') + 1);
    }

    private function request(string $method, string $path, $body = null, ?string $sessionId = null, array $headers = []): array
    {
        $ch = curl_init(self::$baseUrl . '/' . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        if ($sessionId !== null) {
            curl_setopt($ch, CURLOPT_COOKIE, "PHPSESSID=$sessionId");
        }
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        return [$status, json_decode($raw, true), $raw, $contentType];
    }

    private function form(array $overrides = [], ?CURLFile $file = null): array
    {
        $fields = array_merge([
            'full_name'     => 'Alex Landlord',
            'business_name' => 'Landlord Properties LLC',
            'email'         => 'alex.landlord@test.com',
            'phone'         => '123-456-7890',
            'password'      => 'Landlord123!',
        ], $overrides);
        if ($file !== null) {
            $fields['proof_of_ownership'] = $file;
        }
        return $fields;
    }

    private function fileOf(string $name, string $contents): CURLFile
    {
        $path = self::$workDir . '/' . bin2hex(random_bytes(4)) . '-' . $name;
        file_put_contents($path, $contents);
        return new CURLFile($path, 'application/octet-stream', $name);
    }

    private function requestCount(): int
    {
        return (int) $this->pdo->query('SELECT COUNT(*) FROM admin_requests')->fetchColumn();
    }

    private function storedFiles(): array
    {
        return is_dir(self::$uploadDir) ? array_values(array_diff(scandir(self::$uploadDir), ['.', '..'])) : [];
    }

    /** @return string|false false when the user has no account */
    private function roleOf(string $username): string|false
    {
        $stmt = $this->pdo->prepare('SELECT role FROM users WHERE username = ?');
        $stmt->execute([$username]);
        return $stmt->fetchColumn();
    }

    // Admin register backend, Test 1
    public function testRegisterWithValidDataCreatesPendingRequest5001(): void
    {
        [$status, $json] = $this->request('POST', 'admin_register.php', $this->form([], $this->fileOf('lease.pdf', Fixtures::pdfBytes())));

        $this->assertSame(201, $status);
        $this->assertSame(['success' => true, 'request_id' => 5001, 'status' => 'pending'], $json);

        $row = $this->pdo->query('SELECT * FROM admin_requests WHERE id = 5001')->fetch();
        $this->assertSame('pending', $row['status']);
        $this->assertSame('Landlord Properties LLC', $row['business_name']);
        $this->assertFileExists(self::$uploadDir . '/' . $row['proof_file_name']);
        $this->assertStringStartsNotWith(dirname(__DIR__, 2), realpath(self::$uploadDir));

        $hash = $row['password_hash'];
        $this->assertNotSame('Landlord123!', $hash);
        $this->assertSame(PASSWORD_BCRYPT, password_get_info($hash)['algo']);
        $this->assertTrue(password_verify('Landlord123!', $hash));

        $this->assertFalse($this->roleOf('alex.landlord@test.com'), 'No users row until a moderator approves.');
    }

    public function testBusinessNameWithApostropheIsStoredSafely(): void
    {
        $name = "Bob's \"Best\" Rentals'); DROP TABLE users; --";
        [$status] = $this->request('POST', 'admin_register.php', $this->form(['business_name' => $name], $this->fileOf('lease.pdf', Fixtures::pdfBytes())));

        $this->assertSame(201, $status);
        $this->assertSame($name, $this->pdo->query('SELECT business_name FROM admin_requests WHERE id = 5001')->fetchColumn());
    }

    // Admin register backend, Test 2
    public function testRegisterWithoutFileReturns400(): void
    {
        [$status, $json] = $this->request('POST', 'admin_register.php', $this->form());

        $this->assertSame(400, $status);
        $this->assertSame(['success' => false, 'error' => 'Proof of ownership is required.'], $json);
        $this->assertSame(0, $this->requestCount());
    }

    // Admin register backend, Test 3
    public function testRegisterWithExeReturns400AndWritesNoFile(): void
    {
        [$status, $json] = $this->request('POST', 'admin_register.php', $this->form([], $this->fileOf('setup.exe', "MZ\x90\x00\x03\x00\x00\x00binary")));

        $this->assertSame(400, $status);
        $this->assertSame(['success' => false, 'error' => 'Invalid file type. Accepted formats: PDF, JPG, PNG.'], $json);
        $this->assertSame([], $this->storedFiles());
        $this->assertSame(0, $this->requestCount());
    }
}
