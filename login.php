<?php
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

// --- DATABASE CONNECTION CONFIGURATION ---
$db_host = 'localhost'; 
$db_name   = 'cse442_2026_fall_team_j_db';     // Replace with your database name
$db_user = 'ndberg';     // Replace with your database username
$db_pass = '50250298'; // Replace with your database password

// 2. Wrap database connection in a try/catch block to prevent crash output
try {
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
    
    if ($conn->connect_error) {
        echo json_encode(["success" => false, "error" => "Database connection failure."]);
        exit;
    }

    // --- FIXED DYNAMIC LOOKUP ---
    $stmt = $conn->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)");
    $stmt->bind_param("s", $input_username);
    $stmt->execute();
    $result = $stmt->get_result();
    $db_user_row = $result->fetch_assoc();

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

    $stmt->close();
    $conn->close();

} catch (Throwable $e) {
    // This intercepts low-level engine errors and prints them right onto the page
    echo json_encode([
        "success" => false, 
        "error" => "Server Error: " . $e->getMessage() . " on line " . $e->getLine()
    ]);
}
exit;
?>
