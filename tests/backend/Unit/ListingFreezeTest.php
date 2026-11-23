<?php
namespace Karavan\Tests\Unit;

use DateTimeImmutable;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ListingFreezeTest extends TestCase
{
    private PDO $pdo;
    private int $seller;
    private int $buyer;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->seller = TestDatabase::addUser($this->pdo, 'freeze-seller');
        $this->buyer = TestDatabase::addUser($this->pdo, 'freeze-buyer');
        $this->now = new DateTimeImmutable('2026-11-16T19:00:00Z'); // 2 PM New York.
    }

    private function listing(string $status = 'active', ?int $owner = null): int
    {
        return TestDatabase::addListing($this->pdo, $owner ?? $this->seller, ['status' => $status]);
    }

    private function meeting(int $listing, array $changes = []): int
    {
        return TestDatabase::addMeeting($this->pdo, $this->buyer, $listing, array_merge([
            'meeting_date' => '2026-11-16', 'meeting_time' => '12:00:00',
        ], $changes));
    }

    private function freeze(?int $seller = null): array
    {
        return update_my_listing($this->pdo, $seller ?? $this->seller, ['action' => 'freeze_all'], $this->now);
    }

    private function statusOf(int $id): string
    {
        return $this->pdo->query("SELECT status FROM listings WHERE listing_id = $id")->fetchColumn();
    }

    public function testBulkScopeCancellationHistoryAndCounts(): void
    {
        $ordinary = $this->listing();
        $expired = $this->listing();
        $protected = $this->listing();
        $completed = $this->listing();
        $sold = $this->listing('sold');
        $paused = $this->listing('inactive');
        $other = $this->listing('active', $this->buyer);
        $this->meeting($ordinary, ['status' => 'pending']);
        $this->meeting($ordinary, ['status' => 'location_change_requested']);
        $denied = $this->meeting($ordinary, ['status' => 'denied']);
        $history = $this->meeting($expired, ['meeting_date' => '2026-11-15', 'checked_in_at' => '2026-11-15 17:00:00']);
        $approved = $this->meeting($protected); // Exactly at closing: protected.
        $pendingOnProtected = $this->meeting($protected, ['status' => 'pending']);
        $this->meeting($completed, ['meeting_date' => '2026-11-01',
            'checked_in_at' => '2026-11-01 17:00:00', 'seller_checked_in_at' => '2026-11-01 17:01:00']);

        $this->assertSame([200, ['success' => true, 'frozen_count' => 2, 'skipped_count' => 2,
            'cancelled_request_count' => 2]], $this->freeze());
        foreach ([$ordinary, $expired, $paused] as $id) $this->assertSame('inactive', $this->statusOf($id));
        foreach ([$protected, $completed, $other] as $id) $this->assertSame('active', $this->statusOf($id));
        $this->assertSame('sold', $this->statusOf($sold));
        $ids = array_map('intval', $this->pdo->query('SELECT request_id FROM meeting_requests')->fetchAll(PDO::FETCH_COLUMN));
        foreach ([$denied, $history, $approved, $pendingOnProtected] as $id) $this->assertContains($id, $ids);
        $this->assertCount(5, $ids);
        $this->assertSame(0, $this->freeze()[1]['frozen_count']);
        $this->assertSame(0, $this->freeze()[1]['cancelled_request_count']);
    }

    public static function boundaries(): array
    {
        return [
            'before closing' => ['2026-11-16T18:59:59.999Z', false],
            'at closing' => ['2026-11-16T19:00:00Z', false],
            'after closing' => ['2026-11-16T19:00:00.001Z', true],
        ];
    }

    #[DataProvider('boundaries')]
    public function testClosingBoundaryMatchesCheckin(string $now, bool $eligible): void
    {
        $id = $this->listing();
        $this->meeting($id);
        $clock = new DateTimeImmutable($now);
        $row = get_my_listings($this->pdo, $this->seller, $clock)[1]['results'][0];
        $this->assertSame($eligible, $row['can_freeze']);
        $this->assertSame($eligible ? null : 'approved_meeting', $row['freeze_block_reason']);
        $result = update_my_listing($this->pdo, $this->seller, ['action' => 'freeze_all'], $clock);
        $this->assertSame($eligible ? 1 : 0, $result[1]['frozen_count']);
        $this->assertSame($eligible ? 'inactive' : 'active', $this->statusOf($id));
    }

    public function testFutureAndCompletedMeetingsProtectButSplitCheckinsDoNot(): void
    {
        $future = $this->listing();
        $complete = $this->listing();
        $split = $this->listing();
        $this->meeting($future, ['meeting_date' => '2026-12-18']);
        $this->meeting($complete, ['meeting_date' => '2026-01-01',
            'checked_in_at' => '2026-01-01 17:00:00', 'seller_checked_in_at' => '2026-01-01 17:01:00']);
        $this->meeting($split, ['meeting_date' => '2026-01-01', 'checked_in_at' => '2026-01-01 17:00:00']);
        $this->meeting($split, ['meeting_date' => '2026-01-01', 'seller_checked_in_at' => '2026-01-01 17:01:00']);
        $rows = array_column(get_my_listings($this->pdo, $this->seller, $this->now)[1]['results'], null, 'listing_id');
        $this->assertSame('approved_meeting', $rows[$future]['freeze_block_reason']);
        $this->assertSame('completed_meeting', $rows[$complete]['freeze_block_reason']);
        $this->assertTrue($rows[$split]['can_freeze']);
        $this->assertSame(1, $this->freeze()[1]['frozen_count']);
    }

    public function testListingAvailabilityReadDoesNotChangeMeetings(): void
    {
        $active = $this->listing();
        $paused = $this->listing('inactive');
        $sold = $this->listing('sold');
        $this->meeting($active, ['meeting_date' => '2026-01-01']);
        $before = $this->pdo->query('SELECT * FROM meeting_requests')->fetchAll();
        $rows = array_column(get_my_listings($this->pdo, $this->seller, $this->now)[1]['results'], null, 'listing_id');
        $this->assertTrue($rows[$active]['can_freeze']);
        $this->assertFalse($rows[$paused]['can_freeze']);
        $this->assertFalse($rows[$sold]['can_freeze']);
        $this->assertSame($before, $this->pdo->query('SELECT * FROM meeting_requests')->fetchAll());
    }

    public function testResumeIsOwnedIdempotentAndDoesNotRecreateRequests(): void
    {
        $id = $this->listing();
        $this->meeting($id, ['status' => 'pending']);
        $this->freeze();
        $input = ['action' => 'resume', 'listing_id' => $id];
        $this->assertSame(404, update_my_listing($this->pdo, $this->buyer, $input)[0]);
        $this->assertSame(401, update_my_listing($this->pdo, null, $input)[0]);
        $expected = [200, ['success' => true, 'listing_id' => $id, 'status' => 'active']];
        $this->assertSame($expected, update_my_listing($this->pdo, $this->seller, $input));
        $this->assertSame($expected, update_my_listing($this->pdo, $this->seller, $input));
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM meeting_requests')->fetchColumn());
        $this->assertSame(409, update_my_listing($this->pdo, $this->seller,
            ['action' => 'resume', 'listing_id' => $this->listing('sold')])[0]);
        $this->assertSame(404, update_my_listing($this->pdo, $this->seller, ['action' => 'resume', 'listing_id' => 999999])[0]);
    }

    public function testOwnerCannotBeSelectedByTheCallerAndZeroEligibleIsSafe(): void
    {
        $id = $this->listing();
        $this->assertSame(401, update_my_listing($this->pdo, null, ['action' => 'freeze_all'])[0]);
        $result = update_my_listing($this->pdo, $this->buyer, ['action' => 'freeze_all', 'owner_id' => $this->seller]);
        $this->assertSame(['success' => true, 'frozen_count' => 0, 'skipped_count' => 0, 'cancelled_request_count' => 0], $result[1]);
        $this->assertSame('active', $this->statusOf($id));
    }

    public function testFailureRollsBackEarlierItemsAndDeletedRequests(): void
    {
        $first = $this->listing();
        $second = $this->listing();
        $this->meeting($first, ['status' => 'pending']);
        $this->meeting($second, ['status' => 'location_change_requested']);
        $before = $this->pdo->query('SELECT * FROM meeting_requests')->fetchAll();
        $this->pdo->exec("CREATE TRIGGER fail_freeze BEFORE UPDATE ON listings WHEN NEW.listing_id = $second
            AND NEW.status = 'inactive' BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
        try {
            $this->freeze();
            $this->fail('Expected failure injection.');
        } catch (\PDOException $e) {
            $this->assertStringContainsString('test rollback', $e->getMessage());
        }
        $this->assertFalse($this->pdo->inTransaction());
        $this->assertSame('active', $this->statusOf($first));
        $this->assertSame('active', $this->statusOf($second));
        $this->assertSame($before, $this->pdo->query('SELECT * FROM meeting_requests')->fetchAll());
    }

    public function testStalePurchaseAndResponsesFailAfterFreezeButNewPurchaseWorksAfterResume(): void
    {
        TestDatabase::addRequest($this->pdo, ['business_name' => 'Karavan', 'status' => 'approved']);
        $id = TestDatabase::addListing($this->pdo, $this->seller, ['community' => 'Karavan']);
        $location = TestDatabase::addLocation($this->pdo, 43, -78, 'Baldy 19', $this->seller, 'Karavan');
        $request = $this->meeting($id, ['status' => 'pending']);
        $this->freeze();
        $body = ['listing_id' => $id, 'location_id' => $location, 'meeting_date' => '2099-12-18', 'meeting_time' => '14:00'];
        $this->assertSame(404, karavan_create_meeting_request($this->pdo, $this->buyer, $body)[0]);
        $this->assertSame(404, karavan_respond_meeting_request($this->pdo, $this->seller, ['request_id' => $request, 'action' => 'approve'])[0]);
        update_my_listing($this->pdo, $this->seller, ['action' => 'resume', 'listing_id' => $id]);
        $this->assertSame(201, karavan_create_meeting_request($this->pdo, $this->buyer, $body)[0]);
        $this->assertSame(409, karavan_create_meeting_request($this->pdo, $this->buyer, $body)[0]);
    }
}
