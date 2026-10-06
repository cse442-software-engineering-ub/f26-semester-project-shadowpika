<?php
// 1. Cross-site safety permissions
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// 2. DATABASE CONNECTION (credentials live in config.local.php, see includes/config.php)
require_once __DIR__ . '/includes/db.php';

try {
     $pdo = karavan_pdo();
} catch (\Throwable $e) {
     echo json_encode(["success" => false, "error" => "Database connection failure."]);
     exit;
}

// 3. Read incoming React Payload
$raw_input = file_get_contents("php://input");
$data = json_decode($raw_input, true);

$usernameInput = isset($data['username']) ? trim($data['username']) : '';
$passwordInput = isset($data['password']) ? trim($data['password']) : '';
$emailInput    = isset($data['email'])    ? trim($data['email'])    : '';

// A: Check if any fields are empty
if (empty($usernameInput) || empty($passwordInput) || empty($emailInput)) {
    echo json_encode(["success" => false, "error" => "Missing fields."]);
    exit;
}

// B: NEW - ANTI BEE MOVIE PROTECTION (Strict 50 character cap)
if (strlen($usernameInput) > 50 || strlen($passwordInput) > 50 || strlen($emailInput) > 50) {
    echo json_encode(["success" => false, "error" => "Input fields cannot exceed 50 characters."]);
    exit;
}

// C: The live users table has no UNIQUE index on email, so duplicates must be caught here.
// Accounts created before the email column existed only have their email in username.
try {
    $existing = $pdo->prepare('SELECT 1 FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1');
    $existing->execute([$usernameInput, $emailInput, $emailInput]);
    if ($existing->fetchColumn()) {
        echo json_encode(["success" => false, "error" => "Username or Email already exists."]);
        exit;
    }
} catch (\PDOException $e) {
    echo json_encode(["success" => false, "error" => "Registration database failure."]);
    exit;
}

// 4. AUTOMATIC SALTING AND HASHING
$autoSaltedHash = password_hash($passwordInput, PASSWORD_BCRYPT);

// 5. Save the new user record safely into the database
try {
    // UPDATED: Added 'email' column and an extra '?' placeholder to match your database layout
    $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)');
    $stmt->execute([$usernameInput, $autoSaltedHash, $emailInput]);
    
    echo json_encode(["success" => true, "message" => "Account successfully created!"]);
} catch (\PDOException $e) {
    if ($e->getCode() == 23000) { // Error code for duplicate unique fields
        echo json_encode(["success" => false, "error" => "Username or Email already exists."]);
    } else {
        echo json_encode(["success" => false, "error" => "Registration database failure."]);
    }
}
?>
