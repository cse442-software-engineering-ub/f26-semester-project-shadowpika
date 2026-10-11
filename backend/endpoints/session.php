<?php
require_once __DIR__ . '/includes/http.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';

ini_set('display_errors', 0);
karavan_send_headers('GET');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    karavan_send_json(405, ['success' => false, 'error' => 'Method not allowed.']);
}

try {
    $pdo = karavan_pdo();
} catch (Throwable $e) {
    karavan_send_json(500, ['success' => false, 'error' => 'Database connection failure.']);
}

try {
    $user = karavan_current_user($pdo);
} catch (Throwable $e) {
    karavan_send_json(500, ['success' => false, 'error' => 'An internal server error occurred.']);
}

if ($user !== null) {
    karavan_set_auth_cookie($user['username'], time() + KARAVAN_REMEMBER_SECONDS);
}

karavan_send_json(...karavan_session_status($user));
