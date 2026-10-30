<?php
namespace Karavan\Tests\Unit;

use DateTimeImmutable;
use Karavan\Tests\Support\CheckinFixture;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 3) . '/backend/includes/meeting_checkin.php';

final class MeetingCheckinTest extends TestCase
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

    private function body(array $overrides = []): array
    {
        return array_merge(['request_id' => $this->ids['request'], 'latitude' => 43.0, 'longitude' => -78.78,
            'accuracy_m' => 10, 'captured_at' => (float) $this->now->format('U.u') * 1000], $overrides);
    }

    private function post(array $overrides = []): array
    {
        return karavan_check_in_meeting($this->pdo, $this->ids['buyer'], $this->body($overrides), $this->now);
    }

    public function testReadUsesMeetingLocationAndAddsRequestIdToBuyerList(): void
    {
        [$status, $body] = karavan_get_meeting_checkin($this->pdo, $this->ids['buyer'], $this->ids['request'], $this->now);
        $this->assertSame(200, $status);
        $this->assertSame('open', $body['meeting']['checkin_state']);
        $this->assertSame('Test Meeting Spot', $body['meeting']['location']['label']);
        $this->assertSame(100, $body['meeting']['radius_m']);
        $this->assertSame('2026-11-06T16:45:00.000Z', $body['meeting']['opens_at']);
        $this->assertSame('2026-11-06T19:00:00.000Z', $body['meeting']['closes_at']);
        $list = karavan_list_my_meeting_requests($this->pdo, $this->ids['buyer']);
        $this->assertSame($this->ids['request'], $list[1]['requests'][0]['request_id']);
    }

    public function testAuthenticationAndOwnership(): void
    {
        $this->assertSame(401, karavan_get_meeting_checkin($this->pdo, null, 1)[0]);
        $this->assertSame(401, karavan_check_in_meeting($this->pdo, null, $this->body())[0]);
        $outsider = TestDatabase::addUser($this->pdo, 'checkin-outsider');
        $this->assertSame(404, karavan_get_meeting_checkin($this->pdo, $outsider, $this->ids['request'])[0]);
        $this->assertSame(404, karavan_check_in_meeting($this->pdo, $outsider, $this->body())[0]);
        $this->assertSame(404, $this->post(['request_id' => 99999])[0]);
        foreach ([null, [], true, 0, -1, '1.5', 'bad'] as $id) $this->assertSame(400, $this->post(['request_id' => $id])[0]);
    }

    public function testNonApprovedStatesNeverCheckIn(): void
    {
        foreach (['pending', 'denied', 'location_change_requested'] as $status) {
            $this->pdo->prepare('UPDATE meeting_requests SET status = ?')->execute([$status]);
            $this->assertSame('not_approved', $this->post()[1]['code']);
        }
        $this->assertNull($this->pdo->query('SELECT checked_in_at FROM meeting_requests')->fetchColumn());
    }

    public function testMissingOrInvalidLocationCannotUseListingFallback(): void
    {
        $this->pdo->exec('UPDATE approved_locations SET lat = 91');
        $this->assertSame('location_unavailable', $this->post()[1]['code']);
        $this->pdo->exec('DELETE FROM approved_locations');
        $this->assertSame('location_unavailable', $this->post()[1]['code']);
    }

    public function testTimeWindowIncludesBothEndpoints(): void
    {
        foreach (['2026-11-06T16:44:59.999Z' => 409, '2026-11-06T16:45:00Z' => 200,
            '2026-11-06T19:00:00Z' => 200, '2026-11-06T19:00:00.001Z' => 409] as $time => $expected) {
            $this->pdo->exec('UPDATE meeting_requests SET checked_in_at = NULL');
            $this->now = new DateTimeImmutable($time);
            $this->assertSame($expected, $this->post()[0], $time);
        }
    }

    public function testCampusTimezoneUsesDaylightSavingOffset(): void
    {
        $this->pdo->exec("UPDATE meeting_requests SET meeting_date = '2026-07-06'");
        $body = karavan_get_meeting_checkin($this->pdo, $this->ids['buyer'], 1, new DateTimeImmutable('2026-07-06T16:00:00Z'))[1];
        $this->assertSame('2026-07-06T15:45:00.000Z', $body['meeting']['opens_at']);
    }

    public function testInvalidCoordinatesAndTypesAreRejected(): void
    {
        foreach (['latitude', 'longitude', 'accuracy_m', 'captured_at'] as $key) {
            foreach ([null, [], true, '43', INF, NAN] as $value) {
                $this->assertSame(400, $this->post([$key => $value])[0], $key);
            }
        }
        foreach ([['latitude' => 90.01], ['longitude' => -180.01], ['accuracy_m' => -1]] as $input) {
            $this->assertSame(400, $this->post($input)[0]);
        }
    }

    public function testReadingFreshnessAndClockSkewBoundaries(): void
    {
        $nowMs = (float) $this->now->format('U.u') * 1000;
        foreach ([-30001 => 422, -30000 => 200, 5000 => 200, 5001 => 422] as $offset => $expected) {
            $this->pdo->exec('UPDATE meeting_requests SET checked_in_at = NULL');
            $this->assertSame($expected, $this->post(['captured_at' => $nowMs + $offset])[0]);
        }
    }

    public function testAccuracyAndDistanceBoundaries(): void
    {
        $this->assertSame('inaccurate_location', $this->post(['accuracy_m' => 100.001])[1]['code']);
        // Use an equatorial fixture to avoid latitude cancellation in an exact-radius test.
        $this->pdo->exec('UPDATE approved_locations SET lat = 0, lng = 0');
        foreach ([99.999, 100.0, 100.001] as $meters) {
            $this->pdo->exec('UPDATE meeting_requests SET checked_in_at = NULL');
            $latitude = rad2deg($meters / KARAVAN_CHECKIN_EARTH_RADIUS_M);
            $this->assertSame($meters <= 100 ? 200 : 422, $this->post(['latitude' => $latitude, 'longitude' => 0, 'accuracy_m' => 100])[0]);
        }
    }

    public function testSuccessfulRetryPreservesFirstUtcTimestampAndMeetingState(): void
    {
        $first = $this->post();
        $this->assertSame(200, $first[0]);
        $this->now = $this->now->modify('+1 day');
        $this->assertSame($first, $this->post(['latitude' => null]));
        $row = $this->pdo->query('SELECT * FROM meeting_requests')->fetch();
        $this->assertSame('2026-11-06 17:00:00.000000', $row['checked_in_at']);
        $this->assertSame('approved', $row['status']);
        $this->assertSame('active', $this->pdo->query('SELECT status FROM listings')->fetchColumn());
        $this->assertArrayNotHasKey('latitude', $row);
        $detail = karavan_get_meeting_checkin($this->pdo, $this->ids['buyer'], 1, $this->now)[1]['meeting'];
        $this->assertSame('checked_in', $detail['checkin_state']);
        $this->assertSame($first[1]['checked_in_at'], $detail['checked_in_at']);
    }

    public function testBothParticipantsSeeTheSameProgressWithoutExposingDeviceCoordinates(): void
    {
        foreach (['buyer', 'seller'] as $role) {
            $result = $role === 'buyer'
                ? karavan_list_my_meeting_requests($this->pdo, $this->ids[$role])
                : karavan_list_incoming_meeting_requests($this->pdo, $this->ids[$role]);
            $this->assertNull($result[1]['requests'][0]['checked_in_at']);
        }
        $saved = $this->post()[1]['checked_in_at'];
        foreach (['buyer', 'seller'] as $role) {
            $result = $role === 'buyer'
                ? karavan_list_my_meeting_requests($this->pdo, $this->ids[$role])
                : karavan_list_incoming_meeting_requests($this->pdo, $this->ids[$role]);
            $request = $result[1]['requests'][0];
            $this->assertSame($saved, $request['checked_in_at']);
            $this->assertSame('approved', $request['status']);
            foreach (['latitude', 'longitude', 'accuracy_m', 'captured_at'] as $key) $this->assertArrayNotHasKey($key, $request);
        }
        $outsider = TestDatabase::addUser($this->pdo, 'unrelated-meeting-user');
        $this->assertSame([], karavan_list_incoming_meeting_requests($this->pdo, $outsider)[1]['requests']);
        $this->assertSame([], karavan_list_my_meeting_requests($this->pdo, $outsider)[1]['requests']);
        $this->assertSame(401, karavan_list_incoming_meeting_requests($this->pdo, null)[0]);
        $this->assertSame(401, karavan_list_my_meeting_requests($this->pdo, null)[0]);
    }

    public function testApprovalLocksTheMeetingLocationBeforeAndAfterCheckin(): void
    {
        $this->pdo->exec("UPDATE meeting_requests SET status = 'pending'");
        $id = $this->ids['request'];
        $seller = $this->ids['seller'];
        $other = TestDatabase::addLocation($this->pdo, 42, -78, 'Another spot');
        $approve = karavan_respond_meeting_request($this->pdo, $seller, ['request_id' => $id, 'action' => 'approve']);
        $this->assertSame(200, $approve[0]);
        $this->assertNull($approve[1]['request']['checked_in_at']);
        foreach ([false, true] as $checkedIn) {
            if ($checkedIn) $this->assertSame(200, $this->post()[0]);
            $before = $this->pdo->query('SELECT * FROM meeting_requests')->fetch();
            foreach (['change_location', 'deny', 'approve'] as $action) {
                $response = karavan_respond_meeting_request($this->pdo, $seller,
                    ['request_id' => $id, 'action' => $action, 'location_id' => $other]);
                $this->assertSame(409, $response[0]);
            }
            $this->assertSame($before, $this->pdo->query('SELECT * FROM meeting_requests')->fetch());
        }
    }

    public function testListingLocationChangesDoNotMoveTheApprovedMeeting(): void
    {
        $other = TestDatabase::addLocation($this->pdo, 42, -78, 'Changed listing spot');
        $this->pdo->prepare('UPDATE listings SET meeting_location_id = ?, meeting_location = ?')
            ->execute([$other, 'Changed listing spot']);
        $meeting = karavan_get_meeting_checkin($this->pdo, $this->ids['buyer'], $this->ids['request'], $this->now)[1]['meeting'];
        $this->assertSame($this->ids['location'], $meeting['location']['location_id']);
        $this->assertSame('Test Meeting Spot', $meeting['location_label']);
        $this->assertSame(200, $this->post()[0]);
    }
}
