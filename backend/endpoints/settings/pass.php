<?php

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json");


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
// GET USER INFORMATION
// -----------------------------

$curr_pass = isset($data["current_password"])
    ? trim($data["current_password"])
    : "";

$new_pass = isset($data["new_password"])
    ? trim($data["new_password"])
    : "";


// -----------------------------
// DATABASE CONNECTION
// -----------------------------

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';

try {
    $pdo = karavan_pdo();
} catch (\Throwable $e) {
    echo json_encode([
        "success" => false,
        "error" => "Database connection failed."
    ]);
    http_response_code(500);
    exit;
}


// -----------------------------
// FIND CURRENT USER FROM LOGIN SESSION
// -----------------------------

try {
    $user = karavan_current_user($pdo);
} catch (\Throwable $e) {
    echo json_encode([
        "success" => false,
        "error" => "Failed to find current user."
    ]);
    http_response_code(500);
    exit;
}

if ($user === null) {
    echo json_encode([
        "success" => false,
        "error" => "You are not logged in."
    ]);
    http_response_code(401);
    exit;
}


// -----------------------------
// VALIDATE INPUT
// -----------------------------

if (empty($curr_pass) || empty($new_pass)) {
    echo json_encode([
        "success" => false,
        "error" => "Missing current or future password."
    ]);
    http_response_code(400);
    exit;
}

if (strlen($new_pass) > 50) {
    echo json_encode([
        "success" => false,
        "error" => "Password must be 50 characters or fewer."
    ]);
    http_response_code(400);
    exit;
}


// -----------------------------
// GET CURRENT PASSWORD HASH
// -----------------------------

try {
    $stmt = $pdo->prepare(
        "SELECT password_hash
         FROM users
         WHERE id = ?"
    );

    $stmt->execute([
        $user["id"]
    ]);

    $password_hash = $stmt->fetchColumn();

} catch (\PDOException $e) {

    echo json_encode([
        "success" => false,
        "error" => "Failed to find current user."
    ]);

    http_response_code(500);
    exit;
}


// -----------------------------
// VERIFY PASSWORD
// -----------------------------

if (!is_string($password_hash) || !password_verify($curr_pass, $password_hash)) {
    echo json_encode([
        "success" => false,
        "error" => "Password is incorrect."
    ]);

    http_response_code(401);
    exit;
}


// -----------------------------
// UPDATE PASSWORD
// -----------------------------

$user_id = $user["id"];

try {

    $stmt = $pdo->prepare(
        "UPDATE users
         SET password_hash = ?
         WHERE id = ?"
    );

    $stmt->execute([
        password_hash($new_pass, PASSWORD_DEFAULT),
        $user_id
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Password updated successfully.",
        "user_id" => $user_id
    ]);

    http_response_code(200);

} catch (\PDOException $e) {

    if ($e->getCode() == "23000") {
        echo json_encode([
            "success" => false,
            "error" => "Username or email already in use."
        ]);

        http_response_code(409);

    } else {
        echo json_encode([
            "success" => false,
            "error" => "Failed to update account."
        ]);

        http_response_code(500);
    }
}

?>
