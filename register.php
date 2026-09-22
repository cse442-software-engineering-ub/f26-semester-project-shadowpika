<?php
// 1. Cross-site safety permissions
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// 2. YOUR DATABASE CREDENTIALS (Make sure these match your login.php details!)
$host = 'localhost'; 
$db   = 'cse442_2026_fall_team_j_db';     // Replace with your database name
$user = 'ndberg';     // Replace with your database username
$pass = '50250298'; // Replace with your database password
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

if (empty($usernameInput) || empty($passwordInput)) {
    echo json_encode(["success" => false, "error" => "Missing fields."]);
    exit;
}

// 4. AUTOMATIC SALTING AND HASHING
// This single function generates a secure salt automatically and embeds it inside the hash!
$autoSaltedHash = password_hash($passwordInput, PASSWORD_BCRYPT);

// 5. Save the new user record safely into the database
try {
    $stmt = $pdo->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    $stmt->execute([$usernameInput, $autoSaltedHash]);
    echo json_encode(["success" => true, "message" => "Account successfully created!"]);
} catch (\PDOException $e) {
    if ($e->getCode() == 23000) { // Error code for duplicate unique fields
        echo json_encode(["success" => false, "error" => "Username already exists."]);
    } else {
        echo json_encode(["success" => false, "error" => "Registration database failure."]);
    }
}
?>