<?php
require_once __DIR__ . '/includes/http.php';

karavan_send_headers('POST');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

karavan_start_session();
$_SESSION = [];
session_destroy();
karavan_send_json(200, ['success' => true]);
