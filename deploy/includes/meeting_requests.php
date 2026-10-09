<?php
// Business logic for buyer meeting requests. Every function returns
// [httpStatus, responseBody] so the endpoints in api/ stay thin.

const KARAVAN_NOT_LOGGED_IN_ERROR = 'You must be logged in.';
const KARAVAN_LISTING_NOT_FOUND_ERROR = 'Listing not found.';

// "Today" for the future-date check is the campus date, not the server's default timezone.
const KARAVAN_MEETING_TIMEZONE = 'America/New_York';

function karavan_not_logged_in(): array
{
    return [401, ['success' => false, 'error' => KARAVAN_NOT_LOGGED_IN_ERROR]];
}

/** Sends the response without escaping "/" so image paths read exactly as stored. */
function karavan_send_meeting_json(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** Returns the id as an int, or null unless it is a whole number of 1 or more. */
function karavan_parse_positive_id($value): ?int
{
    if (is_bool($value) || is_array($value) || $value === null) {
        return null;
    }
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    return $id === false ? null : $id;
}

/** Only active listings can be viewed or requested; sold, inactive, and missing ones return null. */
function karavan_find_active_listing(PDO $pdo, int $listingId): ?array
{
    $stmt = $pdo->prepare("SELECT listing_id, owner_id FROM listings WHERE listing_id = ? AND status = 'active'");
    $stmt->execute([$listingId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function karavan_format_meeting_request(array $row): array
{
    $imageUrl = $row['image_url'] ?? null;

    return [
        'listing_id'   => (int) $row['listing_id'],
        'name'         => $row['name'],
        'price'        => number_format((float) $row['price'], 2, '.', ''),
        'image_url'    => ($imageUrl === null || trim($imageUrl) === '') ? null : $imageUrl,
        'meeting_date' => $row['meeting_date'],
        'meeting_time' => substr($row['meeting_time'], 0, 5),
        'location'     => $row['location_label'],
        'status'       => $row['status'],
    ];
}

const KARAVAN_MEETING_REQUEST_SELECT =
    'SELECT r.listing_id, l.name, l.price, l.image_url, r.meeting_date, r.meeting_time,
            r.location_label, r.status
       FROM meeting_requests r
       JOIN listings l ON l.listing_id = r.listing_id';

function karavan_list_my_meeting_requests(PDO $pdo, ?int $userId): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    $stmt = $pdo->prepare(KARAVAN_MEETING_REQUEST_SELECT . ' WHERE r.buyer_id = ? ORDER BY r.created_at ASC, r.request_id ASC');
    $stmt->execute([$userId]);

    return [200, ['success' => true, 'requests' => array_map('karavan_format_meeting_request', $stmt->fetchAll())]];
}

function karavan_list_meeting_locations(PDO $pdo, ?int $userId): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    $stmt = $pdo->query('SELECT id, label FROM approved_locations ORDER BY created_at ASC, id ASC');

    $locations = [];
    foreach ($stmt->fetchAll() as $row) {
        $locations[] = ['location_id' => (int) $row['id'], 'label' => $row['label']];
    }

    return [200, ['success' => true, 'locations' => $locations]];
}

function karavan_get_listing_ownership(PDO $pdo, ?int $userId, $listingIdInput): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    $listingId = karavan_parse_positive_id($listingIdInput);
    if ($listingId === null) {
        return [400, ['success' => false, 'error' => 'A valid listing_id is required.']];
    }

    $listing = karavan_find_active_listing($pdo, $listingId);
    if ($listing === null) {
        return [404, ['success' => false, 'error' => KARAVAN_LISTING_NOT_FOUND_ERROR]];
    }

    $isOwner = $listing['owner_id'] !== null && (int) $listing['owner_id'] === $userId;
    return [200, ['success' => true, 'listing_id' => $listingId, 'is_owner' => $isOwner]];
}

/** Returns an error message for the meeting date, or null when it is a real date after today. */
function karavan_meeting_date_error($value): ?string
{
    if (!is_string($value) || trim($value) === '') {
        return 'A date is required.';
    }
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $parts)
        || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
        return 'Enter a valid date.';
    }
    $today = (new DateTimeImmutable('now', new DateTimeZone(KARAVAN_MEETING_TIMEZONE)))->format('Y-m-d');
    if ($value <= $today) {
        return 'The meeting date must be in the future.';
    }
    return null;
}

/** Returns an error message for the meeting time, or null when it is a 24-hour HH:MM time. */
function karavan_meeting_time_error($value): ?string
{
    if (!is_string($value) || trim($value) === '') {
        return 'A time is required.';
    }
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value)) {
        return 'Enter a valid time.';
    }
    return null;
}

function karavan_create_meeting_request(PDO $pdo, ?int $userId, $input): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }
    $input = is_array($input) ? $input : [];

    $listingId = karavan_parse_positive_id($input['listing_id'] ?? null);
    if ($listingId === null) {
        return [400, ['success' => false, 'error' => 'A valid listing_id is required.']];
    }

    $listing = karavan_find_active_listing($pdo, $listingId);
    if ($listing === null) {
        return [404, ['success' => false, 'error' => KARAVAN_LISTING_NOT_FOUND_ERROR]];
    }
    if ($listing['owner_id'] !== null && (int) $listing['owner_id'] === $userId) {
        return [403, ['success' => false, 'error' => 'You cannot request your own item.']];
    }

    $locationInput = $input['location_id'] ?? null;
    if ($locationInput === null || $locationInput === '') {
        return [400, ['success' => false, 'error' => 'A meeting location is required.']];
    }
    $location = null;
    $locationId = karavan_parse_positive_id($locationInput);
    if ($locationId !== null) {
        $stmt = $pdo->prepare('SELECT id, label FROM approved_locations WHERE id = ?');
        $stmt->execute([$locationId]);
        $location = $stmt->fetch() ?: null;
    }
    if ($location === null) {
        return [400, ['success' => false, 'error' => 'Select an approved meeting location.']];
    }

    $dateError = karavan_meeting_date_error($input['meeting_date'] ?? null);
    if ($dateError !== null) {
        return [400, ['success' => false, 'error' => $dateError]];
    }
    $timeError = karavan_meeting_time_error($input['meeting_time'] ?? null);
    if ($timeError !== null) {
        return [400, ['success' => false, 'error' => $timeError]];
    }

    // A denied request doesn't count, so the buyer can try again with new details.
    $existing = $pdo->prepare("SELECT 1 FROM meeting_requests WHERE buyer_id = ? AND listing_id = ? AND status <> 'denied' LIMIT 1");
    $existing->execute([$userId, $listingId]);
    if ($existing->fetch()) {
        return [409, ['success' => false, 'error' => 'You already have a meeting request for this item.']];
    }

    try {
        $insert = $pdo->prepare(
            "INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')"
        );
        $insert->execute([$userId, $listingId, $input['meeting_date'], $input['meeting_time'] . ':00', (int) $location['id'], $location['label']]);
        $requestId = (int) $pdo->lastInsertId();

        $created = $pdo->prepare(KARAVAN_MEETING_REQUEST_SELECT . ' WHERE r.request_id = ?');
        $created->execute([$requestId]);
        $row = $created->fetch();
    } catch (PDOException $e) {
        return [500, ['success' => false, 'error' => 'Could not save the meeting request.']];
    }

    return [201, ['success' => true, 'request' => karavan_format_meeting_request($row)]];
}
