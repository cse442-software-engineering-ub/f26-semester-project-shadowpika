<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/http.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';

ini_set('display_errors', '0');
error_reporting(0);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    karavan_send_json(405, ['success' => false, 'error' => 'Method not allowed.']);
}

try {
    $pdo = karavan_pdo();
    $user = karavan_current_user($pdo);

    if ($user === null) {
        karavan_send_json(401, ['success' => false, 'error' => 'You must be logged in to report an item.']);
    }

    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput ?: '', true);

    $listingId = isset($data['listing_id']) ? (int) $data['listing_id'] : 0;
    $reason = isset($data['reason_category']) ? (int) $data['reason_category'] : -1;
    $comments = isset($data['custom_comments']) ? trim((string) $data['custom_comments']) : '';

    if ($listingId <= 0 || $reason < 0) {
        karavan_send_json(422, ['success' => false, 'error' => 'Invalid listing or reason supplied.']);
    }

    $stmt = $pdo->prepare('INSERT INTO reported_listings (listing_id, reporter_user_id, reason_category, custom_comments) VALUES (?, ?, ?, ?)');
    $stmt->execute([$listingId, (int) $user['id'], $reason, $comments]);

    karavan_send_json(200, [
        'success' => true,
        'message' => 'SUCCESS: Item successfully flagged for moderation review.'
    ]);

} catch (Throwable $e) {
    karavan_send_json(500, ['success' => false, 'error' => 'Internal server error occurred processing request.']);
}
