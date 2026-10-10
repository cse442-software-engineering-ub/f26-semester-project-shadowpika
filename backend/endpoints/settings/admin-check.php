<?php
header('Content-Type: application/json');
ini_set('display_errors', '0');

try {
    require_once __DIR__ . '/../includes/db.php';
    require_once __DIR__ . '/../includes/auth.php';

    $pdo = karavan_pdo();
    $user = karavan_current_user($pdo);

    echo json_encode([
        'success' => true,
        'is_admin' => $user !== null
            && ($user['role'] ?? '') === 'admin'
    ]);

} catch (Throwable $e) {
    error_log('admin-check.php failed: ' . $e->getMessage());

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'is_admin' => false
    ]);
}
