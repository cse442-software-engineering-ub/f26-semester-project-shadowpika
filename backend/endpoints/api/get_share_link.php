<?php
// GET /api/get_share_link.php?listing_id=<id> — the relative link (item.html?listing_id=<id>) to share for a
// listing the logged-in user can open. Missing and inactive listings are "Listing not found.", a community
// the user is not in is 403, and a sold listing is 410. The link is built only from the validated listing id.
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

    karavan_send_meeting_json(200, [
        'success' => true,
        'listing_id' => $listingId,
        'share_path' => 'item.html?listing_id=' . $listingId,
    ]);
} catch (Throwable $e) {
    // Never expose the underlying PHP/SQL error to the client
    karavan_send_meeting_json(500, ['success' => false, 'error' => 'Server error.']);
}
