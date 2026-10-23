<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/communities.php';

ini_set('display_errors', 0);
karavan_send_headers('GET');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$userId = karavan_session_user_id();
if ($userId === null) {
    karavan_send_json(...karavan_forbidden());
}

try {
    $pdo = karavan_pdo();
} catch (Throwable $e) {
    karavan_send_json(500, ['success' => false, 'is_admin' => false, 'application_status' => 'none']);
}

karavan_send_json(...karavan_admin_tab_status($pdo, $userId));
