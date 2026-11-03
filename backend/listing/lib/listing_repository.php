<?php
declare(strict_types=1);

require_once __DIR__ . '/listing_locations.php';

/**
 * Persists a validated listing and returns the row created by MySQL.
 *
 * @param array<string, mixed> $listing
 * @return array<string, mixed>
 */
function create_listing(mysqli $connection, array $listing, ?int $ownerId): array
{
    $title = $listing['title'];
    $category = $listing['category'];
    $condition = $listing['condition'];
    $price = $listing['price'];
    $relatedCourse = $listing['related_course'];
    $community = $listing['community'];
    $meetingLocation = $listing['meeting_location'];
    $meetingLocationId = $listing['meeting_location_id'];
    $description = $listing['description'];
    $imageUrl = $listing['image_url'];

    if ($ownerId !== null && $ownerId > 0) {
        $statement = $connection->prepare(
            "INSERT INTO listings
                (owner_id, name, category, `condition`, price, related_course, community, meeting_location, meeting_location_id, description, image_url, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')"
        );
        $statement->bind_param(
            'isssssssiss',
            $ownerId,
            $title,
            $category,
            $condition,
            $price,
            $relatedCourse,
            $community,
            $meetingLocation,
            $meetingLocationId,
            $description,
            $imageUrl
        );
    } else {
        $statement = $connection->prepare(
            "INSERT INTO listings
                (name, category, `condition`, price, related_course, community, meeting_location, meeting_location_id, description, image_url, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')"
        );
        $statement->bind_param(
            'sssssssiss',
            $title,
            $category,
            $condition,
            $price,
            $relatedCourse,
            $community,
            $meetingLocation,
            $meetingLocationId,
            $description,
            $imageUrl
        );
    }

    $statement->execute();
    $listingId = (int) $connection->insert_id;
    $statement->close();

    $createdListing = find_listing_by_id($connection, $listingId);

    if ($createdListing === null) {
        throw new RuntimeException('The created listing could not be loaded.');
    }

    return $createdListing;
}

/**
 * Loads one listing by its public ID.
 *
 * @return array<string, mixed>|null
 */
function find_listing_by_id(mysqli $connection, int $listingId): ?array
{
    $select = $connection->prepare(
        "SELECT listing_id, owner_id, name, category, `condition`, price,
                related_course, community, meeting_location, meeting_location_id, description, image_url, status,
                created_at, updated_at
           FROM listings
          WHERE listing_id = ?"
    );
    $select->bind_param('i', $listingId);
    $select->execute();
    $createdListing = $select->get_result()->fetch_assoc();
    $select->close();

    if (!$createdListing) {
        return null;
    }

    $location = null;
    if ($createdListing['meeting_location_id'] !== null) {
        $locationId = (int) $createdListing['meeting_location_id'];
        $statement = $connection->prepare('SELECT id, label, lat, lng, community FROM approved_locations WHERE id = ?');
        $statement->bind_param('i', $locationId);
        $statement->execute();
        $location = $statement->get_result()->fetch_assoc() ?: null;
        $statement->close();
    }

    return [
        'listing_id' => (int) $createdListing['listing_id'],
        'owner_id' => $createdListing['owner_id'] === null ? null : (int) $createdListing['owner_id'],
        'title' => $createdListing['name'],
        'name' => $createdListing['name'],
        'category' => $createdListing['category'],
        'condition' => $createdListing['condition'],
        'price' => number_format((float) $createdListing['price'], 2, '.', ''),
        'related_course' => $createdListing['related_course'],
        'community' => $createdListing['community'],
        'meeting_location' => $createdListing['meeting_location'],
        'meeting_location_id' => $createdListing['meeting_location_id'] === null ? null : (int) $createdListing['meeting_location_id'],
        'meeting_location_details' => listing_meeting_location_details($createdListing, $location),
        'description' => $createdListing['description'],
        'image_url' => $createdListing['image_url'],
        'status' => $createdListing['status'],
        'created_at' => $createdListing['created_at'],
        'updated_at' => $createdListing['updated_at'],
    ];
}
