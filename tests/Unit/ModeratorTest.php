<?php
namespace Karavan\Tests\Unit;

use Karavan\Tests\Support\Fixtures;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ModeratorTest extends TestCase
{
    private const FORBIDDEN = ['success' => false, 'error' => 'You do not have permission to perform this action.'];

    private PDO $pdo;
    private string $uploadDir;
    private int $moderatorId;
    private int $regularUserId;
    private int $partnerAdminId;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->uploadDir = Fixtures::tempDir('karavan_mod_');
        $this->moderatorId = TestDatabase::addUser($this->pdo, 'karavan.mod', 'moderator');
        $this->regularUserId = TestDatabase::addUser($this->pdo, 'regular@test.com', 'user');
        $this->partnerAdminId = TestDatabase::addUser($this->pdo, 'partner@test.com', 'admin');
    }

    protected function tearDown(): void
    {
        Fixtures::removeDir($this->uploadDir);
    }

    private function decide(?int $userId, $input): array
    {
        return karavan_decide_request($this->pdo, $userId, $input, $this->uploadDir);
    }

    private function requestRow(int $requestId): array|false
    {
        $stmt = $this->pdo->prepare('SELECT * FROM admin_requests WHERE id = ?');
        $stmt->execute([$requestId]);
        return $stmt->fetch();
    }

    private function userByUsername(string $username): array|false
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE username = ?');
        $stmt->execute([$username]);
        return $stmt->fetch();
    }

    public static function nonModerators(): array
    {
        return [
            'not logged in'           => ['none'],
            'regular user'            => ['user'],
            'approved partner admin'  => ['admin'],
            'unknown user id'         => ['missing'],
        ];
    }

    private function callerFor(string $kind): ?int
    {
        return match ($kind) {
            'none'    => null,
            'user'    => $this->regularUserId,
            'admin'   => $this->partnerAdminId,
            'missing' => 9999,
        };
    }

    #[DataProvider('nonModerators')]
    public function testListingIsForbiddenForNonModerators(string $kind): void
    {
        [$status, $body] = karavan_list_pending_requests($this->pdo, $this->callerFor($kind));

        $this->assertSame(403, $status);
        $this->assertSame(self::FORBIDDEN, $body);
    }

    #[DataProvider('nonModerators')]
    public function testDecidingIsForbiddenForNonModerators(string $kind): void
    {
        $requestId = TestDatabase::addRequest($this->pdo, ['email' => 'alex@test.com']);

        [$status, $body] = $this->decide($this->callerFor($kind), ['request_id' => $requestId, 'action' => 'approve']);

        $this->assertSame(403, $status);
        $this->assertSame(self::FORBIDDEN, $body);
        $this->assertSame('pending', $this->requestRow($requestId)['status']);
        $this->assertFalse($this->userByUsername('alex@test.com'));
    }

    public function testListReturnsOnlyPendingRequestsWithRequiredFields(): void
    {
        $pendingId = TestDatabase::addRequest($this->pdo, ['business_name' => "Bob's Rentals"]);
        TestDatabase::addRequest($this->pdo, ['status' => 'approved']);

        [$status, $body] = karavan_list_pending_requests($this->pdo, $this->moderatorId);

        $this->assertSame(200, $status);
        $this->assertTrue($body['success']);
        $this->assertCount(1, $body['requests']);
        $request = $body['requests'][0];
        $this->assertSame($pendingId, $request['request_id']);
        $this->assertSame('pending', $request['status']);
        $this->assertSame('Chun Admin', $request['full_name']);
        $this->assertSame("Bob's Rentals", $request['business_name']);
        $this->assertSame("proof_file.php?request_id=$pendingId", $request['proof_of_ownership_url']);
        $this->assertArrayNotHasKey('password_hash', $request);
    }

    public function testListIsEmptyWhenNothingPending(): void
    {
        [$status, $body] = karavan_list_pending_requests($this->pdo, $this->moderatorId);

        $this->assertSame(200, $status);
        $this->assertSame([], $body['requests']);
    }

    public function testApproveCreatesAdminAccountThatCanLogIn(): void
    {
        $requestId = TestDatabase::addRequest($this->pdo, ['email' => 'alex@test.com', 'password' => 'Landlord123!']);

        [$status, $body] = $this->decide($this->moderatorId, ['request_id' => $requestId, 'action' => 'approve']);

        $this->assertSame(200, $status);
        $this->assertSame(['success' => true, 'request_id' => $requestId, 'status' => 'approved'], $body);

        $user = $this->userByUsername('alex@test.com');
        $this->assertNotFalse($user);
        $this->assertSame('admin', $user['role']);
        $this->assertTrue(password_verify('Landlord123!', $user['password_hash']));

        $row = $this->requestRow($requestId);
        $this->assertSame('approved', $row['status']);
        $this->assertSame((int) $user['id'], (int) $row['user_id']);
        $this->assertSame($this->moderatorId, (int) $row['reviewed_by']);
        $this->assertNotNull($row['reviewed_at']);
    }

    public function testDenyDeletesRequestAndDocumentWithoutCreatingAccount(): void
    {
        file_put_contents($this->uploadDir . '/deny-me.pdf', Fixtures::pdfBytes());
        $requestId = TestDatabase::addRequest($this->pdo, ['email' => 'dana@test.com', 'proof_file_name' => 'deny-me.pdf']);

        [$status, $body] = $this->decide($this->moderatorId, ['request_id' => $requestId, 'action' => 'deny']);

        $this->assertSame(200, $status);
        $this->assertSame(['success' => true, 'request_id' => $requestId, 'status' => 'denied'], $body);
        $this->assertFalse($this->requestRow($requestId));
        $this->assertFalse($this->userByUsername('dana@test.com'));
        $this->assertFileDoesNotExist($this->uploadDir . '/deny-me.pdf');
    }

    public function testDecidedRequestsDisappearFromPendingList(): void
    {
        $approveId = TestDatabase::addRequest($this->pdo);
        $denyId = TestDatabase::addRequest($this->pdo);
        $this->decide($this->moderatorId, ['request_id' => $approveId, 'action' => 'approve']);
        $this->decide($this->moderatorId, ['request_id' => $denyId, 'action' => 'deny']);

        [, $body] = karavan_list_pending_requests($this->pdo, $this->moderatorId);

        $this->assertSame([], $body['requests']);
    }

    public function testCannotApproveTwice(): void
    {
        $requestId = TestDatabase::addRequest($this->pdo, ['email' => 'alex@test.com']);
        $this->decide($this->moderatorId, ['request_id' => $requestId, 'action' => 'approve']);

        [$status] = $this->decide($this->moderatorId, ['request_id' => $requestId, 'action' => 'approve']);

        $this->assertSame(409, $status);
        $this->assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM users WHERE username = 'alex@test.com'")->fetchColumn());
    }

    public function testCannotDenyAnApprovedRequest(): void
    {
        $requestId = TestDatabase::addRequest($this->pdo, ['email' => 'alex@test.com']);
        $this->decide($this->moderatorId, ['request_id' => $requestId, 'action' => 'approve']);

        [$status] = $this->decide($this->moderatorId, ['request_id' => $requestId, 'action' => 'deny']);

        $this->assertSame(409, $status);
        $this->assertSame('approved', $this->requestRow($requestId)['status']);
    }

    public function testDeniedRequestReturns404IfDecidedAgain(): void
    {
        $requestId = TestDatabase::addRequest($this->pdo);
        $this->decide($this->moderatorId, ['request_id' => $requestId, 'action' => 'deny']);

        [$status] = $this->decide($this->moderatorId, ['request_id' => $requestId, 'action' => 'approve']);

        $this->assertSame(404, $status);
    }

    public function testApproveFailsCleanlyIfEmailWasTakenMeanwhile(): void
    {
        $requestId = TestDatabase::addRequest($this->pdo, ['email' => 'taken@test.com']);
        TestDatabase::addUser($this->pdo, 'taken@test.com', 'user');

        [$status, $body] = $this->decide($this->moderatorId, ['request_id' => $requestId, 'action' => 'approve']);

        $this->assertSame(409, $status);
        $this->assertSame('An account with this email already exists.', $body['error']);
        $this->assertSame('pending', $this->requestRow($requestId)['status']);
        $this->assertSame('user', $this->userByUsername('taken@test.com')['role']);
    }

    public function testUnknownRequestReturns404(): void
    {
        [$status] = $this->decide($this->moderatorId, ['request_id' => 12345, 'action' => 'approve']);

        $this->assertSame(404, $status);
    }

    public static function invalidPayloads(): array
    {
        return [
            'null body'       => [null],
            'missing action'  => [['request_id' => 5001]],
            'bad action'      => [['request_id' => 5001, 'action' => 'delete']],
            'missing id'      => [['action' => 'approve']],
            'non-numeric id'  => [['request_id' => '5001 OR 1=1', 'action' => 'approve']],
        ];
    }

    #[DataProvider('invalidPayloads')]
    public function testInvalidPayloadReturns400($payload): void
    {
        TestDatabase::addRequest($this->pdo);

        [$status, $body] = $this->decide($this->moderatorId, $payload);

        $this->assertSame(400, $status);
        $this->assertFalse($body['success']);
    }

    public function testProofFileIsForbiddenForNonModerators(): void
    {
        $requestId = TestDatabase::addRequest($this->pdo);

        [$status, $body] = karavan_locate_proof_file($this->pdo, $this->partnerAdminId, $requestId, $this->uploadDir);

        $this->assertSame(403, $status);
        $this->assertSame(self::FORBIDDEN, $body);
    }

    public function testProofFileResolvesInsideUploadDirectory(): void
    {
        file_put_contents($this->uploadDir . '/abc.pdf', Fixtures::pdfBytes());
        $requestId = TestDatabase::addRequest($this->pdo, ['proof_file_name' => '../../abc.pdf']);

        [$status, $result] = karavan_locate_proof_file($this->pdo, $this->moderatorId, $requestId, $this->uploadDir);

        $this->assertSame(200, $status);
        $this->assertSame($this->uploadDir . '/abc.pdf', $result['path']);
        $this->assertSame('application/pdf', $result['mime']);
    }
}
