<?php
header('Content-Type: application/json');

try {
    session_start();

    // Reuse the existing database connection configuration.
    require_once __DIR__ . '/includes/db.php';

    $pdo = karavan_pdo();

    $userId = isset($_SESSION['user_id'])
        ? (int) $_SESSION['user_id']
        : null;

    if ($userId === null) {
        echo json_encode([
            'success' => true,
            'is_admin' => false
        ]);
        exit;
    }

    $stmt = $pdo->prepare(
        'SELECT role FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$userId]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'is_admin' => $user !== false
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