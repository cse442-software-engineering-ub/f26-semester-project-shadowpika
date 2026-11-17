<?php
// GET /api/get_request_count.php?listing_id=<id> — how many purchase requests are open on a listing the
// logged-in user can open (pending, approved, or location_change_requested; denied ones are not counted).
// Missing and inactive listings are "Listing not found.", a community the user is not in is 403, and a sold
// listing is 410. Only the count is returned, never who made the requests.
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/communities.php';
require_once __DIR__ . '/../includes/meeting_requests.php';

ini_set('display_errors', 0);
karavan_send_headers('GET');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    karavan_send_meeting_json(405, ['success' => false, 'error' => 'Method not allowed.']);
}

$userId = karavan_session_user_id();
if ($userId === null) {
    karavan_send_meeting_json(...karavan_not_logged_in());
}

// Only a whole number of 1 or more; "abc", "0", and "92001 OR 1=1" are all rejected here.
$listingId = karavan_parse_positive_id($_GET['listing_id'] ?? null);
if ($listingId === null) {
    karavan_send_meeting_json(400, ['success' => false, 'error' => 'A valid listing_id is required.']);
}

try {
    $pdo = karavan_pdo();
    $stmt = $pdo->prepare(
        "SELECT listing_id, owner_id, community, status
           FROM listings
          WHERE listing_id = ? AND status IN ('active', 'sold')"
    );
    $stmt->execute([$listingId]);
    $row = $stmt->fetch();

    if (!$row) {
        karavan_send_meeting_json(404, ['success' => false, 'error' => 'Listing not found.']);
    }
    if (!karavan_can_shop_listing($pdo, $userId, $row)) {
        karavan_send_meeting_json(403, ['success' => false, 'error' => KARAVAN_NOT_A_MEMBER_ERROR]);
    }
    if ($row['status'] === 'sold') {
        karavan_send_meeting_json(410, ['success' => false, 'error' => 'This item has been sold.']);
    }

    $countStmt = $pdo->prepare(
        "SELECT COUNT(*)
           FROM meeting_requests
          WHERE listing_id = ? AND status IN ('pending', 'approved', 'location_change_requested')"
    );
    $countStmt->execute([$listingId]);

    karavan_send_meeting_json(200, [
        'success' => true,
        'listing_id' => $listingId,
        'request_count' => (int)$countStmt->fetchColumn(),
    ]);
} catch (Throwable $e) {
    // Never expose the underlying PHP/SQL error to the client
    karavan_send_meeting_json(500, ['success' => false, 'error' => 'Server error.']);
}
