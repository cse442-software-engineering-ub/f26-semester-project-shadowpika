<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/http.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../lib/manage_listings.php';

ini_set('display_errors', '0');
karavan_send_headers('POST');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    karavan_send_json(405, ['success' => false, 'error' => 'Method not allowed.']);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '', true);
if (!is_array($input)) {
    karavan_send_json(400, ['success' => false, 'error' => 'The request body must contain valid JSON.']);
}

try {
    $pdo = karavan_pdo();
    $user = karavan_current_user($pdo);
    [$status, $body] = update_my_listing($pdo, $user === null ? null : (int) $user['id'], $input);
} catch (Throwable $exception) {
    karavan_send_json(500, ['success' => false, 'error' => 'The listing could not be updated.']);
}

karavan_send_json($status, $body);
