<?php
require_once __DIR__ . '/includes/http.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/communities.php';
require_once __DIR__ . '/includes/auth.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json");

// 1. CRITICAL: Suppress all warnings/notices to prevent corrupting the JSON payload
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

$raw_input = file_get_contents("php://input");
$data = json_decode($raw_input, true);

$input_username = isset($data['email']) ? trim($data['email']) : '';
$input_password = isset($data['password']) ? trim($data['password']) : '';

// Check for empty fields first
if (empty($input_username) || empty($input_password)) {
    echo json_encode(["success" => false, "error" => "Please fill in all fields."]);
    exit;
}

// NEW: Strict 50-character protection to intercept overly long strings immediately
if (strlen($input_username) > 50 || strlen($input_password) > 50) {
    echo json_encode([
        "success" => false, 
        "status" => "error",
        "authenticated" => false,
        "error" => "Invalid input format. Fields cannot exceed 50 characters."
    ]);
    exit;
}

// --- DATABASE CONNECTION (credentials live in config.local.php, see includes/config.php) ---
try {
    $pdo = karavan_pdo();
} catch (Throwable $e) {
    echo json_encode(["success" => false, "error" => "Database connection failure."]);
    exit;
}

// 2. Wrap the lookup in a try/catch block to prevent crash output
try {
    // --- DYNAMIC LOOKUP BY EMAIL ---
    // Accounts created before the email column existed only have their email in username.
    // Older rows can share an email (the live table has no UNIQUE index on it), so the account
    // is the oldest match whose password is correct rather than whichever row MySQL returns first.
    $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?) ORDER BY LOWER(email) = LOWER(?) DESC, id ASC");
    $stmt->execute([$input_username, $input_username, $input_username]);

    // --- SECURE BCRYPT VERIFICATION ---
    $db_user_row = null;
    foreach ($stmt->fetchAll() as $candidate) {
        if (password_verify($input_password, $candidate['password_hash'])) {
            $db_user_row = $candidate;
            break;
        }
    }

    if ($db_user_row) {
        // Moderator, admin and location endpoints identify the user from the PHP session.
        karavan_start_session();
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $db_user_row['id'];

        // Keeps the login after the browser closes; session.php turns this back into a session.
        try {
            karavan_issue_remember_token($pdo, (int) $db_user_row['id']);
        } catch (Throwable $e) {
            // Without the auth_tokens table (sql/005) login still works, it just isn't remembered.
        }

        karavan_set_auth_cookie($input_username, time() + KARAVAN_REMEMBER_SECONDS);

        // The nav's "Join a Community" button shows the joined community's name.
        $community = karavan_find_community($pdo, $db_user_row['community_id'] ?? null);

        echo json_encode([
            "success" => true,
            "status" => "success",
            "authenticated" => true,
            "role" => $db_user_row['role'] ?? 'user',
            "community_id" => $community['community_id'] ?? null,
            "community_name" => $community['community_name'] ?? null
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "status" => "error",
            "authenticated" => false,
            "error" => "Invalid username or password."
        ]);
    }

} catch (Throwable $e) {
    // Details stay out of the response so database internals aren't shown to users.
    echo json_encode(["success" => false, "error" => "An internal server error occurred."]);
}
exit;
?>
