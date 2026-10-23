<?php
declare(strict_types=1);

/** Return map data only for the listing's own, still-valid approved location. */
function listing_meeting_location_details(array $listing, ?array $location): ?array
{
    if ($location === null || empty($listing['meeting_location_id'])
        || (int) $location['id'] !== (int) $listing['meeting_location_id']
        || !is_string($listing['community'] ?? null) || $listing['community'] === ''
        || ($location['community'] ?? null) !== $listing['community']
        || !is_string($location['label'] ?? null) || trim($location['label']) === '') {
        return null;
    }

    $coordinates = [];
    foreach (['lat' => 90, 'lng' => 180] as $key => $limit) {
        $value = $location[$key] ?? null;
        if (is_bool($value) || !is_numeric($value)) {
            return null;
        }
        $number = (float) $value;
        if (!is_finite($number) || abs($number) > $limit) {
            return null;
        }
        $coordinates[$key] = $number;
    }

    return [
        'location_id' => (int) $location['id'],
        'label' => $location['label'],
        'lat' => $coordinates['lat'],
        'lng' => $coordinates['lng'],
    ];
}

function listing_location_by_id(PDO $pdo, ?int $locationId): ?array
{
    if ($locationId === null) {
        return null;
    }
    $statement = $pdo->prepare('SELECT id, label, lat, lng, community FROM approved_locations WHERE id = ?');
    $statement->execute([$locationId]);
    return $statement->fetch(PDO::FETCH_ASSOC) ?: null;
}

/** Legacy text editing must never leave a map pointing at the previous location. */
function listing_location_for_edit(PDO $pdo, array $listing, string $label): ?int
{
    $existingId = isset($listing['meeting_location_id']) ? (int) $listing['meeting_location_id'] : null;
    if ($label === ($listing['meeting_location'] ?? null)
        && listing_meeting_location_details($listing, listing_location_by_id($pdo, $existingId)) !== null) {
        return $existingId;
    }

    // Compare in PHP as well: database collations may ignore case or trailing spaces.
    $statement = $pdo->prepare('SELECT id, label, lat, lng, community FROM approved_locations WHERE label = ? AND community = ?');
    $statement->execute([$label, $listing['community']]);
    $matches = [];
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $location) {
        if ($location['label'] === $label && $location['community'] === $listing['community']) {
            $matches[] = $location;
        }
    }
    if (count($matches) !== 1) {
        return null;
    }
    $candidate = array_merge($listing, ['meeting_location_id' => $matches[0]['id']]);
    return listing_meeting_location_details($candidate, $matches[0]) === null ? null : (int) $matches[0]['id'];
}
