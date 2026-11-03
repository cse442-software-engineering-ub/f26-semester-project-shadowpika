<?php
// POST /api/save_favorite.php — saves another student's active listing to the logged-in user's favorites.
// Body: {"listing_id":91002}
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/favorites.php';

ini_set('display_errors', 0);
karavan_send_headers('POST');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    karavan_send_meeting_json(405, ['success' => false, 'error' => 'Method not allowed.']);
}

$userId = karavan_session_user_id();
if ($userId === null) {
    karavan_send_meeting_json(...karavan_not_logged_in());
}

try {
    $pdo = karavan_pdo();
    $response = karavan_save_favorite($pdo, $userId, json_decode(file_get_contents('php://input'), true));
} catch (Throwable $e) {
    // Never expose the underlying PHP/SQL error to the client
    karavan_send_meeting_json(500, ['success' => false, 'error' => 'Server error.']);
}

karavan_send_meeting_json(...$response);
