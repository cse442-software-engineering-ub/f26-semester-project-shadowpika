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
    private const FORBIDDEN = ['success' => false, 'error' => 'You do not have permission to perform this action.'];

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
            '-d', 'upload_max_filesize=2M',
            '-d', 'post_max_size=8M',
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

    /** Writes a PHP session file directly so requests can act as a logged-in user. */
    private function sessionFor(int $userId): string
    {
        $sessionId = bin2hex(random_bytes(16));
        file_put_contents(self::$sessionDir . "/sess_$sessionId", "user_id|i:$userId;");
        return $sessionId;
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

    private function statusOf(int $requestId): string
    {
        return $this->pdo->query("SELECT status FROM admin_requests WHERE id = $requestId")->fetchColumn();
    }

    /** @return string|false false when the user has no account */
    private function roleOf(string $username): string|false
    {
        $stmt = $this->pdo->prepare('SELECT role FROM users WHERE username = ?');
        $stmt->execute([$username]);
        return $stmt->fetchColumn();
    }

    /** Registers Alex Landlord (request 5001) and a second applicant (request 5002), like the task cards assume. */
    private function seedTwoPendingRequests(): void
    {
        $this->request('POST', 'admin_register.php', $this->form([], $this->fileOf('lease.pdf', Fixtures::pdfBytes())));
        $this->request('POST', 'admin_register.php', $this->form(
            ['full_name' => 'Dana Denied', 'business_name' => "Dana's Duplexes", 'email' => 'dana@test.com'],
            $this->fileOf('deed.png', Fixtures::pngBytes())
        ));
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

    public function testFileOverAptitudesTwoMegabyteLimitReturns400(): void
    {
        $tooLarge = Fixtures::pdfBytes() . str_repeat('0', (int) (2.5 * 1024 * 1024));
        [$status, $json] = $this->request('POST', 'admin_register.php', $this->form([], $this->fileOf('big.pdf', $tooLarge)));

        $this->assertSame(400, $status);
        $this->assertSame(['success' => false, 'error' => 'File is too large. Maximum size is 2MB.'], $json);
        $this->assertSame(0, $this->requestCount());
    }

    public function testEmptyFileReturns400(): void
    {
        [$status, $json] = $this->request('POST', 'admin_register.php', $this->form([], $this->fileOf('empty.pdf', '')));

        $this->assertSame(400, $status);
        $this->assertSame(['success' => false, 'error' => 'The file is empty. Please choose a different file.'], $json);
        $this->assertSame(0, $this->requestCount());
    }

    // Mod approval backend, Test 1
    public function testModeratorListReturnsOnlyPendingRequests(): void
    {
        $modSession = $this->sessionFor(TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator'));
        $this->seedTwoPendingRequests();
        $approvedId = TestDatabase::addRequest($this->pdo, ['status' => 'approved']);

        [$status, $json] = $this->request('GET', 'moderator_requests.php', null, $modSession);

        $this->assertSame(200, $status);
        $byId = array_column($json['requests'], null, 'request_id');
        $this->assertArrayHasKey(5001, $byId);
        $this->assertSame('pending', $byId[5001]['status']);
        $this->assertSame('Alex Landlord', $byId[5001]['full_name']);
        $this->assertSame('Landlord Properties LLC', $byId[5001]['business_name']);
        $this->assertArrayHasKey('proof_of_ownership_url', $byId[5001]);
        $this->assertArrayNotHasKey($approvedId, $byId);
    }

    // Mod approval backend, Test 2
    public function testApprove5001CreatesAdminUserRecord(): void
    {
        $modSession = $this->sessionFor(TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator'));
        $this->seedTwoPendingRequests();

        [$status, $json] = $this->request('POST', 'moderator_approve.php', '{"request_id":5001,"action":"approve"}', $modSession, ['Content-Type: application/json']);

        $this->assertSame(200, $status);
        $this->assertSame('{"success":true,"request_id":5001,"status":"approved"}', json_encode($json));
        $user = $this->pdo->query("SELECT * FROM users WHERE username = 'alex.landlord@test.com'")->fetch();
        $this->assertSame('admin', $user['role']);
        $this->assertTrue(password_verify('Landlord123!', $user['password_hash']));
    }

    // Mod approval backend, Test 3
    public function testDeny5002DeletesRequestAndCreatesNoAccount(): void
    {
        $modSession = $this->sessionFor(TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator'));
        $this->seedTwoPendingRequests();
        $storedFile = $this->pdo->query('SELECT proof_file_name FROM admin_requests WHERE id = 5002')->fetchColumn();

        [$status, $json] = $this->request('POST', 'moderator_approve.php', '{"request_id":5002,"action":"deny"}', $modSession, ['Content-Type: application/json']);

        $this->assertSame(200, $status);
        $this->assertSame('{"success":true,"request_id":5002,"status":"denied"}', json_encode($json));
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM admin_requests WHERE id = 5002')->fetchColumn());
        $this->assertFalse($this->roleOf('dana@test.com'));
        $this->assertFileDoesNotExist(self::$uploadDir . '/' . $storedFile);
    }

    public static function nonModeratorRoles(): array
    {
        return ['regular user' => ['user'], 'approved partner admin' => ['admin']];
    }

    // Mod approval backend, Test 4
    #[\PHPUnit\Framework\Attributes\DataProvider('nonModeratorRoles')]
    public function testNonModeratorCannotApprove(string $role): void
    {
        $userSession = $this->sessionFor(TestDatabase::addUser($this->pdo, 'test@test.com', $role));
        $this->seedTwoPendingRequests();

        [$status, , $raw] = $this->request('POST', 'moderator_approve.php', '{"request_id":5001,"action":"approve"}', $userSession, ['Content-Type: application/json']);

        $this->assertSame(403, $status);
        $this->assertSame('{"success":false,"error":"You do not have permission to perform this action."}', $raw);
        $this->assertSame('pending', $this->statusOf(5001));
        $this->assertFalse($this->roleOf('alex.landlord@test.com'));
    }

    public function testModeratorEndpointsReturn403WhenNotLoggedIn(): void
    {
        [$listStatus, $listJson] = $this->request('GET', 'moderator_requests.php');
        [$approveStatus, $approveJson] = $this->request(
            'POST', 'moderator_approve.php', json_encode(['request_id' => 1, 'action' => 'approve']), null, ['Content-Type: application/json']
        );

        $this->assertSame(403, $listStatus);
        $this->assertSame(self::FORBIDDEN, $listJson);
        $this->assertSame(403, $approveStatus);
        $this->assertSame(self::FORBIDDEN, $approveJson);
    }

    public function testModeratorEndpointsReturn403ForRegularUser(): void
    {
        $userId = TestDatabase::addUser($this->pdo, 'regular@test.com', 'user');
        $session = $this->sessionFor($userId);

        [$listStatus, $listJson] = $this->request('GET', 'moderator_requests.php', null, $session);
        [$approveStatus] = $this->request('POST', 'moderator_approve.php', json_encode(['request_id' => 1, 'action' => 'approve']), $session);

        $this->assertSame(403, $listStatus);
        $this->assertSame(self::FORBIDDEN, $listJson);
        $this->assertSame(403, $approveStatus);
    }

    public function testFullRegisterListApproveFlow(): void
    {
        $modSession = $this->sessionFor(TestDatabase::addUser($this->pdo, 'karavan.mod', 'moderator'));
        [, $registered] = $this->request('POST', 'admin_register.php', $this->form([], $this->fileOf('deed.png', Fixtures::pngBytes())));
        $requestId = $registered['request_id'];

        [$listStatus, $list] = $this->request('GET', 'moderator_requests.php', null, $modSession);
        $this->assertSame(200, $listStatus);
        $this->assertCount(1, $list['requests']);
        $this->assertSame($requestId, $list['requests'][0]['request_id']);
        $this->assertSame('Alex Landlord', $list['requests'][0]['full_name']);
        $this->assertSame('Landlord Properties LLC', $list['requests'][0]['business_name']);

        [$fileStatus, , $fileBody, $fileType] = $this->request('GET', $list['requests'][0]['proof_of_ownership_url'], null, $modSession);
        $this->assertSame(200, $fileStatus);
        $this->assertSame('image/png', $fileType);
        $this->assertSame(Fixtures::pngBytes(), $fileBody);

        [$approveStatus, $approved] = $this->request(
            'POST', 'moderator_approve.php', json_encode(['request_id' => $requestId, 'action' => 'approve']), $modSession, ['Content-Type: application/json']
        );
        $this->assertSame(200, $approveStatus);
        $this->assertSame(['success' => true, 'request_id' => $requestId, 'status' => 'approved'], $approved);
        $this->assertSame('admin', $this->roleOf('alex.landlord@test.com'));

        [, $after] = $this->request('GET', 'moderator_requests.php', null, $modSession);
        $this->assertSame([], $after['requests']);
    }

    /** Logs in through the real login.php and returns [responseJson, sessionIdOrNull]. */
    private function login(string $email, string $password): array
    {
        $ch = curl_init(self::$baseUrl . '/login.php');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode(['email' => $email, 'password' => $password]),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        ]);
        $raw = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        preg_match_all('/^Set-Cookie:\s*PHPSESSID=([^;]+)/mi', substr($raw, 0, $headerSize), $cookies);
        return [json_decode(substr($raw, $headerSize), true), $cookies[1] ? end($cookies[1]) : null];
    }

    /**
     * Sends the given cookies and returns [status, json, cookies the response set].
     * @param array<string, string> $cookies
     * @return array{0: int, 1: ?array, 2: array<string, array{value: string, header: string}>}
     */
    private function withCookies(string $method, string $path, array $cookies, ?string $body = null): array
    {
        $ch = curl_init(self::$baseUrl . '/' . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        if ($cookies) {
            curl_setopt($ch, CURLOPT_COOKIE, implode('; ', array_map(fn ($k, $v) => "$k=$v", array_keys($cookies), $cookies)));
        }
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        preg_match_all('/^Set-Cookie:\s*([^=]+)=([^;\r\n]*)([^\r\n]*)/mi', substr($raw, 0, $headerSize), $matches, PREG_SET_ORDER);
        $set = [];
        foreach ($matches as [$header, $name, $value]) {
            $set[$name] = ['value' => urldecode($value), 'header' => $header];
        }
        return [$status, json_decode(substr($raw, $headerSize), true), $set];
    }

    /** Logs in and returns the cookies a browser would keep: the session and the remember-me token. */
    private function loginCookies(string $email, string $password): array
    {
        [, $json, $set] = $this->withCookies('POST', 'login.php', [], json_encode(['email' => $email, 'password' => $password]));
        $this->assertTrue($json['success']);
        return [$set['PHPSESSID']['value'], $set['karavan_remember']['value'], $set['karavan_remember']['header']];
    }

    private function tokenCount(): int
    {
        return (int) $this->pdo->query('SELECT COUNT(*) FROM auth_tokens')->fetchColumn();
    }

    // Persistent login backend, Test 1
    public function testLoginIssuesA30DayRememberMeCookieAndStoresOnlyItsHash(): void
    {
        $userId = TestDatabase::addUser($this->pdo, 'jamie.student', 'user', 'jamie.student@test.com');

        [, $remember, $header] = $this->loginCookies('jamie.student@test.com', 'Password123!');

        $this->assertMatchesRegularExpression('/^[a-f0-9]{24}:[a-f0-9]{64}$/', $remember);
        $this->assertStringContainsStringIgnoringCase('HttpOnly', $header);
        $this->assertStringContainsStringIgnoringCase('SameSite=Lax', $header);
        $this->assertMatchesRegularExpression('/Max-Age=(\d+)/', $header);
        preg_match('/Max-Age=(\d+)/', $header, $maxAge);
        $this->assertEqualsWithDelta(30 * 86400, (int) $maxAge[1], 5);

        [$selector, $validator] = explode(':', $remember);
        $row = $this->pdo->query('SELECT * FROM auth_tokens')->fetch();
        $this->assertSame($userId, (int) $row['user_id']);
        $this->assertSame($selector, $row['selector']);
        $this->assertSame(hash('sha256', $validator), $row['token_hash']);
        $this->assertStringNotContainsString($validator, implode('|', $row));
    }

    // Persistent login backend, Test 2
    public function testSessionReportsTheLoggedInUser(): void
    {
        $userId = TestDatabase::addUser($this->pdo, 'jamie.student', 'user', 'jamie.student@test.com');
        [$session] = $this->loginCookies('jamie.student@test.com', 'Password123!');

        [$status, $json] = $this->withCookies('GET', 'session.php', ['PHPSESSID' => $session]);

        $this->assertSame(200, $status);
        $this->assertSame([
            'success' => true, 'logged_in' => true, 'user_id' => $userId,
            'username' => 'jamie.student', 'email' => 'jamie.student@test.com', 'role' => 'user',
        ], $json);
    }

    // Persistent login backend, Test 3
    public function testSessionReturns401WhenNotLoggedIn(): void
    {
        [$status, $json] = $this->withCookies('GET', 'session.php', []);

        $this->assertSame(401, $status);
        $this->assertSame(['success' => false, 'logged_in' => false, 'error' => 'You are not logged in.'], $json);
    }

    // Persistent login backend, Test 4: the browser was closed, so only the remember-me cookie is left
    public function testRememberMeCookieRestoresTheLoginAfterTheSessionIsGone(): void
    {
        TestDatabase::addUser($this->pdo, 'alex.landlord@test.com', 'admin', 'alex.landlord@test.com');
        [, $remember] = $this->loginCookies('alex.landlord@test.com', 'Password123!');

        [$status, $json, $set] = $this->withCookies('GET', 'session.php', ['karavan_remember' => $remember]);

        $this->assertSame(200, $status);
        $this->assertTrue($json['logged_in']);
        $this->assertSame('admin', $json['role']);
        $this->assertArrayHasKey('PHPSESSID', $set, 'A fresh session is started.');
        $this->assertSame(1, $this->tokenCount());

        [$listStatus] = $this->request('GET', 'get_approved_locations.php', null, $set['PHPSESSID']['value']);
        $this->assertSame(200, $listStatus, 'Session-based endpoints work again once the login is restored.');

        [$againStatus] = $this->withCookies('GET', 'session.php', ['karavan_remember' => $remember]);
        $this->assertSame(200, $againStatus, 'The same cookie keeps working, e.g. for every tab a browser restores.');
    }

    // Persistent login backend, Test 5
    public function testTamperedRememberMeCookieIsRejectedAndCleared(): void
    {
        TestDatabase::addUser($this->pdo, 'jamie.student', 'user', 'jamie.student@test.com');
        [, $remember] = $this->loginCookies('jamie.student@test.com', 'Password123!');
        $tampered = substr($remember, 0, 25) . str_repeat('0', 64);

        foreach ([$tampered, 'not-a-token'] as $cookie) {
            [$status, $json, $set] = $this->withCookies('GET', 'session.php', ['karavan_remember' => $cookie]);

            $this->assertSame(401, $status);
            $this->assertFalse($json['logged_in']);
            $this->assertSame('deleted', $set['karavan_remember']['value'], 'The bad cookie is deleted from the browser.');
        }
    }

    // Persistent login backend, Test 6
    public function testExpiredRememberMeTokenIsRejectedAndDeleted(): void
    {
        TestDatabase::addUser($this->pdo, 'jamie.student', 'user', 'jamie.student@test.com');
        [, $remember] = $this->loginCookies('jamie.student@test.com', 'Password123!');
        $this->pdo->exec("UPDATE auth_tokens SET expires_at = '2020-01-01 00:00:00'");

        [$status] = $this->withCookies('GET', 'session.php', ['karavan_remember' => $remember]);

        $this->assertSame(401, $status);
        $this->assertSame(0, $this->tokenCount());
    }

    // Persistent login backend, Test 7
    public function testLogoutEndsBothTheSessionAndTheRememberMeLogin(): void
    {
        TestDatabase::addUser($this->pdo, 'jamie.student', 'user', 'jamie.student@test.com');
        [$session, $remember] = $this->loginCookies('jamie.student@test.com', 'Password123!');
        $both = ['PHPSESSID' => $session, 'karavan_remember' => $remember];

        [$logoutStatus, $logout, $set] = $this->withCookies('POST', 'logout.php', $both);

        $this->assertSame(200, $logoutStatus);
        $this->assertSame(['success' => true], $logout);
        $this->assertSame('deleted', $set['karavan_remember']['value']);
        $this->assertSame(0, $this->tokenCount());
        [$status] = $this->withCookies('GET', 'session.php', $both);
        $this->assertSame(401, $status, 'An old copy of the cookie cannot log back in.');
    }

    public function testDeletingAnAccountDeletesItsRememberMeTokens(): void
    {
        $userId = TestDatabase::addUser($this->pdo, 'jamie.student', 'user', 'jamie.student@test.com');
        [, $remember] = $this->loginCookies('jamie.student@test.com', 'Password123!');

        $this->pdo->exec("DELETE FROM users WHERE id = $userId");

        $this->assertSame(0, $this->tokenCount());
        [$status] = $this->withCookies('GET', 'session.php', ['karavan_remember' => $remember]);
        $this->assertSame(401, $status);
    }

    public function testSessionRejectsTheWrongMethod(): void
    {
        [$status, $json] = $this->withCookies('POST', 'session.php', []);

        $this->assertSame(405, $status);
        $this->assertSame(['success' => false, 'error' => 'Method not allowed.'], $json);
    }

    public function testModeratorSignsInFromNormalLoginPageAndCanReview(): void
    {
        TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator');
        $this->seedTwoPendingRequests();

        [$login, $session] = $this->login('moderator@test.com', 'Password123!');

        $this->assertTrue($login['success']);
        $this->assertSame('moderator', $login['role']);
        $this->assertNotNull($session);

        [$status, $json] = $this->request('GET', 'moderator_requests.php', null, $session);
        $this->assertSame(200, $status);
        $this->assertCount(2, $json['requests']);
    }

    public function testApprovedApplicantCanLogInAsAdminButCannotModerate(): void
    {
        $modSession = $this->sessionFor(TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator'));
        $this->seedTwoPendingRequests();
        $this->request('POST', 'moderator_approve.php', '{"request_id":5001,"action":"approve"}', $modSession);

        [$login, $session] = $this->login('alex.landlord@test.com', 'Landlord123!');

        $this->assertTrue($login['success']);
        $this->assertSame('admin', $login['role']);
        [$status] = $this->request('POST', 'moderator_approve.php', '{"request_id":5002,"action":"approve"}', $session);
        $this->assertSame(403, $status);
    }

    public function testApprovedAdminAccountStoresTheApplicantEmail(): void
    {
        $modSession = $this->sessionFor(TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator'));
        $this->seedTwoPendingRequests();
        $this->request('POST', 'moderator_approve.php', '{"request_id":5001,"action":"approve"}', $modSession);

        $email = $this->pdo->query("SELECT email FROM users WHERE role = 'admin'")->fetchColumn();
        $this->assertSame('alex.landlord@test.com', $email);
    }

    public function testSignedUpUserLogsInByEmailAndGetsASession(): void
    {
        [$status, $registered] = $this->postJson(
            'register.php', json_encode(['username' => 'testuser1', 'email' => 'testuser1@test.com', 'password' => 'TestUser123!']), null
        );
        $this->assertSame(200, $status);
        $this->assertTrue($registered['success']);
        $this->assertSame('testuser1@test.com', $this->pdo->query("SELECT email FROM users WHERE username = 'testuser1'")->fetchColumn());

        [$login, $session] = $this->login('TestUser1@test.com', 'TestUser123!');

        $this->assertTrue($login['success']);
        $this->assertSame('user', $login['role']);
        $this->assertNotNull($session);
        [$locationsStatus] = $this->request('GET', 'get_approved_locations.php', null, $session);
        $this->assertSame(403, $locationsStatus);
    }

    public function testSignUpRejectsADuplicateEmail(): void
    {
        $body = json_encode(['username' => 'testuser1', 'email' => 'testuser1@test.com', 'password' => 'TestUser123!']);
        $this->postJson('register.php', $body, null);

        [, $json] = $this->postJson('register.php', json_encode(['username' => 'other', 'email' => 'testuser1@test.com', 'password' => 'TestUser123!']), null);

        $this->assertFalse($json['success']);
        $this->assertSame('Username or Email already exists.', $json['error']);
        $this->assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM users WHERE email = 'testuser1@test.com'")->fetchColumn());
    }

    public function testSignUpRejectsADuplicateEmailInDifferentCase(): void
    {
        TestDatabase::addUser($this->pdo, 'mod', 'moderator', 'mod@test.com');

        [, $json] = $this->postJson('register.php', json_encode(['username' => 'other', 'email' => 'MOD@Test.com', 'password' => 'TestUser123!']), null);

        $this->assertFalse($json['success']);
        $this->assertSame('Username or Email already exists.', $json['error']);
        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
    }

    public function testSignUpRejectsAnEmailThatIsALegacyUsername(): void
    {
        TestDatabase::addUser($this->pdo, 'legacy@test.com');

        [, $json] = $this->postJson('register.php', json_encode(['username' => 'other', 'email' => 'legacy@test.com', 'password' => 'TestUser123!']), null);

        $this->assertFalse($json['success']);
        $this->assertSame('Username or Email already exists.', $json['error']);
    }

    public function testLoginPicksTheAccountWhosePasswordMatchesWhenAnEmailIsShared(): void
    {
        TestDatabase::addUser($this->pdo, 'mod', 'moderator', 'mod@test.com');
        $this->pdo->prepare("INSERT INTO users (username, email, password_hash, role) VALUES ('dupe', 'mod@test.com', ?, 'user')")
            ->execute([password_hash('Different123!', PASSWORD_BCRYPT)]);

        [$moderator] = $this->login('mod@test.com', 'Password123!');
        [$duplicate] = $this->login('mod@test.com', 'Different123!');

        $this->assertTrue($moderator['success']);
        $this->assertSame('moderator', $moderator['role']);
        $this->assertTrue($duplicate['success']);
        $this->assertSame('user', $duplicate['role']);
    }

    public function testWrongPasswordIsRejectedWithoutASession(): void
    {
        TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator');

        [$login, $session] = $this->login('moderator@test.com', 'WrongPassword1!');

        $this->assertFalse($login['success']);
        $this->assertSame('Invalid username or password.', $login['error']);
        $this->assertNull($session);
    }

    public function testPendingApplicantCannotLogInYet(): void
    {
        $this->seedTwoPendingRequests();

        [$login, $session] = $this->login('alex.landlord@test.com', 'Landlord123!');

        $this->assertFalse($login['success']);
        $this->assertNull($session);
    }

    public function testProofFileIsForbiddenWithoutModeratorSession(): void
    {
        $this->request('POST', 'admin_register.php', $this->form([], $this->fileOf('lease.pdf', Fixtures::pdfBytes())));

        [$status, $json] = $this->request('GET', 'proof_file.php?request_id=5001');

        $this->assertSame(403, $status);
        $this->assertSame(self::FORBIDDEN, $json);
    }

    private function postJson(string $path, string $json, ?string $sessionId): array
    {
        return $this->request('POST', $path, $json, $sessionId, ['Content-Type: application/json']);
    }

    private function locationCount(): int
    {
        return (int) $this->pdo->query('SELECT COUNT(*) FROM approved_locations')->fetchColumn();
    }

    // Approved locations backend, Tests 1-3: an admin who signed in on the normal login page
    public function testAdminCanListAddAndRemoveLocationsAfterLoggingIn(): void
    {
        TestDatabase::addUser($this->pdo, 'alex.landlord@test.com', 'admin');
        [$login, $session] = $this->login('alex.landlord@test.com', 'Password123!');
        $this->assertSame('admin', $login['role']);

        [$addStatus, $added, $addRaw] = $this->postJson(
            'add_approved_location.php', '{"lat":42.9612,"lng":-78.8328,"label":"Capen Hall Main Entrance"}', $session
        );
        $this->assertSame(201, $addStatus);
        $locationId = $added['location_id'];
        $this->assertSame('{"success":true,"location_id":' . $locationId . '}', $addRaw);
        $row = $this->pdo->query("SELECT * FROM approved_locations WHERE id = $locationId")->fetch();
        $this->assertSame('Capen Hall Main Entrance', $row['label']);
        $this->assertEqualsWithDelta(42.9612, (float) $row['lat'], 1e-9);
        $this->assertEqualsWithDelta(-78.8328, (float) $row['lng'], 1e-9);

        [$listStatus, , $listRaw, $listType] = $this->request('GET', 'get_approved_locations.php', null, $session);
        $this->assertSame(200, $listStatus);
        $this->assertSame('application/json', $listType);
        $this->assertSame(
            '{"success":true,"locations":[{"location_id":' . $locationId . ',"lat":42.9612,"lng":-78.8328,"label":"Capen Hall Main Entrance"}]}',
            $listRaw
        );

        [$removeStatus, , $removeRaw] = $this->postJson('remove_approved_location.php', '{"location_id":' . $locationId . '}', $session);
        $this->assertSame(200, $removeStatus);
        $this->assertSame('{"success":true,"location_id":' . $locationId . '}', $removeRaw);
        $this->assertSame(0, $this->locationCount());

        [, $after] = $this->request('GET', 'get_approved_locations.php', null, $session);
        $this->assertSame([], $after['locations']);
    }

    public function testApprovedApplicantCanManageLocationsButPendingApplicantCannotLogIn(): void
    {
        $modSession = $this->sessionFor(TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator'));
        $this->seedTwoPendingRequests();
        $this->assertNull($this->login('alex.landlord@test.com', 'Landlord123!')[1]);

        $this->postJson('moderator_approve.php', '{"request_id":5001,"action":"approve"}', $modSession);
        [$login, $session] = $this->login('alex.landlord@test.com', 'Landlord123!');

        $this->assertSame('admin', $login['role']);
        [$listStatus, $list] = $this->request('GET', 'get_approved_locations.php', null, $session);
        $this->assertSame([200, ['success' => true, 'locations' => []]], [$listStatus, $list]);
        [$addStatus] = $this->postJson('add_approved_location.php', '{"lat":43.0012,"lng":-78.7861,"label":"Student Union Lobby"}', $session);
        $this->assertSame(201, $addStatus);
        [$modStatus] = $this->request('GET', 'get_approved_locations.php', null, $modSession);
        $this->assertSame(403, $modStatus, 'Moderators approve admins but do not manage locations.');
    }

    public static function nonAdminRoles(): array
    {
        return ['regular user' => ['user'], 'moderator' => ['moderator']];
    }

    // Approved locations backend, Test 4
    #[\PHPUnit\Framework\Attributes\DataProvider('nonAdminRoles')]
    public function testNonAdminGets403FromEveryLocationEndpoint(string $role): void
    {
        $session = $this->sessionFor(TestDatabase::addUser($this->pdo, 'testuser@test.com', $role));
        $locationId = TestDatabase::addLocation($this->pdo, 42.9612, -78.8328, 'Capen Hall Main Entrance');
        $forbidden = '{"success":false,"error":"You do not have permission to perform this action."}';

        [$getStatus, , $getRaw] = $this->request('GET', 'get_approved_locations.php', null, $session);
        [$addStatus, , $addRaw] = $this->postJson('add_approved_location.php', '{"lat":42.9612,"lng":-78.8328,"label":"Test"}', $session);
        [$removeStatus, , $removeRaw] = $this->postJson('remove_approved_location.php', '{"location_id":' . $locationId . '}', $session);

        $this->assertSame([403, $forbidden], [$getStatus, $getRaw]);
        $this->assertSame([403, $forbidden], [$addStatus, $addRaw]);
        $this->assertSame([403, $forbidden], [$removeStatus, $removeRaw]);
        $this->assertSame(1, $this->locationCount(), 'Nothing is added or removed.');
    }

    public function testLocationEndpointsReturn403WhenNotLoggedIn(): void
    {
        [$getStatus, $getJson] = $this->request('GET', 'get_approved_locations.php');
        [$addStatus, $addJson] = $this->postJson('add_approved_location.php', '{"lat":42.9612,"lng":-78.8328,"label":"Test"}', null);
        [$removeStatus, $removeJson] = $this->postJson('remove_approved_location.php', '{"location_id":1}', null);

        $this->assertSame([403, self::FORBIDDEN], [$getStatus, $getJson]);
        $this->assertSame([403, self::FORBIDDEN], [$addStatus, $addJson]);
        $this->assertSame([403, self::FORBIDDEN], [$removeStatus, $removeJson]);
        $this->assertSame(0, $this->locationCount());
    }

    // Approved locations backend, Test 5
    public function testInvalidCoordinatesReturn400AndCreateNoRow(): void
    {
        $session = $this->sessionFor(TestDatabase::addUser($this->pdo, 'alex.landlord@test.com', 'admin'));

        [$status, , $raw] = $this->postJson('add_approved_location.php', '{"lat":999,"lng":-78.8328,"label":"InvalidSpot"}', $session);

        $this->assertSame(400, $status);
        $this->assertSame('{"success":false,"error":"Invalid location coordinates."}', $raw);
        $this->assertSame(0, $this->locationCount());
    }

    public function testRemovingAMissingLocationReturns404(): void
    {
        $session = $this->sessionFor(TestDatabase::addUser($this->pdo, 'alex.landlord@test.com', 'admin'));

        [$status, $json] = $this->postJson('remove_approved_location.php', '{"location_id":424242}', $session);

        $this->assertSame(404, $status);
        $this->assertSame(['success' => false, 'error' => 'Location not found.'], $json);
    }

    public function testLocationEndpointsRejectTheWrongMethod(): void
    {
        $session = $this->sessionFor(TestDatabase::addUser($this->pdo, 'alex.landlord@test.com', 'admin'));

        [$getStatus] = $this->postJson('get_approved_locations.php', '{}', $session);
        [$addStatus] = $this->request('GET', 'add_approved_location.php', null, $session);
        [$removeStatus] = $this->request('GET', 'remove_approved_location.php', null, $session);

        $this->assertSame([405, 405, 405], [$getStatus, $addStatus, $removeStatus]);
    }

    private function signUp(string $username, string $email, string $password): void
    {
        [, $json] = $this->postJson('register.php', json_encode(['username' => $username, 'email' => $email, 'password' => $password]), null);
        $this->assertTrue($json['success'], 'sign up');
    }

    private function approveAs(string $modSession, int $requestId): array
    {
        return $this->postJson('moderator_approve.php', json_encode(['request_id' => $requestId, 'action' => 'approve']), $modSession);
    }

    // Bug fix: a student applies with the email of their existing regular account.
    public function testStudentAppliesWithTheirOwnEmailAndBecomesAdminOnTheSameAccount(): void
    {
        $modSession = $this->sessionFor(TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator'));
        $this->signUp('riley.student', 'riley.student@test.com', 'Student123!');
        $studentId = (int) $this->pdo->query("SELECT id FROM users WHERE username = 'riley.student'")->fetchColumn();

        [$applyStatus, $applied] = $this->request('POST', 'admin_register.php', $this->form(
            ['email' => 'riley.student@test.com', 'business_name' => 'Riley Rentals', 'password' => 'Partner123!'],
            $this->fileOf('lease.pdf', Fixtures::pdfBytes())
        ));
        $this->assertSame(201, $applyStatus);
        $this->assertSame($studentId, (int) $this->pdo->query("SELECT user_id FROM admin_requests WHERE id = {$applied['request_id']}")->fetchColumn());

        [$approveStatus] = $this->approveAs($modSession, $applied['request_id']);
        $this->assertSame(200, $approveStatus);
        $this->assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM users WHERE LOWER(email) = 'riley.student@test.com' OR LOWER(username) = 'riley.student@test.com'")->fetchColumn());

        [$login, $session] = $this->login('riley.student@test.com', 'Student123!');
        $this->assertTrue($login['success']);
        $this->assertSame('admin', $login['role']);
        [$adminStatus] = $this->request('GET', 'get_approved_locations.php', null, $session);
        $this->assertSame(200, $adminStatus, 'the Admin tab loads for the promoted account');
    }

    public function testAdminOrModeratorEmailStillCannotApply(): void
    {
        TestDatabase::addUser($this->pdo, 'moderator@test.com', 'moderator', 'moderator@test.com');

        [$status, , $raw] = $this->request('POST', 'admin_register.php', $this->form(
            ['email' => 'moderator@test.com'], $this->fileOf('lease.pdf', Fixtures::pdfBytes())
        ));

        $this->assertSame(409, $status);
        $this->assertSame('{"success":false,"error":"An account with this email already exists."}', $raw);
        $this->assertSame(0, $this->requestCount());
    }

    private function approvedCommunity(string $businessName, string $email): int
    {
        return TestDatabase::addRequest($this->pdo, ['business_name' => $businessName, 'email' => $email, 'status' => 'approved']);
    }

    public function testStudentListsJoinsAndSwitchesCommunities(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC', 'morgan.keller.b3@test.com');
        $riverside = $this->approvedCommunity('Riverside Apartments', 'taylor.rivers.b3@test.com');
        $this->signUp('drew.student', 'drew.student@test.com', 'Student123!');
        [$login, $session] = $this->login('drew.student@test.com', 'Student123!');
        $this->assertNull($login['community_id']);
        $this->assertNull($login['community_name']);

        [$listStatus, , $listRaw] = $this->request('GET', 'list_communities.php', null, $session);
        $this->assertSame(200, $listStatus);
        $this->assertSame(
            '{"success":true,"communities":[{"community_id":' . $keller . ',"name":"Keller Properties LLC"},{"community_id":' . $riverside . ',"name":"Riverside Apartments"}],"joined_community_id":null}',
            $listRaw
        );

        [$joinStatus, , $joinRaw] = $this->postJson('join_community.php', json_encode(['community_id' => $keller]), $session);
        $this->assertSame(200, $joinStatus);
        $this->assertSame('{"success":true,"community_id":' . $keller . ',"community_name":"Keller Properties LLC"}', $joinRaw);

        [$switchStatus, $switched] = $this->postJson('join_community.php', json_encode(['community_id' => $riverside]), $session);
        $this->assertSame(200, $switchStatus);
        $this->assertSame(['success' => true, 'community_id' => $riverside, 'community_name' => 'Riverside Apartments'], $switched);
        $this->assertSame($riverside, (int) $this->pdo->query("SELECT community_id FROM users WHERE username = 'drew.student'")->fetchColumn());
        $this->assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM users WHERE username = 'drew.student'")->fetchColumn());

        [$again] = $this->login('drew.student@test.com', 'Student123!');
        $this->assertSame($riverside, $again['community_id']);
        $this->assertSame('Riverside Apartments', $again['community_name']);
    }

    // Leave a Community backend
    public function testStudentLeavesTheirCommunity(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC', 'morgan.keller.b4@test.com');
        $this->signUp('drew.student', 'drew.student@test.com', 'Student123!');
        [, $session] = $this->login('drew.student@test.com', 'Student123!');
        $this->postJson('join_community.php', json_encode(['community_id' => $keller]), $session);
        [, $listed] = $this->request('GET', 'list_communities.php', null, $session);
        $this->assertSame($keller, $listed['joined_community_id']);

        [$leaveStatus, , $leaveRaw] = $this->request('POST', 'leave_community.php', null, $session);

        $this->assertSame(200, $leaveStatus);
        $this->assertSame('{"success":true,"community_id":null,"community_name":null}', $leaveRaw);
        $this->assertNull($this->pdo->query("SELECT community_id FROM users WHERE username = 'drew.student'")->fetchColumn());
        [, $after] = $this->request('GET', 'list_communities.php', null, $session);
        $this->assertNull($after['joined_community_id']);
        [$again] = $this->login('drew.student@test.com', 'Student123!');
        $this->assertNull($again['community_id']);
    }

    public function testJoiningANonexistentCommunityReturns404(): void
    {
        $this->signUp('avery.student', 'avery.student@test.com', 'Student123!');
        [, $session] = $this->login('avery.student@test.com', 'Student123!');

        [$status, , $raw] = $this->postJson('join_community.php', '{"community_id":999999}', $session);

        $this->assertSame(404, $status);
        $this->assertSame('{"success":false,"error":"Community not found."}', $raw);
    }

    public function testCommunityEndpointsReturn403WhenNotLoggedIn(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC', 'morgan.keller.b1@test.com');

        [$listStatus, , $listRaw] = $this->request('GET', 'list_communities.php');
        [$joinStatus, , $joinRaw] = $this->postJson('join_community.php', json_encode(['community_id' => $keller]), null);

        $this->assertSame(403, $listStatus);
        $this->assertSame('{"success":false,"error":"You do not have permission to perform this action."}', $listRaw);
        $this->assertSame(403, $joinStatus);
        $this->assertSame($listRaw, $joinRaw);
        [$leaveStatus, , $leaveRaw] = $this->request('POST', 'leave_community.php');
        $this->assertSame([403, $listRaw], [$leaveStatus, $leaveRaw]);
    }

    public function testCommunityEndpointsRejectTheWrongMethod(): void
    {
        $session = $this->sessionFor(TestDatabase::addUser($this->pdo, 'someone@test.com'));

        [$listStatus] = $this->postJson('list_communities.php', '{}', $session);
        [$joinStatus] = $this->request('GET', 'join_community.php', null, $session);
        [$leaveStatus] = $this->request('GET', 'leave_community.php', null, $session);

        $this->assertSame([405, 405, 405], [$listStatus, $joinStatus, $leaveStatus]);
    }
}
