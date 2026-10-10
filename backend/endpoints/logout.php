<?php
require_once __DIR__ . '/includes/http.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';

karavan_send_headers('POST');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

karavan_start_session();

$_SESSION = [];

karavan_set_auth_cookie('', time() - 3600);

session_destroy();

// Otherwise the remember-me cookie would log the user straight back in on the next page.
try {
    karavan_forget_remember_token(karavan_pdo(), $_COOKIE[KARAVAN_REMEMBER_COOKIE] ?? null);
} catch (Throwable $e) {
    karavan_set_remember_cookie('', time() - 3600);
}

karavan_send_json(200, ['success' => true]);
?>
