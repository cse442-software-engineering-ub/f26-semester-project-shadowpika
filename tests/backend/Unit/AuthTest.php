<?php
namespace Karavan\Tests\Unit;

use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class AuthTest extends TestCase
{
    private PDO $pdo;
    private int $userId;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->userId = TestDatabase::addUser($this->pdo, 'jamie.student', 'user', 'jamie.student@test.com');
    }

    public function testIssuedTokenLogsTheUserBackIn(): void
    {
        $cookie = karavan_issue_remember_token($this->pdo, $this->userId);

        $this->assertSame($this->userId, karavan_check_remember_token($this->pdo, $cookie));
        $this->assertSame($this->userId, karavan_check_remember_token($this->pdo, $cookie), 'Using a token does not use it up.');
    }

    public function testTokenWorksUntil30DaysAfterLogin(): void
    {
        $issuedAt = strtotime('2026-10-01 12:00:00');
        $cookie = karavan_issue_remember_token($this->pdo, $this->userId, $issuedAt);

        $this->assertSame($this->userId, karavan_check_remember_token($this->pdo, $cookie, $issuedAt + 30 * 86400 - 1));
        $this->assertNull(karavan_check_remember_token($this->pdo, $cookie, $issuedAt + 30 * 86400));
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM auth_tokens')->fetchColumn(), 'The expired token is deleted.');
    }

    public function testWrongValidatorIsRejectedWithoutDeletingTheRealToken(): void
    {
        $cookie = karavan_issue_remember_token($this->pdo, $this->userId);
        [$selector] = explode(':', $cookie);

        $this->assertNull(karavan_check_remember_token($this->pdo, $selector . ':' . str_repeat('a', 64)));
        $this->assertSame($this->userId, karavan_check_remember_token($this->pdo, $cookie));
    }

    public static function malformedCookies(): array
    {
        return [
            'missing'        => [null],
            'empty'          => [''],
            'no separator'   => [str_repeat('a', 88)],
            'short selector' => [str_repeat('a', 23) . ':' . str_repeat('b', 64)],
            'not hex'        => [str_repeat('z', 24) . ':' . str_repeat('b', 64)],
            'sql injection'  => ["' OR 1=1 -- :" . str_repeat('b', 64)],
        ];
    }

    #[DataProvider('malformedCookies')]
    public function testMalformedCookiesAreRejected(?string $cookie): void
    {
        karavan_issue_remember_token($this->pdo, $this->userId);

        $this->assertNull(karavan_parse_remember_cookie($cookie));
        $this->assertNull(karavan_check_remember_token($this->pdo, $cookie));
    }

    public function testForgettingATokenStopsItWorking(): void
    {
        $cookie = karavan_issue_remember_token($this->pdo, $this->userId);
        $otherDevice = karavan_issue_remember_token($this->pdo, $this->userId);

        karavan_forget_remember_token($this->pdo, $cookie);

        $this->assertNull(karavan_check_remember_token($this->pdo, $cookie));
        $this->assertSame($this->userId, karavan_check_remember_token($this->pdo, $otherDevice), 'Other devices stay logged in.');
    }

    public function testSessionStatusForALoggedOutVisitor(): void
    {
        $this->assertSame(
            [401, ['success' => false, 'logged_in' => false, 'error' => 'You are not logged in.']],
            karavan_session_status(null)
        );
    }

    public function testSessionStatusForALoggedInUser(): void
    {
        $user = karavan_find_user($this->pdo, $this->userId);

        $this->assertSame([200, [
            'success' => true, 'logged_in' => true, 'user_id' => $this->userId,
            'username' => 'jamie.student', 'email' => 'jamie.student@test.com', 'role' => 'user',
        ]], karavan_session_status($user));
    }
}
