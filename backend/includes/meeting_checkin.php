<?php
// #206: device coordinates are evidence supplied by the browser, not GPS attestation.
// Never persist or log device coordinates. Keep each participant's first server timestamp.
require_once __DIR__ . '/meeting_requests.php';

const KARAVAN_CHECKIN_RADIUS_M = 100;
const KARAVAN_CHECKIN_ACCURACY_M = 100;
const KARAVAN_CHECKIN_EARTH_RADIUS_M = 6371000;

function karavan_checkin_error(int $status, string $code, string $message): array
{
    return [$status, ['success' => false, 'code' => $code, 'error' => $message]];
}

function karavan_checkin_now(?DateTimeImmutable $now): DateTimeImmutable
{
    return ($now ?? new DateTimeImmutable('now'))->setTimezone(new DateTimeZone('UTC'));
}

function karavan_checkin_iso(DateTimeImmutable $date): string
{
    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
}

function karavan_checkin_number($value): bool
{
    return (is_int($value) || is_float($value)) && is_finite((float) $value);
}

function karavan_checkin_distance(float $lat, float $lng, float $targetLat, float $targetLng): float
{
    $a = sin(deg2rad($targetLat - $lat) / 2) ** 2
        + cos(deg2rad($lat)) * cos(deg2rad($targetLat)) * sin(deg2rad($targetLng - $lng) / 2) ** 2;
    return 2 * KARAVAN_CHECKIN_EARTH_RADIUS_M * asin(sqrt(max(0, min(1, $a))));
}

