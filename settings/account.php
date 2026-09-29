<?php

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json");

// Read the JSON sent by JavaScript
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

// Get the values sent by JavaScript
$name = isset($data["name"]) ? trim($data["name"]) : "";
$email = isset($data["email"]) ? trim($data["email"]) : "";

// Make sure both fields were filled in
if (empty($name) || empty($email)) {
    echo json_encode([
        "success" => false,
        "error" => "Name and email are required."
    ]);
    exit;
}


// -----------------------------
// DATABASE CONNECTION
// -----------------------------

$db_host = 'localhost'; 
$db_name   = 'cse442_2026_fall_team_j_db';     // Replace with your database name
$db_user = 'ndberg';     // Replace with your database username
$db_pass = '50250298'; // Replace with your database password

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
// UPDATE USER
// -----------------------------

$stmt = $conn->prepare(
    "UPDATE users SET username = ?, email = ? WHERE id = ?"
);

// Example user ID
$user_id = 1; //placeholder, dont keep it like this

$stmt->bind_param(
    "ssi",
    $name,
    $email,
    $user_id
);

if ($stmt->execute()) {

    echo json_encode([
        "success" => true,
        "message" => "Account updated successfully."
    ]);

} else {

    echo json_encode([
        "success" => false,
        "error" => "Failed to update account."
    ]);
}


// Clean up
$stmt->close();
$conn->close();

?>