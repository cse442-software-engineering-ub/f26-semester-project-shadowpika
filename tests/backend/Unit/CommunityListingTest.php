<?php
namespace Karavan\Tests\Unit;

use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

final class CommunityListingTest extends TestCase
{
    private PDO $pdo;
    private int $userId;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->userId = TestDatabase::addUser($this->pdo, 'listing.student');

        TestDatabase::addRequest($this->pdo, [
            'business_name' => 'All of UB',
            'status' => 'approved',
        ]);
        TestDatabase::addRequest($this->pdo, [
            'business_name' => 'Keller Properties LLC',
            'status' => 'approved',
        ]);
        TestDatabase::addRequest($this->pdo, [
            'business_name' => 'all of ub',
            'status' => 'pending',
        ]);
    }

    public function testListsOnlyLocationsFromTheExactApprovedCommunity(): void
    {
        $capen = TestDatabase::addLocation(
            $this->pdo,
            43.000822,
            -78.789203,
            'Capen Hall Main Entrance',
            null,
            'All of UB'
        );
        TestDatabase::addLocation(
            $this->pdo,
            42.999,
            -78.788,
            'Keller Office',
            null,
            'Keller Properties LLC'
        );

        [$status, $body] = karavan_list_meeting_locations($this->pdo, $this->userId, 'All of UB');

        $this->assertSame(200, $status);
        $this->assertSame([
            'success' => true,
            'locations' => [[
                'location_id' => $capen,
                'label' => 'Capen Hall Main Entrance',
            ]],
        ], $body);
    }

    public function testRejectsMissingMalformedPendingAndWrongCaseCommunities(): void
    {
        $this->assertSame(400, karavan_list_meeting_locations($this->pdo, $this->userId, null)[0]);
        $this->assertSame(400, karavan_list_meeting_locations($this->pdo, $this->userId, [])[0]);
        $this->assertSame(404, karavan_list_meeting_locations($this->pdo, $this->userId, 'all of ub')[0]);
        $this->assertSame(404, karavan_list_meeting_locations($this->pdo, $this->userId, 'ALL OF UB')[0]);
        $this->assertSame(404, karavan_list_meeting_locations($this->pdo, $this->userId, 'Missing Community')[0]);
    }

    public function testApprovedCommunityWithNoLocationsReturnsAnEmptyList(): void
    {
        $this->assertSame(
            [200, ['success' => true, 'locations' => []]],
            karavan_list_meeting_locations($this->pdo, $this->userId, 'Keller Properties LLC')
        );
    }

    public function testCreateListingValidationRequiresCommunityAndLocationId(): void
    {
        $valid = $this->validListingInput();
        $result = validate_create_listing($valid);

        $this->assertSame([], $result['errors']);
        $this->assertSame('All of UB', $result['data']['community']);
        $this->assertSame(91001, $result['data']['meeting_location_id']);

        unset($valid['community'], $valid['meeting_location_id']);
        $missing = validate_create_listing($valid);
        $this->assertArrayHasKey('community', $missing['errors']);
        $this->assertArrayHasKey('meeting_location_id', $missing['errors']);
    }

    public function testCreateListingValidationRejectsInvalidLocationIds(): void
    {
        foreach ([0, -1, 'abc', [], true] as $invalidId) {
            $input = $this->validListingInput();
            $input['meeting_location_id'] = $invalidId;
            $this->assertArrayHasKey(
                'meeting_location_id',
                validate_create_listing($input)['errors'],
                'Invalid ID was accepted: ' . json_encode($invalidId)
            );
        }
    }

    private function validListingInput(): array
    {
        return [
            'title' => 'Calculus Textbook',
            'category' => 'Textbooks',
            'condition' => 'Good',
            'price' => '35.00',
            'related_course' => 'MTH 141',
            'community' => 'All of UB',
            'meeting_location_id' => 91001,
            'description' => 'Used for one semester.',
            'image_url' => 'listing/api/image.php?file=0123456789abcdef0123456789abcdef.jpg',
        ];
    }
}
