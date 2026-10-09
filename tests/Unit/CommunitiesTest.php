<?php
namespace Karavan\Tests\Unit;

use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class CommunitiesTest extends TestCase
{
    private const FORBIDDEN = ['success' => false, 'error' => 'You do not have permission to perform this action.'];
    private const NOT_FOUND = ['success' => false, 'error' => 'Community not found.'];

    private PDO $pdo;
    private int $studentId;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->studentId = TestDatabase::addUser($this->pdo, 'jamie.student', 'user', 'jamie.student@test.com');
    }

    private function approvedCommunity(string $name): int
    {
        return TestDatabase::addRequest($this->pdo, ['business_name' => $name, 'status' => 'approved']);
    }

    private function communityOf(int $userId): ?int
    {
        $value = $this->pdo->query("SELECT community_id FROM users WHERE id = $userId")->fetchColumn();
        return $value === null ? null : (int) $value;
    }

    public function testListsApprovedPartnersBusinesses(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');

        [$status, $body] = karavan_list_communities($this->pdo, $this->studentId);

        $this->assertSame(200, $status);
        $this->assertSame('{"success":true,"communities":[{"community_id":' . $keller . ',"name":"Keller Properties LLC"}]}', json_encode($body));
    }

    public function testPendingApplicationsAreNotCommunitiesYet(): void
    {
        TestDatabase::addRequest($this->pdo, ['business_name' => 'Pending Place']);

        [, $body] = karavan_list_communities($this->pdo, $this->studentId);

        $this->assertSame([], $body['communities']);
    }

    public function testPartnersWithTheSameBusinessNameShareOneCommunity(): void
    {
        $first = $this->approvedCommunity('Keller Properties LLC');
        $this->approvedCommunity('keller properties llc ');
        $riverside = $this->approvedCommunity('Riverside Apartments');

        [, $body] = karavan_list_communities($this->pdo, $this->studentId);

        $this->assertSame([
            ['community_id' => $first, 'name' => 'Keller Properties LLC'],
            ['community_id' => $riverside, 'name' => 'Riverside Apartments'],
        ], $body['communities']);
    }

    public static function everyRole(): array
    {
        return ['user' => ['user'], 'admin' => ['admin'], 'moderator' => ['moderator']];
    }

    #[DataProvider('everyRole')]
    public function testAnyLoggedInUserCanListAndJoin(string $role): void
    {
        $userId = TestDatabase::addUser($this->pdo, "someone.$role", $role);
        $keller = $this->approvedCommunity('Keller Properties LLC');

        [$listStatus] = karavan_list_communities($this->pdo, $userId);
        [$joinStatus] = karavan_join_community($this->pdo, $userId, ['community_id' => $keller]);

        $this->assertSame(200, $listStatus);
        $this->assertSame(200, $joinStatus);
    }

    public function testJoiningSetsTheUsersCommunity(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');

        [$status, $body] = karavan_join_community($this->pdo, $this->studentId, ['community_id' => $keller]);

        $this->assertSame(200, $status);
        $this->assertSame('{"success":true,"community_id":' . $keller . ',"community_name":"Keller Properties LLC"}', json_encode($body));
        $this->assertSame($keller, $this->communityOf($this->studentId));
    }

    public function testJoiningAnotherCommunityReplacesTheFirst(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $riverside = $this->approvedCommunity('Riverside Apartments');
        $usersBefore = (int) $this->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();

        karavan_join_community($this->pdo, $this->studentId, ['community_id' => $keller]);
        [$status, $body] = karavan_join_community($this->pdo, $this->studentId, ['community_id' => $riverside]);

        $this->assertSame(200, $status);
        $this->assertSame(['success' => true, 'community_id' => $riverside, 'community_name' => 'Riverside Apartments'], $body);
        $this->assertSame($riverside, $this->communityOf($this->studentId));
        $this->assertSame($usersBefore, (int) $this->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
    }

    public static function badCommunityIds(): array
    {
        return [
            'nonexistent'    => [['community_id' => 999999]],
            'not a number'   => [['community_id' => 'abc']],
            'zero'           => [['community_id' => 0]],
            'missing'        => [[]],
            'not an object'  => ['nope'],
        ];
    }

    #[DataProvider('badCommunityIds')]
    public function testUnknownCommunityReturns404AndChangesNothing($input): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');
        karavan_join_community($this->pdo, $this->studentId, ['community_id' => $keller]);

        [$status, $body] = karavan_join_community($this->pdo, $this->studentId, $input);

        $this->assertSame(404, $status);
        $this->assertSame(self::NOT_FOUND, $body);
        $this->assertSame($keller, $this->communityOf($this->studentId));
    }

    public function testPendingApplicationCannotBeJoined(): void
    {
        $pending = TestDatabase::addRequest($this->pdo, ['business_name' => 'Pending Place']);

        [$status, $body] = karavan_join_community($this->pdo, $this->studentId, ['community_id' => $pending]);

        $this->assertSame(404, $status);
        $this->assertSame(self::NOT_FOUND, $body);
        $this->assertNull($this->communityOf($this->studentId));
    }

    public static function notLoggedIn(): array
    {
        return ['no session' => [null], 'deleted user' => [9999]];
    }

    #[DataProvider('notLoggedIn')]
    public function testNotLoggedInIsForbidden(?int $userId): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');

        $this->assertSame([403, self::FORBIDDEN], karavan_list_communities($this->pdo, $userId));
        $this->assertSame([403, self::FORBIDDEN], karavan_join_community($this->pdo, $userId, ['community_id' => $keller]));
    }
}
