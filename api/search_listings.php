<?php
// GET /api/search_listings.php?q=<text>
// Case-insensitive search over ACTIVE listings. Matches the start of any word in the product name,
// or the start of the category (so "books" finds books, but "ok" matches nothing).
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET");
header("Content-Type: application/json");

// Suppress all warnings/notices so nothing (SQL errors, stack traces) leaks into the JSON payload
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

const MAX_QUERY_LENGTH = 50;

function respond(int $status, array $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ["success" => false, "error" => "Method not allowed."]);
}

// --- INPUT VALIDATION ---
$query = isset($_GET['q']) && is_string($_GET['q']) ? trim($_GET['q']) : '';

if ($query === '') {
    respond(400, ["success" => false, "error" => "Search query is required."]);
}

// The /u flag makes preg_match return false on malformed UTF-8
$lengthCheck = preg_match('/^.{1,' . MAX_QUERY_LENGTH . '}$/su', $query);
if ($lengthCheck === false) {
    respond(400, ["success" => false, "error" => "Search query contains invalid characters."]);
}
if ($lengthCheck === 0) {
    respond(400, ["success" => false, "error" => "Search query must be " . MAX_QUERY_LENGTH . " characters or fewer."]);
}

// Emoji, pictographs, flags, and the joiners/variation selectors used to build them
$emojiPattern = '/[\x{1F000}-\x{1FAFF}\x{2300}-\x{23FF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}'
              . '\x{FE0F}\x{200D}\x{20E3}\x{E0020}-\x{E007F}\x{3030}\x{303D}\x{3297}\x{3299}]/u';
if (preg_match($emojiPattern, $query)) {
    respond(400, ["success" => false, "error" => "Search query cannot contain emoji."]);
}

// Escape LIKE wildcards so "%" or "_" are searched literally instead of matching everything
$escaped = addcslashes($query, '\\%_');

// Only match at the start of a word, so "ok" doesn't match "Textbook" or "Books"
$startsWith     = $escaped . '%';        // name/category begins with the query
$wordStartsWith = '% ' . $escaped . '%'; // a later word in the name begins with the query

// --- DATABASE CONNECTION CONFIGURATION ---
$db_host = 'localhost';
$db_name = 'cse442_2026_fall_team_j_db';
$db_user = 'ndberg';
$db_pass = '50250298';

try {
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
    if ($conn->connect_error) {
        respond(500, ["success" => false, "error" => "Database connection failure."]);
    }
    $conn->set_charset('utf8mb4');

    $stmt = $conn->prepare(
        "SELECT listing_id, name, price, `condition`, image_url
           FROM listings
          WHERE status = 'active'
            AND (LOWER(name) LIKE LOWER(?)
                 OR LOWER(name) LIKE LOWER(?)
                 OR LOWER(category) LIKE LOWER(?))
          ORDER BY listing_id"
    );
    $stmt->bind_param("sss", $startsWith, $wordStartsWith, $startsWith);
    $stmt->execute();
    $result = $stmt->get_result();

    $results = [];
    while ($row = $result->fetch_assoc()) {
        $results[] = [
            "listing_id" => (int) $row['listing_id'],
            "name"       => $row['name'],
            "price"      => number_format((float) $row['price'], 2, '.', ''),
            "condition"  => $row['condition'],
            "image_url"  => $row['image_url'],
        ];
    }

    $stmt->close();
    $conn->close();

    respond(200, ["success" => true, "results" => $results]);

} catch (Throwable $e) {
    // Never expose the underlying PHP/SQL error to the client
    respond(500, ["success" => false, "error" => "Server error."]);
}