function karavan_checkin_find(PDO $pdo, int $userId, int $requestId, bool $lock = false): ?array
{
    if ($lock && $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
        // Match the Sold path's lock order: listing first, then its meeting.
        $probe = $pdo->prepare('SELECT r.listing_id FROM meeting_requests r JOIN listings l ON l.listing_id = r.listing_id
            WHERE r.request_id = ? AND (r.buyer_id = ? OR l.owner_id = ?) AND r.buyer_id <> l.owner_id');
        $probe->execute([$requestId, $userId, $userId]);
        $listingId = $probe->fetchColumn();
        if ($listingId === false) return null;
        $listingLock = $pdo->prepare('SELECT listing_id FROM listings WHERE listing_id = ? FOR UPDATE');
        $listingLock->execute([$listingId]);
        if ($listingLock->fetchColumn() === false) return null;
    }
    $sql = 'SELECT r.request_id, r.buyer_id, r.listing_id, r.meeting_date, r.meeting_time,
                   r.status, r.location_id, r.location_label, r.checked_in_at, r.seller_checked_in_at,
                   l.owner_id, l.status AS listing_status, l.name, l.price, l.image_url, a.lat, a.lng
              FROM meeting_requests r
              JOIN listings l ON l.listing_id = r.listing_id
              LEFT JOIN approved_locations a ON a.id = r.location_id
             WHERE r.request_id = ? AND (r.buyer_id = ? OR l.owner_id = ?) AND r.buyer_id <> l.owner_id';
    // MySQL locks the authoritative meeting and location until validation and write finish.
    if ($lock && $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') $sql .= ' FOR UPDATE';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$requestId, $userId, $userId]);
    return $stmt->fetch() ?: null;
}

function karavan_checkin_details(array $row, DateTimeImmutable $now, ?int $viewerId = null): array
{
    $timezone = new DateTimeZone(KARAVAN_MEETING_TIMEZONE);
    $meeting = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $row['meeting_date'] . ' ' . $row['meeting_time'], $timezone);
    if (!$meeting || $meeting->format('Y-m-d H:i:s') !== $row['meeting_date'] . ' ' . $row['meeting_time']) {
        throw new RuntimeException('Invalid stored meeting time.');
    }
    $opens = $meeting->modify('-15 minutes');
    $closes = $meeting->modify('+2 hours');
    $location = null;
    if ($row['location_id'] !== null && is_numeric($row['lat']) && is_numeric($row['lng'])
        && is_finite((float) $row['lat']) && is_finite((float) $row['lng'])
        && abs((float) $row['lat']) <= 90 && abs((float) $row['lng']) <= 180
        && trim($row['location_label']) !== '') {
        $location = ['location_id' => (int) $row['location_id'], 'label' => $row['location_label'],
            'lat' => (float) $row['lat'], 'lng' => (float) $row['lng']];
    }
    $role = $viewerId !== null && (int) $row['owner_id'] === $viewerId ? 'seller' : 'buyer';
    $progress = karavan_meeting_progress($row, $role === 'seller');
    $checked = $role === 'seller' ? $progress['seller_checked_in_at'] : $progress['checked_in_at'];
    $state = $checked !== null ? 'checked_in'
        : ($row['status'] !== 'approved' ? 'not_approved'
        : ($row['listing_status'] !== 'active' ? 'listing_unavailable'
        : ($location === null ? 'location_unavailable'
        : ($now < $opens ? 'not_open' : ($now > $closes ? 'closed' : 'open')))));
    return array_merge([
        'request_id' => (int) $row['request_id'], 'listing_id' => (int) $row['listing_id'],
        'name' => $row['name'], 'price' => number_format((float) $row['price'], 2, '.', ''),
        'image_url' => $row['image_url'], 'meeting_date' => $row['meeting_date'],
        'meeting_time' => substr($row['meeting_time'], 0, 5), 'status' => $row['status'],
        'location_label' => $row['location_label'], 'location' => $location,
        'radius_m' => KARAVAN_CHECKIN_RADIUS_M, 'max_accuracy_m' => KARAVAN_CHECKIN_ACCURACY_M,
        'max_age_seconds' => 30, 'timezone' => KARAVAN_MEETING_TIMEZONE,
        'opens_at' => karavan_checkin_iso($opens), 'closes_at' => karavan_checkin_iso($closes),
        'server_now' => karavan_checkin_iso($now), 'checkin_state' => $state,
        'participant_role' => $role, 'self_checked_in_at' => $checked,
    ], $progress);
}

function karavan_checkin_success(array $row, int $userId, DateTimeImmutable $now): array
{
    $meeting = karavan_checkin_details($row, $now, $userId);
    return [200, [
        'success' => true,
        // On submission this is the authenticated caller's first timestamp.
        'checked_in_at' => $meeting['self_checked_in_at'],
        'participant_role' => $meeting['participant_role'],
        'buyer_checked_in_at' => $meeting['buyer_checked_in_at'],
        'seller_checked_in_at' => $meeting['seller_checked_in_at'],
        'both_checked_in' => $meeting['both_checked_in'],
        'can_mark_sold' => $meeting['can_mark_sold'],
    ]];
}

function karavan_get_meeting_checkin(PDO $pdo, ?int $userId, $requestIdInput, ?DateTimeImmutable $now = null): array
{
    if ($userId === null) return karavan_not_logged_in();
    $id = karavan_parse_positive_id($requestIdInput);
    if ($id === null) return karavan_checkin_error(400, 'invalid_request', 'A valid request_id is required.');
    $row = karavan_checkin_find($pdo, $userId, $id);
    if ($row === null) return karavan_checkin_error(404, 'not_found', 'Meeting not found.');
    return [200, ['success' => true, 'meeting' => karavan_checkin_details($row, karavan_checkin_now($now), $userId)]];
}

function karavan_check_in_meeting(PDO $pdo, ?int $userId, $input, ?DateTimeImmutable $now = null): array
{
    if ($userId === null) return karavan_not_logged_in();
    $id = karavan_parse_positive_id(is_array($input) ? ($input['request_id'] ?? null) : null);
    if ($id === null) return karavan_checkin_error(400, 'invalid_request', 'A valid request_id is required.');
    $pdo->beginTransaction();
    try {
        $row = karavan_checkin_find($pdo, $userId, $id, true);
        if ($row === null) return karavan_checkin_error(404, 'not_found', 'Meeting not found.');
        $now = karavan_checkin_now($now);
        if ($row['status'] !== 'approved') return karavan_checkin_error(409, 'not_approved', 'This meeting is not approved.');
        $meeting = karavan_checkin_details($row, $now, $userId);
        // A retried successful request is idempotent even after its coordinates expire.
        if ($meeting['self_checked_in_at'] !== null) return karavan_checkin_success($row, $userId, $now);
        $state = $meeting['checkin_state'];
        if ($state === 'location_unavailable') return karavan_checkin_error(409, $state, 'The agreed meeting location is unavailable.');
        if ($state === 'listing_unavailable') return karavan_checkin_error(409, $state, 'This listing is no longer available.');
        if ($state === 'not_open') return karavan_checkin_error(409, $state, 'Check-in has not opened yet.');
        if ($state === 'closed') return karavan_checkin_error(409, $state, 'Check-in has closed.');
        foreach (['latitude', 'longitude', 'accuracy_m', 'captured_at'] as $key) {
            if (!karavan_checkin_number($input[$key] ?? null)) return karavan_checkin_error(400, 'invalid_location', 'A valid device location is required.');
        }
        if (abs($input['latitude']) > 90 || abs($input['longitude']) > 180 || $input['accuracy_m'] < 0) {
            return karavan_checkin_error(400, 'invalid_location', 'A valid device location is required.');
        }
        $ageMs = (float) $now->format('U.u') * 1000 - $input['captured_at'];
        if ($ageMs > 30000 || $ageMs < -5000) return karavan_checkin_error(422, 'stale_location', 'Get a fresh location reading and try again.');
        if ($input['accuracy_m'] > KARAVAN_CHECKIN_ACCURACY_M) return karavan_checkin_error(422, 'inaccurate_location', 'Location accuracy is too low. Try again with a clearer signal.');
        $distance = karavan_checkin_distance($input['latitude'], $input['longitude'], $meeting['location']['lat'], $meeting['location']['lng']);
        if ($distance > KARAVAN_CHECKIN_RADIUS_M) return karavan_checkin_error(422, 'too_far', 'Move within 100 m of the meeting location.');
        // The authenticated participant selects the column, never a client-supplied role.
        $column = $meeting['participant_role'] === 'seller' ? 'seller_checked_in_at' : 'checked_in_at';
        $stmt = $pdo->prepare("UPDATE meeting_requests SET $column = ? WHERE request_id = ? AND buyer_id = ? AND status = 'approved' AND $column IS NULL");
        $stmt->execute([$now->format('Y-m-d H:i:s.u'), $id, $row['buyer_id']]);
        $saved = karavan_checkin_find($pdo, $userId, $id);
        if ($saved === null || $saved[$column] === null) return karavan_checkin_error(409, 'meeting_changed', 'The meeting changed. Reload and try again.');
        $pdo->commit();
        return karavan_checkin_success($saved, $userId, $now);
    } finally {
        if ($pdo->inTransaction()) $pdo->rollBack();
    }
}
