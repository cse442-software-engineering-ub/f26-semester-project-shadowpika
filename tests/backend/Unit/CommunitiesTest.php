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
    private const NOT_A_MEMBER = ['success' => false, 'error' => 'This item is only available to members of its community.'];
    private const NOT_JOINED = ['success' => false, 'error' => 'You can only shop from communities you have joined.'];

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

    private function join(int $communityId, ?int $userId = null): array
    {
        return karavan_join_community($this->pdo, $userId ?? $this->studentId, ['community_id' => $communityId]);
    }

    /** @return array<int, bool> community_id => shopping, read straight from the table */
    private function rowsOf(int $userId): array
    {
        $stmt = $this->pdo->prepare('SELECT community_id, shopping FROM community_members WHERE user_id = ? ORDER BY community_id');
        $stmt->execute([$userId]);
        $rows = [];
        foreach ($stmt->fetchAll() as $row) {
            $rows[(int) $row['community_id']] = (int) $row['shopping'] === 1;
        }
        return $rows;
    }

    private function listed(?int $userId = null): array
    {
        return karavan_list_communities($this->pdo, $userId ?? $this->studentId)[1]['communities'];
    }

    // ---- Listing communities ----

    public function testListsApprovedPartnersBusinessesWithMembershipFlags(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');

        [$status, $body] = karavan_list_communities($this->pdo, $this->studentId);

        $this->assertSame(200, $status);
        $this->assertSame(
            '{"success":true,"communities":[{"community_id":' . $keller . ',"name":"Keller Properties LLC","joined":false,"shopping":false,"automatic":false}]}',
            json_encode($body)
        );
    }

    public function testEveryoneIsAutomaticallyInAllOfUbAndShopsFromIt(): void
    {
        $allOfUb = $this->approvedCommunity('All of UB');
        $keller = $this->approvedCommunity('Keller Properties LLC');

        $this->assertSame([
            ['community_id' => $allOfUb, 'name' => 'All of UB', 'joined' => true, 'shopping' => true, 'automatic' => true],
            ['community_id' => $keller, 'name' => 'Keller Properties LLC', 'joined' => false, 'shopping' => false, 'automatic' => false],
        ], $this->listed());
        $this->assertSame([], $this->rowsOf($this->studentId), 'All of UB needs no row.');
    }

    public function testPendingApplicationsAreNotCommunitiesYet(): void
    {
        TestDatabase::addRequest($this->pdo, ['business_name' => 'Pending Place']);
        TestDatabase::addRequest($this->pdo, ['business_name' => 'all of ub']);

        $this->assertSame([], $this->listed());
    }

    public function testPartnersWithTheSameBusinessNameShareOneCommunity(): void
    {
        $first = $this->approvedCommunity('Keller Properties LLC');
        $this->approvedCommunity('keller properties llc ');
        $riverside = $this->approvedCommunity('Riverside Apartments');

        $this->assertSame([$first, $riverside], array_column($this->listed(), 'community_id'));
        $this->assertSame(['Keller Properties LLC', 'Riverside Apartments'], array_column($this->listed(), 'name'));
    }

    // ---- Joining several communities ----

    public function testJoiningAddsTheCommunityAndShopsFromIt(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');

        [$status, $body] = $this->join($keller);

        $this->assertSame(200, $status);
        $this->assertSame('{"success":true,"community_id":' . $keller . ',"community_name":"Keller Properties LLC"}', json_encode($body));
        $this->assertSame([$keller => true], $this->rowsOf($this->studentId));
        $this->assertSame([['community_id' => $keller, 'name' => 'Keller Properties LLC']], karavan_joined_communities($this->pdo, $this->studentId));
    }

    public function testAUserCanBeInSeveralCommunitiesAtOnce(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $riverside = $this->approvedCommunity('Riverside Apartments');

        $this->join($keller);
        [$status, $body] = $this->join($riverside);

        $this->assertSame(200, $status);
        $this->assertSame(['success' => true, 'community_id' => $riverside, 'community_name' => 'Riverside Apartments'], $body);
        $this->assertSame([$keller => true, $riverside => true], $this->rowsOf($this->studentId));
        $this->assertSame([true, true], array_column($this->listed(), 'joined'));
    }

    public function testJoiningTwiceChangesNothing(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $riverside = $this->approvedCommunity('Riverside Apartments');
        $this->join($keller);
        $this->join($riverside);
        karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => [$riverside]]);

        [$status] = $this->join($keller);

        $this->assertSame(200, $status);
        $this->assertSame([$keller => false, $riverside => true], $this->rowsOf($this->studentId), 'Rejoining keeps the shopping choice.');
    }

    public function testJoiningAPartnerWithASharedNameJoinsTheListedCommunity(): void
    {
        $first = $this->approvedCommunity('Keller Properties LLC');
        $second = $this->approvedCommunity('keller properties llc ');

        [, $body] = $this->join($second);

        $this->assertSame($first, $body['community_id']);
        $this->assertSame([$first => true], $this->rowsOf($this->studentId));
    }

    public function testJoiningAllOfUbIsAlreadyDone(): void
    {
        $allOfUb = $this->approvedCommunity('All of UB');

        [$status, $body] = $this->join($allOfUb);

        $this->assertSame([200, ['success' => true, 'community_id' => $allOfUb, 'community_name' => 'All of UB']], [$status, $body]);
        $this->assertSame([], $this->rowsOf($this->studentId));
    }

    public static function badCommunityIds(): array
    {
        return [
            'nonexistent'   => [['community_id' => 999999]],
            'not a number'  => [['community_id' => 'abc']],
            'zero'          => [['community_id' => 0]],
            'true'          => [['community_id' => true]],
            'missing'       => [[]],
            'not an object' => ['nope'],
        ];
    }

    #[DataProvider('badCommunityIds')]
    public function testUnknownCommunityReturns404AndChangesNothing($input): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $this->join($keller);

        $this->assertSame([404, self::NOT_FOUND], karavan_join_community($this->pdo, $this->studentId, $input));
        $this->assertSame([$keller => true], $this->rowsOf($this->studentId));
    }

    public function testPendingApplicationCannotBeJoined(): void
    {
        $pending = TestDatabase::addRequest($this->pdo, ['business_name' => 'Pending Place']);

        $this->assertSame([404, self::NOT_FOUND], $this->join($pending));
        $this->assertSame([], $this->rowsOf($this->studentId));
    }

    // ---- Leaving ----

    public function testLeavingOneCommunityKeepsTheOthers(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $riverside = $this->approvedCommunity('Riverside Apartments');
        $this->join($keller);
        $this->join($riverside);

        [$status, $body] = karavan_leave_community($this->pdo, $this->studentId, ['community_id' => $keller]);

        $this->assertSame([200, ['success' => true, 'community_id' => $keller, 'community_name' => 'Keller Properties LLC']], [$status, $body]);
        $this->assertSame([$riverside => true], $this->rowsOf($this->studentId));
    }

    public function testLeavingWithoutACommunityIdLeavesEveryJoinedCommunity(): void
    {
        $this->approvedCommunity('All of UB');
        $this->join($this->approvedCommunity('Keller Properties LLC'));
        $this->join($this->approvedCommunity('Riverside Apartments'));

        [$status, $body] = karavan_leave_community($this->pdo, $this->studentId);

        $this->assertSame([200, ['success' => true, 'community_id' => null, 'community_name' => null]], [$status, $body]);
        $this->assertSame([], karavan_joined_communities($this->pdo, $this->studentId));
        $this->assertSame([true], array_column(array_filter($this->listed(), fn ($c) => $c['joined']), 'automatic'));
    }

    public function testLeavingACommunityYouAreNotInStillSucceeds(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');

        [$status] = karavan_leave_community($this->pdo, $this->studentId, ['community_id' => $keller]);

        $this->assertSame(200, $status);
        $this->assertSame([], $this->rowsOf($this->studentId));
    }

    public function testAllOfUbCannotBeLeft(): void
    {
        $allOfUb = $this->approvedCommunity('All of UB');

        $this->assertSame(
            [400, ['success' => false, 'error' => "Everyone is a member of All of UB, so it can't be left."]],
            karavan_leave_community($this->pdo, $this->studentId, ['community_id' => $allOfUb])
        );
    }

    public function testLeavingOnlyAffectsThatUser(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $otherId = TestDatabase::addUser($this->pdo, 'other.student', 'user', 'other.student@test.com');
        $this->join($keller);
        $this->join($keller, $otherId);

        karavan_leave_community($this->pdo, $this->studentId, ['community_id' => $keller]);

        $this->assertSame([$keller => true], $this->rowsOf($otherId));
    }

    public function testLeavingTheOnlyCommunityYouShopFromGoesBackToAllOfUb(): void
    {
        $allOfUb = $this->approvedCommunity('All of UB');
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $this->join($keller);
        karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => [$keller]]);

        karavan_leave_community($this->pdo, $this->studentId, ['community_id' => $keller]);

        $this->assertSame([$allOfUb], array_column(array_filter($this->listed(), fn ($c) => $c['shopping']), 'community_id'));
    }

    // ---- Story 1: choosing which communities to shop from ----

    public function testShopperChoosesWhichJoinedCommunitiesToShopFrom(): void
    {
        $allOfUb = $this->approvedCommunity('All of UB');
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $riverside = $this->approvedCommunity('Riverside Apartments');
        $this->join($keller);
        $this->join($riverside);

        [$status, $body] = karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => [$riverside, $keller]]);

        $this->assertSame(200, $status);
        $this->assertSame('{"success":true,"shopping_community_ids":[' . $keller . ',' . $riverside . ']}', json_encode($body));
        $this->assertSame(
            [$allOfUb => false, $keller => true, $riverside => true],
            array_column($this->listed(), 'shopping', 'community_id')
        );
    }

    public function testShopperCanSwitchAllOfUbBackOn(): void
    {
        $allOfUb = $this->approvedCommunity('All of UB');
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $this->join($keller);
        karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => [$keller]]);

        [$status] = karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => [$allOfUb]]);

        $this->assertSame(200, $status);
        $this->assertSame([$allOfUb => true, $keller => false], array_column($this->listed(), 'shopping', 'community_id'));
        $this->assertSame([$keller => false], $this->rowsOf($this->studentId));
    }

    public function testCannotShopFromACommunityYouHaveNotJoined(): void
    {
        $allOfUb = $this->approvedCommunity('All of UB');
        $keller = $this->approvedCommunity('Keller Properties LLC');

        $this->assertSame([403, self::NOT_JOINED], karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => [$allOfUb, $keller]]));
        $this->assertSame([403, self::NOT_JOINED], karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => [999999]]));
        $this->assertSame([], $this->rowsOf($this->studentId), 'Nothing changes.');
    }

    public function testMustShopFromAtLeastOneCommunity(): void
    {
        $this->approvedCommunity('All of UB');

        $this->assertSame(
            [400, ['success' => false, 'error' => 'Select at least one community to shop from.']],
            karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => []])
        );
    }

    public static function badShoppingInput(): array
    {
        return [
            'missing'        => [[]],
            'not a list'     => [['community_ids' => '1,2']],
            'keyed object'   => [['community_ids' => ['a' => 1]]],
            'not a number'   => [['community_ids' => ['abc']]],
            'nested list'    => [['community_ids' => [[1]]]],
            'not an object'  => ['nope'],
        ];
    }

    #[DataProvider('badShoppingInput')]
    public function testMalformedShoppingInputReturns400($input): void
    {
        $this->assertSame(
            [400, ['success' => false, 'error' => 'community_ids must be a list of community ids.']],
            karavan_set_shopping_communities($this->pdo, $this->studentId, $input)
        );
    }

    // ---- Story 2: shoppers only see listings from their communities ----

    public function testShoppersSeeOnlyListingsFromCommunitiesTheyShopFrom(): void
    {
        $this->approvedCommunity('All of UB');
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $this->approvedCommunity('Riverside Apartments');

        $this->assertSame(['All of UB'], karavan_member_listing_communities($this->pdo, $this->studentId, true));

        $this->join($keller);
        $this->assertSame(['All of UB', 'Keller Properties LLC'], karavan_member_listing_communities($this->pdo, $this->studentId, true));

        karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => [$keller]]);
        $this->assertSame(['Keller Properties LLC'], karavan_member_listing_communities($this->pdo, $this->studentId, true));
        $this->assertSame(['All of UB', 'Keller Properties LLC'], karavan_member_listing_communities($this->pdo, $this->studentId), 'Still a member of both.');
    }

    public function testAllOfUbListingsStayVisibleWithoutAnApprovedAllOfUbPartner(): void
    {
        $this->assertSame(['All of UB'], karavan_member_listing_communities($this->pdo, $this->studentId, true));
    }

    public function testListingCommunityMatchesExactlyAndIncludesSharedNames(): void
    {
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $this->approvedCommunity('keller properties llc ');
        $this->join($keller);

        $names = karavan_member_listing_communities($this->pdo, $this->studentId);
        $this->assertContains('Keller Properties LLC', $names);
        $this->assertContains('keller properties llc ', $names);
        $this->assertNotContains('KELLER PROPERTIES LLC', $names);
    }

    public function testOnlyMembersAndTheOwnerCanShopAListing(): void
    {
        $this->approvedCommunity('All of UB');
        $keller = $this->approvedCommunity('Keller Properties LLC');
        $sellerId = TestDatabase::addUser($this->pdo, 'sam.seller', 'user', 'sam.seller@test.com');
        $kellerListing = ['owner_id' => $sellerId, 'community' => 'Keller Properties LLC'];

        $this->assertFalse(karavan_can_shop_listing($this->pdo, $this->studentId, $kellerListing));
        $this->assertTrue(karavan_can_shop_listing($this->pdo, $sellerId, $kellerListing), 'Owners always see their own listing.');
        $this->assertTrue(karavan_can_shop_listing($this->pdo, $this->studentId, ['owner_id' => $sellerId, 'community' => 'All of UB']));
        $this->assertFalse(karavan_can_shop_listing($this->pdo, $this->studentId, ['owner_id' => $sellerId, 'community' => null]));

        $this->join($keller);
        $this->assertTrue(karavan_can_shop_listing($this->pdo, $this->studentId, $kellerListing));

        karavan_set_shopping_communities($this->pdo, $this->studentId, ['community_ids' => [$keller]]);
        $this->assertTrue(
            karavan_can_shop_listing($this->pdo, $this->studentId, ['owner_id' => $sellerId, 'community' => 'All of UB']),
            'Turning a community off only hides it from search; members can still open its items.'
        );
    }

    // ---- Access ----

    public static function everyRole(): array
    {
        return ['user' => ['user'], 'admin' => ['admin'], 'moderator' => ['moderator']];
    }

    #[DataProvider('everyRole')]
    public function testAnyLoggedInUserCanListJoinAndChoose(string $role): void
    {
        $userId = TestDatabase::addUser($this->pdo, "someone.$role", $role);
        $keller = $this->approvedCommunity('Keller Properties LLC');

        $this->assertSame(200, karavan_list_communities($this->pdo, $userId)[0]);
        $this->assertSame(200, $this->join($keller, $userId)[0]);
        $this->assertSame(200, karavan_set_shopping_communities($this->pdo, $userId, ['community_ids' => [$keller]])[0]);
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
        $this->assertSame([403, self::FORBIDDEN], karavan_leave_community($this->pdo, $userId, ['community_id' => $keller]));
        $this->assertSame([403, self::FORBIDDEN], karavan_set_shopping_communities($this->pdo, $userId, ['community_ids' => [$keller]]));
    }
}
