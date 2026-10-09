<?php
require_once __DIR__ . '/includes/http.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/admin_requests.php';

ini_set('display_errors', 0);
karavan_send_headers('POST');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    karavan_send_json(405, ['success' => false, 'error' => 'Method not allowed.']);
}

// When the body exceeds post_max_size PHP silently drops $_POST and $_FILES entirely.
if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    karavan_send_json(413, ['success' => false, 'error' => 'File is too large. Maximum size is 2MB.']);
}

try {
    $pdo = karavan_pdo();
} catch (Throwable $e) {
    karavan_send_json(500, ['success' => false, 'error' => 'Database connection failure.']);
}

[$status, $body] = karavan_admin_register(
    $pdo,
    $_POST,
    $_FILES,
    karavan_config()['upload_dir'],
    'move_uploaded_file'
);
karavan_send_json($status, $body);
