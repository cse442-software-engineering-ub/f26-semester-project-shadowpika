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
    private function login(string $username, string $password): array
    {
        $ch = curl_init(self::$baseUrl . '/login.php');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode(['username' => $username, 'password' => $password]),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        ]);
        $raw = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        preg_match_all('/^Set-Cookie:\s*PHPSESSID=([^;]+)/mi', substr($raw, 0, $headerSize), $cookies);
        return [json_decode(substr($raw, $headerSize), true), $cookies[1] ? end($cookies[1]) : null];
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
}
