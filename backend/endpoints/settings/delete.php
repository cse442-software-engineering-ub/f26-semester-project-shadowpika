<?php

session_start();

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json");


// -----------------------------
// DATABASE CONNECTION
// Credentials are loaded by includes/db.php
// -----------------------------

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';

// try {
//     $pdo = karavan_pdo();
// } catch (\Throwable $e) {
//     echo json_encode([
//         "success" => false,
//         "error" => "Database connection failed."
//     ]);

//     http_response_code(500);
//     exit;
// }

try {
    $pdo = karavan_pdo();
} catch (\Throwable $e) {
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);

    http_response_code(500);
    exit;
}


// -----------------------------
// READ DATA FROM JAVASCRIPT
// -----------------------------

$raw_input = file_get_contents("php://input");
$data = json_decode($raw_input, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid data received."
    ]);

    http_response_code(400);
    exit;
}


// -----------------------------
// GET USERNAME AND PASSWORD
// -----------------------------

$current_username = isset($data["current_username"])
    ? trim($data["current_username"])
    : "";

$password = isset($data["password"])
    ? $data["password"]
    : "";


// -----------------------------
// VALIDATE INPUT
// -----------------------------

if (empty($current_username)) {
    echo json_encode([
        "success" => false,
        "error" => "Username is required."
    ]);

    http_response_code(400);
    exit;
}

if (empty($password)) {
    echo json_encode([
        "success" => false,
        "error" => "Password is required."
    ]);

    http_response_code(400);
    exit;
}


// -----------------------------
// FIND USER
// -----------------------------

try {

    $stmt = $pdo->prepare(
        "SELECT id, password_hash, email
         FROM users
         WHERE username = ? OR email = ?"
    );

    $stmt->execute([
        $current_username,
        $current_username
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

} catch (\PDOException $e) {

    echo json_encode([
        "success" => false,
        "error" => "Failed to find account."
    ]);

    http_response_code(500);
    exit;
}


// -----------------------------
// CHECK USER
// -----------------------------

if (!$user) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid username or password."
    ]);

    http_response_code(401);
    exit;
}


// -----------------------------
// VERIFY PASSWORD
// -----------------------------

if (!password_verify($password, $user["password_hash"])) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid username or password."
    ]);

    http_response_code(401);
    exit;
}


// -----------------------------
// DELETE ACCOUNT
// -----------------------------

$user_id = $user["id"];

try {

    $stmt = $pdo->prepare(
        "DELETE FROM users WHERE id = ?"
    );

    $stmt->execute([
        $user_id
    ]);

    if ($stmt->rowCount() === 1) {

        // Delete authentication cookie
        karavan_set_auth_cookie('', time() - 3600);

        // Destroy session
        $_SESSION = [];
        session_destroy();

        echo json_encode([
            "success" => true,
            "message" => "Account deleted successfully."
        ]);

        http_response_code(200);

    } else {

        echo json_encode([
            "success" => false,
            "error" => "Account could not be deleted."
        ]);

        http_response_code(404);
    }

} catch (\PDOException $e) {

    echo json_encode([
        "success" => false,
        "error" => "Failed to delete account."
    ]);

    http_response_code(500);
}

?>
