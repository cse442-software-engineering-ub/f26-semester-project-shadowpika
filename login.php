<?php
require_once __DIR__ . '/includes/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json");

// 1. CRITICAL: Suppress all warnings/notices to prevent corrupting the JSON payload
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

$raw_input = file_get_contents("php://input");
$data = json_decode($raw_input, true);

$input_username = isset($data['username']) ? trim($data['username']) : '';
$input_password = isset($data['password']) ? trim($data['password']) : '';

if (empty($input_username) || empty($input_password)) {
    echo json_encode(["success" => false, "error" => "Please fill in all fields."]);
    exit;
}

// --- DATABASE CONNECTION (credentials live in config.local.php, see includes/config.php) ---
try {
    $pdo = karavan_pdo();
} catch (Throwable $e) {
    echo json_encode(["success" => false, "error" => "Database connection failure."]);
    exit;
}

// 2. Wrap the lookup in a try/catch block to prevent crash output
try {
    // --- FIXED DYNAMIC LOOKUP ---
    $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)");
    $stmt->execute([$input_username]);
    $db_user_row = $stmt->fetch();

    // --- SECURE BCRYPT VERIFICATION ---
    if ($db_user_row && password_verify($input_password, $db_user_row['password_hash'])) {
        echo json_encode([
            "success" => true,
            "status" => "success",
            "authenticated" => true
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "status" => "error",
            "authenticated" => false,
            "error" => "Invalid username or password."
        ]);
    }

} catch (Throwable $e) {
    // Details stay out of the response so database internals aren't shown to users.
    echo json_encode([
        "success" => false,
        "error" => "Server error. Please try again."
    ]);
}
exit;
?>
