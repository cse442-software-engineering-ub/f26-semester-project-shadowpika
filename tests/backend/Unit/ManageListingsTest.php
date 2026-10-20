<?php
namespace Karavan\Tests\Unit;

use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

final class ManageListingsTest extends TestCase
{
    private PDO $pdo;
    private int $ownerId;
    private int $otherId;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->ownerId = TestDatabase::addUser($this->pdo, 'owner');
        $this->otherId = TestDatabase::addUser($this->pdo, 'other');
    }

    public function testReturnsOnlyTheLoggedInOwnersListings(): void
    {
        $first = TestDatabase::addListing($this->pdo, $this->ownerId);
        TestDatabase::addListing($this->pdo, $this->otherId, ['name' => 'Not Mine']);

        [$status, $body] = get_my_listings($this->pdo, $this->ownerId);

        $this->assertSame(200, $status);
        $this->assertCount(1, $body['results']);
        $this->assertSame($first, $body['results'][0]['listing_id']);
        $this->assertSame('35.00', $body['results'][0]['price']);
    }

    public function testStatusUpdateOnlyChangesTheOwnersListing(): void
    {
        $mine = TestDatabase::addListing($this->pdo, $this->ownerId);
        $theirs = TestDatabase::addListing($this->pdo, $this->otherId);

        [$mineStatus] = update_my_listing($this->pdo, $this->ownerId, [
            'action' => 'update_status', 'listing_id' => $mine, 'status' => 'sold',
        ]);
        [$theirStatus] = update_my_listing($this->pdo, $this->ownerId, [
            'action' => 'update_status', 'listing_id' => $theirs, 'status' => 'sold',
        ]);

        $this->assertSame(200, $mineStatus);
        $this->assertSame(404, $theirStatus);
        $this->assertSame('sold', $this->statusOf($mine));
        $this->assertSame('active', $this->statusOf($theirs));
    }

    public function testDeleteOnlyRemovesTheOwnersListing(): void
    {
        $mine = TestDatabase::addListing($this->pdo, $this->ownerId);
        $theirs = TestDatabase::addListing($this->pdo, $this->otherId);

        $this->assertSame(404, update_my_listing($this->pdo, $this->ownerId, [
            'action' => 'delete', 'listing_id' => $theirs,
        ])[0]);
        $this->assertSame(200, update_my_listing($this->pdo, $this->ownerId, [
            'action' => 'delete', 'listing_id' => $mine,
        ])[0]);

        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM listings')->fetchColumn());
    }

    public function testSaveChangesValidatesAndUpdatesTheOwnersListing(): void
    {
        $listingId = TestDatabase::addListing($this->pdo, $this->ownerId);
        $input = [
            'action' => 'save_changes',
            'listing_id' => $listingId,
            'name' => 'Updated Book',
            'price' => '40.50',
            'category' => 'Textbooks',
            'condition' => 'Like New',
            'related_course' => 'CSE 442',
            'meeting_location' => 'Student Union · Main entrance',
            'description' => 'Updated description.',
            'image_url' => 'uploads/book.jpg',
        ];

        [$status] = update_my_listing($this->pdo, $this->ownerId, $input);
        $row = $this->pdo->query("SELECT * FROM listings WHERE listing_id = $listingId")->fetch();

        $this->assertSame(200, $status);
        $this->assertSame('Updated Book', $row['name']);
        $this->assertSame('Like New', $row['condition']);
        $this->assertSame('40.5', (string) $row['price']);
    }

    public function testRejectsUnauthenticatedAndInvalidRequests(): void
    {
        $listingId = TestDatabase::addListing($this->pdo, $this->ownerId);

        $this->assertSame(401, get_my_listings($this->pdo, null)[0]);
        $this->assertSame(401, update_my_listing($this->pdo, null, [])[0]);
        $this->assertSame(400, update_my_listing($this->pdo, $this->ownerId, [])[0]);
        $this->assertSame(422, update_my_listing($this->pdo, $this->ownerId, [
            'action' => 'update_status', 'listing_id' => $listingId, 'status' => 'deleted',
        ])[0]);
    }

    private function statusOf(int $listingId): string
    {
        return (string) $this->pdo->query("SELECT status FROM listings WHERE listing_id = $listingId")->fetchColumn();
    }
}
