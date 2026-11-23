<?php
// GET  /api/message.php?with=<user id>&listing_id=<id>  — the conversation about one listing.
// POST /api/message.php  Body: {"receiver_id": 217, "listing_id": 95023, "message": "Is this still available?"}
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/messages.php';

ini_set('display_errors', 0);
karavan_send_headers('GET, POST');

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    exit(0);
}
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    karavan_send_meeting_json(405, ['success' => false, 'error' => 'Method not allowed.']);
}

$userId = karavan_session_user_id();
try {
    $pdo = karavan_pdo();
    $response = $method === 'GET'
        ? karavan_get_conversation($pdo, $userId, $_GET['with'] ?? null, $_GET['listing_id'] ?? null)
        : karavan_send_message($pdo, $userId, json_decode(file_get_contents('php://input'), true));
} catch (Throwable $e) {
    // Never expose the underlying PHP/SQL error to the client
    karavan_send_meeting_json(500, ['success' => false, 'error' => 'Server error.']);
}

karavan_send_meeting_json(...$response);
