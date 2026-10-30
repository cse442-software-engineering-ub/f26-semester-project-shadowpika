<?php
namespace Karavan\Tests\Unit;

use DateTimeImmutable;
use Karavan\Tests\Support\CheckinFixture;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 3) . '/backend/includes/meeting_checkin.php';

final class MeetingSaleTest extends TestCase
{
    private PDO $pdo;
    private array $ids;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->ids = CheckinFixture::create($this->pdo);
        $this->now = new DateTimeImmutable('2026-11-06T17:00:00Z');
    }

    private function checkin(string $role, array $overrides = []): array
    {
        return karavan_check_in_meeting($this->pdo, $this->ids[$role], array_merge([
            'request_id' => $this->ids['request'], 'latitude' => 43, 'longitude' => -78.78,
            'accuracy_m' => 20, 'captured_at' => (float) $this->now->format('U.u') * 1000,
        ], $overrides), $this->now);
    }

    private function sold(?int $user = null, array $overrides = []): array
    {
        return update_my_listing($this->pdo, $user ?? $this->ids['seller'], array_merge([
            'action' => 'update_status', 'listing_id' => $this->ids['listing'], 'status' => 'sold',
        ], $overrides));
    }

    private function details(string $role): array
    {
        return karavan_get_meeting_checkin($this->pdo, $this->ids[$role], $this->ids['request'], $this->now)[1]['meeting'];
    }

    private function assertOrder(string $first, string $second): void
    {
        $this->assertSame(409, $this->sold()[0]);
        $initial = get_my_listings($this->pdo, $this->ids['seller'])[1]['results'][0];
        $this->assertFalse($initial['can_mark_sold']);
        $one = $this->checkin($first);
        $this->assertSame(200, $one[0]);
        $this->assertSame($first, $one[1]['participant_role']);
        $this->assertFalse($one[1]['both_checked_in']);
        $this->assertSame('open', $this->details($second)['checkin_state']);
        $this->assertNull($this->details($second)['self_checked_in_at']);
        $this->assertSame(409, $this->sold()[0]);
        $this->assertSame('active', $this->pdo->query('SELECT status FROM listings')->fetchColumn());

        $this->now = $this->now->modify('+1 minute');
        $two = $this->checkin($second);
        $this->assertSame(200, $two[0]);
        $this->assertTrue($two[1]['both_checked_in']);
        foreach (['buyer', 'seller'] as $role) {
            $details = $this->details($role);
            $this->assertSame($role, $details['participant_role']);
            $this->assertTrue($details['both_checked_in']);
            $this->assertSame('checked_in', $details['checkin_state']);
            $this->assertSame($details['buyer_checked_in_at'], $details['checked_in_at']);
            $this->assertSame($role === 'seller', $details['can_mark_sold']);
        }
        $buyerList = karavan_list_my_meeting_requests($this->pdo, $this->ids['buyer'])[1]['requests'][0];
        $sellerList = karavan_list_incoming_meeting_requests($this->pdo, $this->ids['seller'])[1]['requests'][0];
        $this->assertSame($buyerList['buyer_checked_in_at'], $sellerList['buyer_checked_in_at']);
        $this->assertSame($buyerList['seller_checked_in_at'], $sellerList['seller_checked_in_at']);
        $this->assertFalse($buyerList['can_mark_sold']);
        $this->assertTrue($sellerList['can_mark_sold']);
        $eligible = get_my_listings($this->pdo, $this->ids['seller'])[1]['results'][0];
        $this->assertTrue($eligible['can_mark_sold']);
        $this->assertSame($this->ids['request'], $eligible['sale_request_id']);
        $this->assertSame('active', $eligible['status']); // No automatic sale.
        $this->assertSame(404, $this->sold($this->ids['buyer'])[0]);

        $before = $this->pdo->query('SELECT * FROM meeting_requests')->fetch();
        $sale = $this->sold(null, ['request_id' => $this->ids['request']]);
        $this->assertSame(200, $sale[0]);
        $this->assertSame('sold', $sale[1]['status']);
        $this->assertSame($this->ids['request'], $sale[1]['request_id']);
        $this->assertSame('sold', $this->pdo->query('SELECT status FROM listings')->fetchColumn());
        $this->assertSame($before, $this->pdo->query('SELECT * FROM meeting_requests')->fetch());
        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM listings')->fetchColumn());
        $this->assertSame(200, $this->sold()[0]);
        $this->assertFalse($this->details('seller')['can_mark_sold']);
        $this->assertFalse(get_my_listings($this->pdo, $this->ids['seller'])[1]['results'][0]['can_mark_sold']);
    }

    public function testBuyerThenSellerUnlocksOnlyTheOwnersExplicitSale(): void
    {
        $this->assertOrder('buyer', 'seller');
    }

    public function testSellerThenBuyerUnlocksOnlyTheOwnersExplicitSale(): void
    {
        $this->assertOrder('seller', 'buyer');
    }

    public function testClientRoleCannotCheckInForTheOtherParticipant(): void
    {
        $seller = $this->checkin('seller', ['role' => 'buyer', 'buyer_id' => $this->ids['buyer']]);
        $this->assertSame(200, $seller[0]);
        $row = $this->pdo->query('SELECT * FROM meeting_requests')->fetch();
        $this->assertNull($row['checked_in_at']);
        $this->assertNotNull($row['seller_checked_in_at']);
        $this->assertSame($seller[1]['checked_in_at'], $this->details('seller')['self_checked_in_at']);
        $this->assertSame(200, $this->checkin('buyer', ['role' => 'seller'])[0]);
        $after = $this->pdo->query('SELECT * FROM meeting_requests')->fetch();
        $this->assertSame($row['seller_checked_in_at'], $after['seller_checked_in_at']);
        $this->assertNotNull($after['checked_in_at']);
    }

    public function testLegacyBuyerTimestampIsPreservedAndDoesNotCountAsSellerArrival(): void
    {
        $old = '2026-11-06 16:58:30.123456';
        $this->pdo->prepare('UPDATE meeting_requests SET checked_in_at = ?')->execute([$old]);
        $this->assertSame(409, $this->sold()[0]);
        $this->assertSame('open', $this->details('seller')['checkin_state']);
        $seller = $this->checkin('seller');
        $this->assertSame(200, $seller[0]);
        $this->assertTrue($seller[1]['both_checked_in']);
        $this->assertSame($old, $this->pdo->query('SELECT checked_in_at FROM meeting_requests')->fetchColumn());
        $this->now = $this->now->modify('+1 day');
        $this->assertSame($seller[1]['checked_in_at'], $this->checkin('seller', ['latitude' => null])[1]['checked_in_at']);
    }

    public function testSellerUsesTheSameLocationTimeAndAccuracyRules(): void
    {
        $this->assertSame('too_far', $this->checkin('seller', ['latitude' => 42])[1]['code']);
        $this->assertSame('inaccurate_location', $this->checkin('seller', ['accuracy_m' => 101])[1]['code']);
        $this->assertSame('stale_location', $this->checkin('seller', ['captured_at' => 0])[1]['code']);
        $this->now = $this->now->modify('-1 hour');
        $this->assertSame('not_open', $this->checkin('seller')[1]['code']);
        $this->assertNull($this->pdo->query('SELECT seller_checked_in_at FROM meeting_requests')->fetchColumn());
    }

    public function testSeparateMeetingsCannotContributeOneCheckinEach(): void
    {
        $otherBuyer = TestDatabase::addUser($this->pdo, 'second-buyer');
        $otherRequest = TestDatabase::addMeeting($this->pdo, $otherBuyer, $this->ids['listing'], [
            'location_id' => $this->ids['location'],
        ]);
        $this->assertSame(200, $this->checkin('seller')[0]);
        $input = ['request_id' => $otherRequest, 'latitude' => 43, 'longitude' => -78.78,
            'accuracy_m' => 20, 'captured_at' => (float) $this->now->format('U.u') * 1000];
        $this->assertSame(200, karavan_check_in_meeting($this->pdo, $otherBuyer, $input, $this->now)[0]);
        $this->assertSame(409, $this->sold()[0]);
        $this->assertFalse(get_my_listings($this->pdo, $this->ids['seller'])[1]['results'][0]['can_mark_sold']);
    }

    public function testUnapprovedAndSelfMeetingsNeverQualify(): void
    {
        $this->pdo->exec("UPDATE meeting_requests SET checked_in_at = '2026-11-06 17:00:00', seller_checked_in_at = '2026-11-06 17:01:00'");
        foreach (['pending', 'denied', 'location_change_requested'] as $status) {
            $this->pdo->prepare('UPDATE meeting_requests SET status = ?')->execute([$status]);
            $this->assertSame(409, $this->sold()[0]);
        }
        $this->pdo->prepare("UPDATE meeting_requests SET status = 'approved', buyer_id = ?")->execute([$this->ids['seller']]);
        $this->assertSame(404, karavan_get_meeting_checkin($this->pdo, $this->ids['seller'], $this->ids['request'], $this->now)[0]);
        $this->assertSame(409, $this->sold()[0]);
    }

    public function testExplicitRequestMustBelongToTheListingAndBeValid(): void
    {
        $this->checkin('buyer'); $this->checkin('seller');
        $another = TestDatabase::addListing($this->pdo, $this->ids['seller']);
        $wrong = TestDatabase::addMeeting($this->pdo, $this->ids['buyer'], $another, [
            'checked_in_at' => '2026-11-06 17:00:00', 'seller_checked_in_at' => '2026-11-06 17:00:00',
        ]);
        $this->assertSame(409, $this->sold(null, ['request_id' => $wrong])[0]);
        foreach ([null, false, [], 0, '1.2'] as $id) $this->assertSame(400, $this->sold(null, ['request_id' => $id])[0]);
        $this->assertSame(200, $this->sold()[0]); // Old listing-only client is still gated safely.
    }

    public function testSoldListingBlocksNewAttendanceButAllowsSavedRetries(): void
    {
        $otherBuyer = TestDatabase::addUser($this->pdo, 'late-buyer');
        $otherRequest = TestDatabase::addMeeting($this->pdo, $otherBuyer, $this->ids['listing'], ['location_id' => $this->ids['location']]);
        $buyer = $this->checkin('buyer'); $this->checkin('seller'); $this->sold();
        $input = ['request_id' => $otherRequest, 'latitude' => 43, 'longitude' => -78.78,
            'accuracy_m' => 20, 'captured_at' => (float) $this->now->format('U.u') * 1000];
        $this->assertSame('listing_unavailable', karavan_check_in_meeting($this->pdo, $otherBuyer, $input, $this->now)[1]['code']);
        $this->assertSame($buyer[1]['checked_in_at'], $this->checkin('buyer')[1]['checked_in_at']);
    }
}
