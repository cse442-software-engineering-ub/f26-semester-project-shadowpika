<?php
// Business logic for admin-managed approved meeting locations. Every function returns
// [httpStatus, responseBody] so the endpoints stay thin and PHPUnit can call these directly.
require_once __DIR__ . '/admin_requests.php';
require_once __DIR__ . '/communities.php';

// Matches approved_locations.label VARCHAR(100).
const KARAVAN_MAX_LOCATION_LABEL = 100;

// Role is re-read from the database on every request, like karavan_is_moderator().
function karavan_is_admin(?array $user): bool
{
    return $user !== null && ($user['role'] ?? null) === 'admin';
}

function karavan_location_community_is_administered(?string $community, array $names): bool
{
    if ($community === null || $community === '' || $names === []) {
        return false;
    }
    $key = karavan_community_key($community);
    foreach ($names as $name) {
        if (karavan_community_key((string) $name) === $key) {
            return true;
        }
    }
    return false;
}

function karavan_list_approved_locations(PDO $pdo, ?int $userId): array
{
    $user = karavan_find_user($pdo, $userId);
    if (!karavan_is_admin($user)) {
        return karavan_forbidden();
    }

    $names = karavan_administered_community_names($pdo, (int) $user['id']);
    $stmt = $pdo->query('SELECT id, lat, lng, label, community FROM approved_locations ORDER BY created_at ASC, id ASC');

    $locations = [];
    foreach ($stmt->fetchAll() as $row) {
        if (!karavan_location_community_is_administered($row['community'] ?? null, $names)) {
            continue;
        }
        $locations[] = [
            'location_id' => (int) $row['id'],
            'lat'         => (float) $row['lat'],
            'lng'         => (float) $row['lng'],
            'label'       => $row['label'],
        ];
    }

    return [200, ['success' => true, 'locations' => $locations]];
}

/** Returns the coordinate as a float, or null when it isn't a number inside [-$limit, $limit]. */
function karavan_parse_coordinate($value, float $limit): ?float
{
    if (is_bool($value) || !is_numeric($value)) {
        return null;
    }
    $number = (float) $value;
    return is_finite($number) && abs($number) <= $limit ? $number : null;
}

function karavan_administered_listed_id_for_input(PDO $pdo, int $userId, $input): ?int
{
    $adminIds = karavan_administered_community_ids($pdo, $userId);
    if ($adminIds === []) {
        return null;
    }
    $communities = karavan_approved_communities($pdo);
    if (is_array($input) && array_key_exists('community_id', $input)) {
        $partnerId = karavan_parse_community_id($input['community_id']);
        $listedId = $partnerId === null ? null : karavan_listed_community_id($communities, $partnerId);
        return ($listedId !== null && in_array($listedId, $adminIds, true)) ? $listedId : null;
    }
    return $adminIds[0];
}

function karavan_add_approved_location(PDO $pdo, ?int $userId, $input): array
{
    $admin = karavan_find_user($pdo, $userId);
    if (!karavan_is_admin($admin)) {
        return karavan_forbidden();
    }
    $listedId = karavan_administered_listed_id_for_input($pdo, (int) $admin['id'], $input);
    if ($listedId === null) {
        return karavan_forbidden();
    }

    $lat = is_array($input) ? karavan_parse_coordinate($input['lat'] ?? null, 90) : null;
    $lng = is_array($input) ? karavan_parse_coordinate($input['lng'] ?? null, 180) : null;
    if ($lat === null || $lng === null) {
        return [400, ['success' => false, 'error' => 'Invalid location coordinates.']];
    }

    $label = is_array($input) && is_string($input['label'] ?? null) ? trim($input['label']) : '';
    if ($label === '') {
        return [400, ['success' => false, 'error' => 'Please enter a location name.']];
    }
    // Counts characters, not bytes, without relying on the mbstring extension (false means invalid UTF-8).
    $labelLength = preg_match_all('/./su', $label);
    if ($labelLength === false || $labelLength > KARAVAN_MAX_LOCATION_LABEL) {
        return [400, ['success' => false, 'error' => 'Location name must be 100 characters or fewer.']];
    }

    $communities = karavan_approved_communities($pdo);
    $communityName = $communities[$listedId]['name'];

    try {
        $insert = $pdo->prepare('INSERT INTO approved_locations (lat, lng, label, created_by, community) VALUES (?, ?, ?, ?, ?)');
        $insert->execute([$lat, $lng, $label, (int) $admin['id'], $communityName]);
        $locationId = (int) $pdo->lastInsertId();
    } catch (PDOException $e) {
        return [500, ['success' => false, 'error' => 'Could not save the location.']];
    }

    return [201, ['success' => true, 'location_id' => $locationId]];
}

function karavan_remove_approved_location(PDO $pdo, ?int $userId, $input): array
{
    $admin = karavan_find_user($pdo, $userId);
    if (!karavan_is_admin($admin)) {
        return karavan_forbidden();
    }

    $locationId = is_array($input) ? filter_var($input['location_id'] ?? null, FILTER_VALIDATE_INT) : false;
    if ($locationId === false || $locationId <= 0) {
        return [400, ['success' => false, 'error' => 'A valid location_id is required.']];
    }

    $find = $pdo->prepare('SELECT id, community FROM approved_locations WHERE id = ?');
    $find->execute([$locationId]);
    $row = $find->fetch();
    if (!$row) {
        return [404, ['success' => false, 'error' => 'Location not found.']];
    }
    $names = karavan_administered_community_names($pdo, (int) $admin['id']);
    if (!karavan_location_community_is_administered($row['community'] ?? null, $names)) {
        return karavan_forbidden();
    }

    try {
        $delete = $pdo->prepare('DELETE FROM approved_locations WHERE id = ?');
        $delete->execute([$locationId]);
    } catch (PDOException $e) {
        return [500, ['success' => false, 'error' => 'Could not remove the location.']];
    }

    if ($delete->rowCount() === 0) {
        return [404, ['success' => false, 'error' => 'Location not found.']];
    }

    return [200, ['success' => true, 'location_id' => $locationId]];
}
