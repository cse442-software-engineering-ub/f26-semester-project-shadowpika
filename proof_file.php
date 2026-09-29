<?php
// Streams an uploaded proof-of-ownership document to a signed-in moderator.
// The files themselves live outside the web root (see upload_dir in includes/config.php).
require_once __DIR__ . '/includes/http.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/admin_requests.php';

ini_set('display_errors', 0);

$userId = karavan_session_user_id();
if ($userId === null) {
    header("Content-Type: application/json");
    karavan_send_json(...karavan_forbidden());
}

try {
    $pdo = karavan_pdo();
} catch (Throwable $e) {
    header("Content-Type: application/json");
    karavan_send_json(500, ['success' => false, 'error' => 'Database connection failure.']);
}

[$status, $result] = karavan_locate_proof_file(
    $pdo,
    $userId,
    $_GET['request_id'] ?? null,
    karavan_config()['upload_dir']
);

if ($status !== 200) {
    header("Content-Type: application/json");
    karavan_send_json($status, $result);
}

$safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $result['name']);
header('Content-Type: ' . $result['mime']);
header('Content-Length: ' . filesize($result['path']));
header('Content-Disposition: inline; filename="' . $safeName . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
readfile($result['path']);
exit;
