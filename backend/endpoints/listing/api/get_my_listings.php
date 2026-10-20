<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/http.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../lib/manage_listings.php';

ini_set('display_errors', '0');
karavan_send_headers('GET');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    karavan_send_json(405, ['success' => false, 'error' => 'Method not allowed.']);
}

try {
    $pdo = karavan_pdo();
    $user = karavan_current_user($pdo);
    [$status, $body] = get_my_listings($pdo, $user === null ? null : (int) $user['id']);
} catch (Throwable $exception) {
    karavan_send_json(500, ['success' => false, 'error' => 'The listings could not be loaded.']);
}

karavan_send_json($status, $body);
