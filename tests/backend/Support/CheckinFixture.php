<?php
namespace Karavan\Tests\Support;

use PDO;

// Only for disposable SQLite databases. Never seeds grading accounts or meetings.
final class CheckinFixture
{
    public static function create(PDO $pdo, string $date = '2026-11-06', string $time = '12:00:00'): array
    {
        $buyer = TestDatabase::addUser($pdo, 'checkin-buyer');
        $seller = TestDatabase::addUser($pdo, 'checkin-seller');
        $listing = TestDatabase::addListing($pdo, $seller, ['name' => 'Temporary Check-in Item']);
        $location = TestDatabase::addLocation($pdo, 43.0, -78.78, 'Test Meeting Spot');
        $stmt = $pdo->prepare("INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status) VALUES (?, ?, ?, ?, ?, 'Test Meeting Spot', 'approved')");
        $stmt->execute([$buyer, $listing, $date, $time, $location]);
        return ['buyer' => $buyer, 'seller' => $seller, 'listing' => $listing, 'location' => $location, 'request' => (int) $pdo->lastInsertId()];
    }
}
