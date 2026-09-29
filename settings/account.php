<?php

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
    exit;
}


// Current username
$current_username = isset($data["current_username"])
    ? trim($data["current_username"])
    : "";

// New username
$new_username = isset($data["username"])
    ? trim($data["username"])
    : "";

$new_email = isset($data["email"])
    ? trim($data["email"])
    : "";

$curr_pass = isset($data["password"])
    ? trim($data["password"])
    : "";

// Make sure current username was provided
if (empty($current_username)) {
    echo json_encode([
        "success" => false,
        "error" => "Current username is required."
    ]);
    exit;
}


// Make sure new username was provided
if (empty($new_username) || empty($new_email)) {
    echo json_encode([
        "success" => false,
        "error" => "New username and email is required."
    ]);
    exit;
}

if (!str_contains($new_email, "@")){
    echo json_encode([
        "success" => false,
        "error" => "Invalid Email."
    ]);
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


// Check connection
if ($conn->connect_error) {
    echo json_encode([
        "success" => false,
        "error" => "Database connection failed."
    ]);
    exit;
}

// -----------------------------
// CHECK IF EMAIL IS ALREADY USED
// -----------------------------

$stmt = $conn->prepare(
    "SELECT COUNT(*) AS count FROM users WHERE email = ?"
);

$stmt->bind_param(
    "s",
    $new_email
);

$stmt->execute();

$result = $stmt->get_result();
$row = $result->fetch_assoc();

if ($row["count"] > 0) {
    echo json_encode([
        "success" => false,
        "error" => "Email already in use."
    ]);

    $stmt->close();
    $conn->close();
    exit;
}

$stmt->close();


// -----------------------------
// FIND USER ID
// -----------------------------

$stmt = $conn->prepare(
    "SELECT id, password_hash FROM users WHERE username = ?"
);

$stmt->bind_param(
    "s",
    $current_username
);

$stmt->execute();

$result = $stmt->get_result();
$user = $result->fetch_assoc();


// Make sure user exists
if (!$user) {
    echo json_encode([
        "success" => false,
        "error" => "Current user not found."
    ]);

    $stmt->close();
    $conn->close();
    exit;
}


// Store the user's ID
$user_id = $user["id"];

if (!password_verify($curr_pass, $user["password_hash"])){
    echo json_encode([
        "success" => false,
        "error" => "Password is incorrect."
    ]);

    $stmt->close();
    $conn->close();
    exit;
}

$stmt->close();


// -----------------------------
// UPDATE USERNAME
// -----------------------------

$stmt = $conn->prepare(
    "UPDATE users SET username = ?, email = ? WHERE id = ?"
);

$stmt->bind_param(
    "ssi",
    $new_username,
    $new_email,
    $user_id
);


// Execute update
if ($stmt->execute()) {

    echo json_encode([
        "success" => true,
        "message" => "Username updated successfully.",
        "user_id" => $user_id,
        "username" => $new_username,
        "email" => $new_email
    ]);

} else {

    echo json_encode([
        "success" => false,
        "error" => "Failed to update username."
    ]);
}


// -----------------------------
// CLEAN UP
// -----------------------------

$stmt->close();
$conn->close();

?>