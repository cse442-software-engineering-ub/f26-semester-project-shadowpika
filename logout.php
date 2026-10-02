<?php
require_once __DIR__ . '/includes/http.php';

karavan_send_headers('POST');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

karavan_start_session();

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();

    setcookie(
        "karavan_auth_cookie",
        "",
        time() - 3600,
        "/",
        ".aptitude.cse.buffalo.edu"
    );
}

session_destroy();

karavan_send_json(200, ['success' => true]);
?>