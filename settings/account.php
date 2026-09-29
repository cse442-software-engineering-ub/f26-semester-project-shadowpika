```php
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

// Make sure the data exists
if (!$data) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid data received."
    ]);
    exit;
}

// Get username sent by JavaScript
$name = isset($data["username"])
    ? trim($data["username"])
    : "";

// Make sure username was provided
if (empty($name)) {
    echo json_encode([
        "success" => false,
        "error" => "Username is required."
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
// FIND USER ID
// -----------------------------

$stmt = $conn->prepare(
    "SELECT id FROM users WHERE username = ?"
);

$stmt->bind_param("s", $name);
$stmt->execute();

$result = $stmt->get_result();
$user = $result->fetch_assoc();


// Make sure the user exists
if (!$user) {
    echo json_encode([
        "success" => false,
        "error" => "User not found."
    ]);

    $stmt->close();
    $conn->close();
    exit;
}


// Get the ID associated with the username
$user_id = $user["id"];

$stmt->close();


// -----------------------------
// UPDATE USER
// -----------------------------

$stmt = $conn->prepare(
    "UPDATE users SET username = ? WHERE id = ?"
);

$stmt->bind_param(
    "si",
    $name,
    $user_id
);


// Execute update
if ($stmt->execute()) {

    echo json_encode([
        "success" => true,
        "message" => "Account updated successfully.",
        "user_id" => $user_id
    ]);

} else {

    echo json_encode([
        "success" => false,
        "error" => "Failed to update account."
    ]);
}


// -----------------------------
// CLEAN UP
// -----------------------------

$stmt->close();
$conn->close();

?>