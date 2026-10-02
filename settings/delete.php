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
// DATABASE CONNECTION
// -----------------------------

$db_host = 'localhost';
$db_name = 'cse442_2026_fall_team_j_db';
$db_user = 'ndberg';
$db_pass = '50250298';

$conn = new mysqli(
    $db_host,
    $db_user,
    $db_pass,
    $db_name
);


if ($conn->connect_error) {
    echo json_encode([
        "success" => false,
        "error" => "Database connection failed."
    ]);

    http_response_code(500);
    exit;
}


// -----------------------------
// FIND USER
// -----------------------------

$stmt = $conn->prepare(
    "SELECT id, password_hash, email
     FROM users
     WHERE username = ? OR email = ?"
);

$stmt->bind_param(
    "ss",
    $current_username,
    $current_username
);

$stmt->execute();

$result = $stmt->get_result();
$user = $result->fetch_assoc();

$stmt->close();


// -----------------------------
// CHECK USER
// -----------------------------

if (!$user) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid username or password."
    ]);

    $conn->close();
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

    $conn->close();
    http_response_code(401);
    exit;
}


// -----------------------------
// DELETE ACCOUNT
// -----------------------------

$user_id = $user["id"];

$stmt = $conn->prepare(
    "DELETE FROM users WHERE id = ?"
);

$stmt->bind_param(
    "i",
    $user_id
);


if ($stmt->execute()) {

    if ($stmt->affected_rows === 1) {
        setcookie(
            "karavan_auth_cookie",
            "",
            time() - 3600,
            "/",
            ".aptitude.cse.buffalo.edu"
        );

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

} else {

    echo json_encode([
        "success" => false,
        "error" => "Failed to delete account."
    ]);

    http_response_code(500);
}

$stmt->close();
$conn->close();

?>