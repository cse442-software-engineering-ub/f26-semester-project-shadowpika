<?php

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(0);

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
// GET PASSWORD
// -----------------------------

$password = isset($data["password"])
    ? $data["password"]
    : "";


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

if (empty($password)) {
    echo json_encode([
        "success" => false,
        "error" => "Password is required."
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
        "error" => "Failed to find account."
    ]);

    http_response_code(500);
    exit;
}


// -----------------------------
// VERIFY PASSWORD
// -----------------------------

if (!is_string($password_hash) || !password_verify($password, $password_hash)) {
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

    // Listings have no foreign key to users, so remove them with the account
    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        "DELETE FROM listings WHERE owner_id = ?"
    );

    $stmt->execute([
        $user_id
    ]);

    $stmt = $pdo->prepare(
        "DELETE FROM users WHERE id = ?"
    );

    $stmt->execute([
        $user_id
    ]);

    if ($stmt->rowCount() === 1) {

        $pdo->commit();

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

        $pdo->rollBack();

        echo json_encode([
            "success" => false,
            "error" => "Account could not be deleted."
        ]);

        http_response_code(404);
    }

} catch (\PDOException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    echo json_encode([
        "success" => false,
        "error" => "Failed to delete account."
    ]);

    http_response_code(500);
}

?>
