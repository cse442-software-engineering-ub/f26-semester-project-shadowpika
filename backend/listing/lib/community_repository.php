<?php
declare(strict_types=1);

/**
 * Validates an exact approved community name and resolves a location that belongs to it.
 * The trusted location label returned here is what is stored on the listing.
 *
 * @return array{location: array{id: int, label: string, community: string}|null, errors: array<string, string>}
 */
function validate_listing_community_location(
    mysqli $connection,
    string $community,
    int $meetingLocationId
): array {
    $approved = $connection->query("SELECT business_name FROM admin_requests WHERE status = 'approved'");
    $communityExists = false;
    while ($row = $approved->fetch_assoc()) {
        if ((string) $row['business_name'] === $community) {
            $communityExists = true;
            break;
        }
    }
    $approved->free();

    if (!$communityExists) {
        return [
            'location' => null,
            'errors' => ['community' => 'Select an approved community.'],
        ];
    }

    $statement = $connection->prepare(
        'SELECT id, label, community FROM approved_locations WHERE id = ?'
    );
    $statement->bind_param('i', $meetingLocationId);
    $statement->execute();
    $row = $statement->get_result()->fetch_assoc();
    $statement->close();

    if (!$row || ($row['community'] ?? null) !== $community) {
        return [
            'location' => null,
            'errors' => ['meeting_location_id' => 'Select a meeting location from the selected community.'],
        ];
    }

    return [
        'location' => [
            'id' => (int) $row['id'],
            'label' => (string) $row['label'],
            'community' => (string) $row['community'],
        ],
        'errors' => [],
    ];
}
