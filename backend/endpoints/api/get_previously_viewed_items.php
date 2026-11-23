<?php
// GET /api/get_previously_viewed_items.php — the logged-in user's 15 most recently opened items, newest first.
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/recently_viewed.php';

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

try {
    $pdo = karavan_pdo();
    $response = karavan_list_previously_viewed_items($pdo, $userId);
} catch (Throwable $e) {
    // Never expose the underlying PHP/SQL error to the client
    karavan_send_meeting_json(500, ['success' => false, 'error' => 'Server error.']);
}

karavan_send_meeting_json(...$response);
