<?php
// GET  /api/ratings.php?seller_id=<id> — a seller's average, count, and reviews.
// POST /api/ratings.php  Body: {"seller_id": 217, "rating": 5, "review": "Great seller!"}
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/ratings.php';

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
        ? karavan_get_seller_ratings($pdo, $userId, $_GET['seller_id'] ?? null)
        : karavan_save_rating($pdo, $userId, json_decode(file_get_contents('php://input'), true));
} catch (Throwable $e) {
    // Never expose the underlying PHP/SQL error to the client
    karavan_send_meeting_json(500, ['success' => false, 'error' => 'Server error.']);
}

karavan_send_meeting_json(...$response);
