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
// GET USER INFORMATION
// -----------------------------

$new_username = isset($data["username"])
    ? trim($data["username"])
    : "";

$new_email = isset($data["email"])
    ? trim($data["email"])
    : "";

$curr_pass = isset($data["password"])
    ? $data["password"]
    : "";


// -----------------------------
// GET CURRENT USER FROM COOKIE
// -----------------------------

// Change "username" to the actual name of your cookie.
$cookie_user = $cookie_user = isset($_COOKIE["karavan_auth_cookie"])
    ? urldecode(trim($_COOKIE["karavan_auth_cookie"]))
    : "";


// -----------------------------
// VALIDATE INPUT
// -----------------------------

if (empty($cookie_user)) {
    echo json_encode([
        "success" => false,
        "error" => "User cookie not found."
    ]);
    http_response_code(401);
    exit;
}

if (empty($new_username) || empty($new_email)) {
    echo json_encode([
        "success" => false,
        "error" => "New username and email are required."
    ]);
    http_response_code(400);
    exit;
}

if (!str_contains($new_email, "@")) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid Email."
    ]);
    http_response_code(422);
    exit;
}

if (empty($curr_pass)) {
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
// FIND CURRENT USER
// -----------------------------

try {

    /*
     * Compare the cookie against BOTH:
     *
     *     users.username
     *
     * OR
     *
     *     users.email
     *
     * This means the cookie can contain either
     * the user's username OR their email.
     */

    $stmt = $pdo->prepare(
        "SELECT id, username, email, password_hash
         FROM users
         WHERE username = ? OR email = ?"
    );

    $stmt->execute([
        $cookie_user,
        $cookie_user
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

} catch (\PDOException $e) {

    echo json_encode([
        "success" => false,
        "error" => "Failed to find current user."
    ]);

    http_response_code(500);
    exit;
}


// -----------------------------
// MAKE SURE USER EXISTS
// -----------------------------

if (!$user) {
    echo json_encode([
        "success" => false,
        "error" => "User associated with cookie was not found."
    ]);

    http_response_code(404);
    exit;
}


// -----------------------------
// VERIFY PASSWORD
// -----------------------------

if (!password_verify($curr_pass, $user["password_hash"])) {
    echo json_encode([
        "success" => false,
        "error" => "Password is incorrect."
    ]);

    http_response_code(401);
    exit;
}


// -----------------------------
// CHECK IF EMAIL IS ALREADY USED
// -----------------------------

try {

    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM users
         WHERE email = ?
         AND id != ?"
    );

    $stmt->execute([
        $new_email,
        $user["id"]
    ]);

    $email_count = $stmt->fetchColumn();

    if ($email_count > 0) {
        echo json_encode([
            "success" => false,
            "error" => "Email already in use."
        ]);

        http_response_code(409);
        exit;
    }

} catch (\PDOException $e) {

    echo json_encode([
        "success" => false,
        "error" => "Failed to check email."
    ]);

    http_response_code(500);
    exit;
}


// -----------------------------
// UPDATE USERNAME AND EMAIL
// -----------------------------

$user_id = $user["id"];

try {

    $stmt = $pdo->prepare(
        "UPDATE users
         SET username = ?, email = ?
         WHERE id = ?"
    );

    $stmt->execute([
        $new_username,
        $new_email,
        $user_id
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Account information updated successfully.",
        "user_id" => $user_id,
        "username" => $new_username,
        "email" => $new_email
    ]);

    karavan_set_auth_cookie($new_username, time() + KARAVAN_REMEMBER_SECONDS);

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
