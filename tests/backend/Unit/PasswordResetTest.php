<?php
namespace Karavan\Tests\Unit;

use Karavan\Tests\Support\TestDatabase;
use PHPUnit\Framework\TestCase;
use PDO;
require_once dirname(__DIR__, 3) . '/backend/includes/password_reset.php';

final class PasswordResetTest extends TestCase
{
    private PDO $pdo;
    private array $state;
    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create(); $this->state = [];
        $id = TestDatabase::addUser($this->pdo, 'reset', 'user', 'reset@example.com');
        $this->pdo->prepare('UPDATE users SET security_q1_index=0,security_a1_hash=? WHERE id=?')->execute([security_answer_hash('milo'), $id]);
    }
    private function begin(int $now = 1000): array { return begin_password_reset($this->pdo, $this->state, ['email' => 'reset@example.com'], $now); }
    private function verify(int $now = 1001): array { return verify_reset_answer($this->pdo, $this->state, ['answer' => '  MiLO  '], $now); }
    public function testCaseInsensitiveResetPersistsAndCannotBeReused(): void
    {
        $this->assertSame(200, $this->begin()[0]); $this->assertSame(200, $this->verify()[0]);
        $this->assertSame(200, finish_password_reset($this->pdo, $this->state, ['password' => 'After123!'], 1002)[0]);
        $hash = $this->pdo->query('SELECT password_hash FROM users')->fetchColumn();
        $this->assertTrue(password_verify('After123!', $hash));
        $this->assertFalse(password_verify('Password123!', $hash));
        $this->assertSame(410, finish_password_reset($this->pdo, $this->state, ['password' => 'Wrong123!'], 1003)[0]);
    }
    public function testBypassAndExpiryAreRejectedWithControllableClock(): void
    {
        $this->assertSame(410, finish_password_reset($this->pdo, $this->state, ['password' => 'Bad'], 1000)[0]);
        $this->begin(); $this->assertSame(410, $this->verify(1600)[0]);
        $this->begin(); $this->verify();
        $this->assertSame(410, finish_password_reset($this->pdo, $this->state, ['password' => 'Bad'], 1600)[0]);
    }
    public function testWrongAnswersAreLimitedAndDoNotChangePassword(): void
    {
        $before = $this->pdo->query('SELECT password_hash FROM users')->fetchColumn(); $this->begin();
        for ($i=0;$i<5;$i++) $this->assertSame($i===4 ? 410 : 403, verify_reset_answer($this->pdo, $this->state, ['answer'=>'wrong'], 1001)[0]);
        $this->assertSame(410, $this->verify()[0]);
        $this->assertSame($before, $this->pdo->query('SELECT password_hash FROM users')->fetchColumn());
    }
    public function testFailedLookupInvalidatesVerifiedGrantAndRejectsAmbiguity(): void
    {
        $this->begin(); $this->verify();
        $this->assertSame(422, begin_password_reset($this->pdo, $this->state, ['email'=>'missing@example.com'], 1002)[0]);
        $this->assertSame([], $this->state);
        TestDatabase::addUser($this->pdo, 'duplicate', 'user', 'reset@example.com');
        $this->assertSame(409, $this->begin()[0]);
    }
    public function testLegacyAccountCannotReset(): void
    {
        $this->pdo->exec('UPDATE users SET security_a1_hash=NULL');
        $this->assertSame(422, $this->begin()[0]); $this->assertSame([], $this->state);
    }
    public function testOtherVerifiedSessionBecomesStaleAndRememberTokensAreRevoked(): void
    {
        $this->begin(); $this->verify(); $other = $this->state;
        $this->pdo->exec("INSERT INTO auth_tokens(user_id,selector,token_hash,expires_at) VALUES(1,'s','h','2099-01-01')");
        $this->assertSame(200, finish_password_reset($this->pdo, $this->state, ['password'=>'New123!'],1002)[0]);
        $this->assertSame(410, finish_password_reset($this->pdo, $other, ['password'=>'Other123!'],1002)[0]);
        $this->assertSame(0, (int)$this->pdo->query('SELECT COUNT(*) FROM auth_tokens')->fetchColumn());
    }
    public function testInvalidTypesAndFullAnswerHashing(): void
    {
        foreach ([null, [], '', '  ', str_repeat('a',101)] as $value) $this->assertNull(normalized_security_answer($value));
        $first = str_repeat('a',80).'b'; $second = str_repeat('a',80).'c';
        $this->assertFalse(security_answer_matches($second,security_answer_hash($first)));
        $this->assertSame(400, begin_password_reset($this->pdo,$this->state,['email'=>[]],1000)[0]);
        $this->begin(); $this->verify();
        foreach ([[], '', str_repeat('a',51)] as $password) $this->assertSame(400,finish_password_reset($this->pdo,$this->state,['password'=>$password],1002)[0]);
    }
}
