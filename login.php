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

$input_username = isset($data['email']) ? trim($data['email']) : '';
$input_password = isset($data['password']) ? trim($data['password']) : '';

// Check for empty fields first
if (empty($input_username) || empty($input_password)) {
    echo json_encode(["success" => false, "error" => "Please fill in all fields."]);
    exit;
}

// NEW: Strict 50-character protection to intercept overly long strings immediately
if (strlen($input_username) > 50 || strlen($input_password) > 50) {
    echo json_encode([
        "success" => false, 
        "status" => "error",
        "authenticated" => false,
        "error" => "Invalid input format. Fields cannot exceed 50 characters."
    ]);
    exit;
}

// --- DATABASE CONNECTION CONFIGURATION ---
$db_host = 'localhost'; 
$db_name   = 'cse442_2026_fall_team_j_db';     
$db_user = 'ndberg';     
$db_pass = '50250298'; 

// 2. Wrap database connection in a try/catch block to prevent crash output
try {
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
    
    if ($conn->connect_error) {
        echo json_encode(["success" => false, "error" => "Database connection failure."]);
        exit;
    }

    // --- FIXED DYNAMIC LOOKUP BY EMAIL ---
    $stmt = $conn->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
    $stmt->bind_param("s", $input_username);
    $stmt->execute();
    $result = $stmt->get_result();
    $db_user_row = $result->fetch_assoc();

    // --- SECURE BCRYPT VERIFICATION ---
    if ($db_user_row && password_verify($input_password, $db_user_row['password_hash'])) {
	// --- SET FIGMA-COMPATIBLE SECURE COOKIE ---
	$cookie_options = [
	    'expires' => time() + (86400 * 30), // 30 Days expiration
	    'path' => '/',
	    'domain' => 'aptitude.cse.buffalo.edu', // Must match your UB server host
	    'secure' => true,     // CRITICAL: Must be true for iframes to read it
	    'httponly' => false,  // Must be false so React frontend can check if it exists
	    'samesite' => 'None'  // CRITICAL: Tells browsers it's safe to send inside Figma
	];
	setcookie("karavan_auth_cookie", $input_username, $cookie_options);
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

} catch (Exception $e) {
    echo json_encode(["success" => false, "error" => "An internal server error occurred."]);
}
exit;
?>
