<?php
// 1. Cross-site safety permissions
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// 2. YOUR DATABASE CREDENTIALS (Preserved exactly from your file)
$host = 'localhost'; 
$db   = 'cse442_2026_fall_team_j_db';     
$user = 'ndberg';     
$pass = '50250298'; 
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
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
