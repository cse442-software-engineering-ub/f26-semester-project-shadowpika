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

function karavan_list_meeting_locations(PDO $pdo, ?int $userId, $communityInput): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    $communityLength = is_string($communityInput)
        ? (function_exists('mb_strlen') ? mb_strlen($communityInput, 'UTF-8') : strlen($communityInput))
        : 0;
    if (!is_string($communityInput) || trim($communityInput) === '' || $communityLength > 255) {
        return [400, ['success' => false, 'error' => 'A valid community is required.']];
    }
    $community = trim($communityInput);

    // Compare in PHP so exact case-sensitive matching is enforced even when MySQL uses a
    // case-insensitive collation. A pending "all of ub" must not match approved "All of UB".
    $approved = $pdo->query("SELECT business_name FROM admin_requests WHERE status = 'approved'");
    $communityExists = false;
    foreach ($approved->fetchAll() as $row) {
        if ((string) $row['business_name'] === $community) {
            $communityExists = true;
            break;
        }
    }
    if (!$communityExists) {
        return [404, ['success' => false, 'error' => 'Community not found.']];
    }

    $stmt = $pdo->query('SELECT id, label, community FROM approved_locations ORDER BY created_at ASC, id ASC');

    $locations = [];
    foreach ($stmt->fetchAll() as $row) {
        if (($row['community'] ?? null) !== $community) {
            continue;
        }
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

/** Deletes the buyer's pending request for the listing. Approved, denied, and changed requests are left alone. */
function karavan_cancel_meeting_request(PDO $pdo, ?int $userId, $input): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }
    $input = is_array($input) ? $input : [];

    $listingId = karavan_parse_positive_id($input['listing_id'] ?? null);
    if ($listingId === null) {
        return [400, ['success' => false, 'error' => 'A valid listing_id is required.']];
    }

    $delete = $pdo->prepare("DELETE FROM meeting_requests WHERE buyer_id = ? AND listing_id = ? AND status = 'pending'");
    $delete->execute([$userId, $listingId]);
    if ($delete->rowCount() === 0) {
        return [404, ['success' => false, 'error' => 'You have no pending meeting request for this item.']];
    }

    return [200, ['success' => true]];
}

// Seller side: requests on listings the logged-in user owns, with the buyer's email.
const KARAVAN_INCOMING_REQUEST_SELECT =
    'SELECT r.request_id, r.listing_id, l.name, l.price, l.image_url, l.community, u.email AS buyer,
            r.meeting_date, r.meeting_time, r.location_id, r.location_label, r.status, l.owner_id
       FROM meeting_requests r
       JOIN listings l ON l.listing_id = r.listing_id
       JOIN users u ON u.id = r.buyer_id';

function karavan_format_incoming_request(array $row): array
{
    $imageUrl = $row['image_url'] ?? null;

    return [
        'request_id'   => (int) $row['request_id'],
        'listing_id'   => (int) $row['listing_id'],
        'name'         => $row['name'],
        'price'        => number_format((float) $row['price'], 2, '.', ''),
        'image_url'    => ($imageUrl === null || trim($imageUrl) === '') ? null : $imageUrl,
        'community'    => $row['community'],
        'buyer'        => $row['buyer'],
        'meeting_date' => $row['meeting_date'],
        'meeting_time' => substr($row['meeting_time'], 0, 5),
        'location'     => $row['location_label'],
        'status'       => $row['status'],
    ];
}

function karavan_list_incoming_meeting_requests(PDO $pdo, ?int $userId): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    $stmt = $pdo->prepare(KARAVAN_INCOMING_REQUEST_SELECT . ' WHERE l.owner_id = ? ORDER BY r.created_at ASC, r.request_id ASC');
    $stmt->execute([$userId]);

    return [200, ['success' => true, 'requests' => array_map('karavan_format_incoming_request', $stmt->fetchAll())]];
}

/** Lets the listing's owner approve, deny, or ask for a new location on a pending request. */
function karavan_respond_meeting_request(PDO $pdo, ?int $userId, $input): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }
    $input = is_array($input) ? $input : [];

    $requestId = karavan_parse_positive_id($input['request_id'] ?? null);
    if ($requestId === null) {
        return [400, ['success' => false, 'error' => 'A valid request_id is required.']];
    }

    $action = $input['action'] ?? null;
    if (!is_string($action) || !in_array($action, ['approve', 'deny', 'change_location'], true)) {
        return [400, ['success' => false, 'error' => 'Action must be approve, deny, or change_location.']];
    }

    $stmt = $pdo->prepare(KARAVAN_INCOMING_REQUEST_SELECT . ' WHERE r.request_id = ?');
    $stmt->execute([$requestId]);
    $row = $stmt->fetch();
    if (!$row) {
        return [404, ['success' => false, 'error' => 'Meeting request not found.']];
    }
    if ($row['owner_id'] === null || (int) $row['owner_id'] !== $userId) {
        return [403, ['success' => false, 'error' => 'You can only respond to requests for your own items.']];
    }
    if ($row['status'] !== 'pending') {
        return [409, ['success' => false, 'error' => 'Only pending requests can be answered.']];
    }

    $newStatus = $action === 'approve' ? 'approved' : ($action === 'deny' ? 'denied' : 'location_change_requested');
    $location = null;
    if ($action === 'change_location') {
        $locationId = karavan_parse_positive_id($input['location_id'] ?? null);
        if ($locationId !== null) {
            $locStmt = $pdo->prepare('SELECT id, label, community FROM approved_locations WHERE id = ?');
            $locStmt->execute([$locationId]);
            $location = $locStmt->fetch() ?: null;
        }
        // Compare the community in PHP so a case-insensitive collation can't match "all of ub" to "All of UB".
        if ($location === null || $row['community'] === null || (string) $location['community'] !== (string) $row['community']) {
            return [400, ['success' => false, 'error' => 'Select an approved meeting location.']];
        }
        if ($row['location_id'] !== null && (int) $location['id'] === (int) $row['location_id']) {
            return [400, ['success' => false, 'error' => 'Select a different meeting location.']];
        }
    }

    try {
        if ($location === null) {
            $update = $pdo->prepare("UPDATE meeting_requests SET status = ? WHERE request_id = ? AND status = 'pending'");
            $update->execute([$newStatus, $requestId]);
        } else {
            $update = $pdo->prepare("UPDATE meeting_requests SET status = ?, location_id = ?, location_label = ? WHERE request_id = ? AND status = 'pending'");
            $update->execute([$newStatus, (int) $location['id'], $location['label'], $requestId]);
        }
        if ($update->rowCount() === 0) {
            return [409, ['success' => false, 'error' => 'Only pending requests can be answered.']];
        }

        $stmt = $pdo->prepare(KARAVAN_INCOMING_REQUEST_SELECT . ' WHERE r.request_id = ?');
        $stmt->execute([$requestId]);
        $row = $stmt->fetch();
    } catch (PDOException $e) {
        return [500, ['success' => false, 'error' => 'Could not save the meeting request.']];
    }

    return [200, ['success' => true, 'request' => karavan_format_incoming_request($row)]];
}
