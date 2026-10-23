<?php
namespace Karavan\Tests\Unit;

use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

final class ListingLocationsTest extends TestCase
{
    private PDO $pdo;
    private int $ownerId;
    private int $locationId;
    private int $listingId;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->ownerId = TestDatabase::addUser($this->pdo, 'map.seller');
        $this->locationId = TestDatabase::addLocation($this->pdo, 43.000822, -78.789203, 'Capen Hall', null, 'Karavan');
        $this->listingId = TestDatabase::addListing($this->pdo, $this->ownerId, [
            'community' => 'Karavan', 'meeting_location' => 'Capen Hall', 'meeting_location_id' => $this->locationId,
        ]);
    }

    public function testFormatsTrustedCoordinatesAsNumbersIncludingZeroAndBoundaryValues(): void
    {
        foreach ([[0, 0], [-90, 180], [90, -180], ['43.000822', '-78.789203']] as [$lat, $lng]) {
            $details = listing_meeting_location_details(
                ['community' => 'Karavan', 'meeting_location_id' => 7],
                ['id' => 7, 'label' => 'Library', 'community' => 'Karavan', 'lat' => $lat, 'lng' => $lng]
            );
            $this->assertSame(['location_id' => 7, 'label' => 'Library', 'lat' => (float) $lat, 'lng' => (float) $lng], $details);
        }
    }

    public function testRejectsUnusableLocationRowsWithoutInventingCoordinates(): void
    {
        $listing = ['community' => 'Karavan', 'meeting_location_id' => 7];
        $location = ['id' => 7, 'label' => 'Library', 'community' => 'Karavan', 'lat' => 43, 'lng' => -78];
        $this->assertNull(listing_meeting_location_details($listing, null));
        foreach ([
            ['id' => 8], ['community' => 'karavan'], ['community' => null], ['label' => ' '],
            ['lat' => null], ['lat' => 'invalid'], ['lat' => true], ['lat' => []],
            ['lat' => INF], ['lat' => NAN], ['lat' => 90.001], ['lng' => -180.001],
        ] as $invalid) {
            $this->assertNull(listing_meeting_location_details($listing, array_merge($location, $invalid)));
        }
        $this->assertNull(listing_meeting_location_details(['community' => null, 'meeting_location_id' => 7], $location));
        $this->assertNull(listing_meeting_location_details(['community' => 'Karavan', 'meeting_location_id' => null], $location));
    }

    public function testUnchangedLocationKeepsItsIdEvenWhenAnotherSpotHasTheSameLabel(): void
    {
        TestDatabase::addLocation($this->pdo, 42, -77, 'Capen Hall', null, 'Karavan');
        $this->assertSame(200, $this->save('Capen Hall'));
        $this->assertSame($this->locationId, $this->savedId());
    }

    public function testChangingTextResolvesOnlyTheExactUniqueLocationInItsCommunity(): void
    {
        $newId = TestDatabase::addLocation($this->pdo, 43.001054, -78.786087, 'Student Union', null, 'Karavan');
        TestDatabase::addLocation($this->pdo, 41, -76, 'Student Union', null, 'Another Community');
        $this->assertSame(200, $this->save('Student Union'));
        $this->assertSame($newId, $this->savedId());
    }

    public function testUnknownAmbiguousInvalidOrWrongCaseTextClearsTheOldPin(): void
    {
        TestDatabase::addLocation($this->pdo, 43, -78, 'Duplicate', null, 'Karavan');
        TestDatabase::addLocation($this->pdo, 44, -79, 'Duplicate', null, 'Karavan');
        TestDatabase::addLocation($this->pdo, 91, -78, 'Invalid Coordinates', null, 'Karavan');
        TestDatabase::addLocation($this->pdo, 43, -78, 'Other Community', null, 'Elsewhere');
        foreach (['Unknown', 'Duplicate', 'Invalid Coordinates', 'Other Community', 'capen hall'] as $label) {
            $this->pdo->exec("UPDATE listings SET meeting_location_id = {$this->locationId}, meeting_location = 'Capen Hall'");
            $this->assertSame(200, $this->save($label));
            $this->assertNull($this->savedId(), $label);
        }
    }

    public function testDeletingAnApprovedLocationClearsOnlyTheReferenceNotTheListingText(): void
    {
        $this->pdo->exec("DELETE FROM approved_locations WHERE id = {$this->locationId}");
        $this->assertNull($this->savedId());
        $this->assertSame('Capen Hall', $this->pdo->query('SELECT meeting_location FROM listings')->fetchColumn());
        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM listings')->fetchColumn());
    }

    private function save(string $label): int
    {
        return update_my_listing($this->pdo, $this->ownerId, [
            'action' => 'save_changes', 'listing_id' => $this->listingId,
            'name' => 'Meeting Map Test Book', 'price' => '25.00', 'category' => 'Textbooks',
            'condition' => 'Good', 'meeting_location' => $label, 'description' => 'Test location edit.',
        ])[0];
    }

    private function savedId(): ?int
    {
        $value = $this->pdo->query("SELECT meeting_location_id FROM listings WHERE listing_id = {$this->listingId}")->fetchColumn();
        return $value === null ? null : (int) $value;
    }
}
