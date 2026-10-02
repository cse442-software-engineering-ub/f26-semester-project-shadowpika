<?php
// GET /api/search_listings.php?q=<text>&categories=Textbooks,Dorm%20Living
// Returns ACTIVE listings. The optional text query matches the start of any word in the product
// name or the start of the category. Optional category values are exact-match and use OR with one
// another; when both inputs are present, the text and category filters are combined with AND.
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET");
header("Content-Type: application/json");

// Suppress all warnings/notices so nothing (SQL errors, stack traces) leaks into the JSON payload
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

const MAX_QUERY_LENGTH = 50;

require_once __DIR__ . '/../listing/lib/listing_validation.php';

// Earlier marketplace prototypes stored shorter labels. Keep those rows searchable without
// rewriting shared development data; API clients always receive the canonical Create Listing label.
const CATEGORY_STORAGE_ALIASES = [
    'Textbooks' => ['Textbooks', 'Books'],
    'Tech & Electronics' => ['Tech & Electronics', 'Electronics'],
    'Dorm Living' => ['Dorm Living', 'Furniture'],
    'Clothing & Gear' => ['Clothing & Gear', 'Clothing'],
    'Other' => ['Other'],
];

function respond(int $status, array $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ["success" => false, "error" => "Method not allowed."]);
}

// --- INPUT VALIDATION ---
if (isset($_GET['q']) && !is_string($_GET['q'])) {
    respond(400, ["success" => false, "error" => "Search query must be text."]);
}

function canonical_category(string $storedCategory): string {
    foreach (CATEGORY_STORAGE_ALIASES as $canonical => $aliases) {
        if (in_array($storedCategory, $aliases, true)) {
            return $canonical;
        }
    }
    return $storedCategory;
}
$query = isset($_GET['q']) ? trim($_GET['q']) : '';

if ($query !== '') {
    // The /u flag makes preg_match return false on malformed UTF-8.
    $lengthCheck = preg_match('/^.{1,' . MAX_QUERY_LENGTH . '}$/su', $query);
    if ($lengthCheck === false) {
        respond(400, ["success" => false, "error" => "Search query contains invalid characters."]);
    }
    if ($lengthCheck === 0) {
        respond(400, ["success" => false, "error" => "Search query must be " . MAX_QUERY_LENGTH . " characters or fewer."]);
    }

    // Emoji, pictographs, flags, and the joiners/variation selectors used to build them.
    $emojiPattern = '/[\x{1F000}-\x{1FAFF}\x{2300}-\x{23FF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}'
                  . '\x{FE0F}\x{200D}\x{20E3}\x{E0020}-\x{E007F}\x{3030}\x{303D}\x{3297}\x{3299}]/u';
    if (preg_match($emojiPattern, $query)) {
        respond(400, ["success" => false, "error" => "Search query cannot contain emoji."]);
    }
}

if (isset($_GET['categories']) && !is_string($_GET['categories'])) {
    respond(400, ["success" => false, "error" => "Categories must be a comma-separated list."]);
}

$categories = [];
$categoryInput = isset($_GET['categories']) ? trim($_GET['categories']) : '';
if ($categoryInput !== '') {
    foreach (explode(',', $categoryInput) as $categoryPart) {
        $category = trim($categoryPart);
        if ($category === '') {
            continue;
        }
        if (!in_array($category, LISTING_ALLOWED_CATEGORIES, true)) {
            respond(400, ["success" => false, "error" => "One or more selected categories are invalid."]);
        }
        if (!in_array($category, $categories, true)) {
            $categories[] = $category;
        }
    }
}

$storedCategories = [];
foreach ($categories as $category) {
    foreach (CATEGORY_STORAGE_ALIASES[$category] as $storedCategory) {
        if (!in_array($storedCategory, $storedCategories, true)) {
            $storedCategories[] = $storedCategory;
        }
    }
}

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

    $sql = "SELECT listing_id, name, price, `condition`, image_url, category
              FROM listings
             WHERE status = 'active'";
    $types = '';
    $parameters = [];

    if ($query !== '') {
        // Escape LIKE wildcards so "%" and "_" are searched literally.
        $escaped = addcslashes($query, '\\%_');
        $startsWith = $escaped . '%';
        $wordStartsWith = '% ' . $escaped . '%';
        $sql .= " AND (LOWER(name) LIKE LOWER(?) ESCAPE '\\\\'
                       OR LOWER(name) LIKE LOWER(?) ESCAPE '\\\\'
                       OR LOWER(category) LIKE LOWER(?) ESCAPE '\\\\')";
        $types .= 'sss';
        array_push($parameters, $startsWith, $wordStartsWith, $startsWith);
    }

    if (count($storedCategories) > 0) {
        $placeholders = implode(', ', array_fill(0, count($storedCategories), '?'));
        $sql .= " AND category IN ($placeholders)";
        $types .= str_repeat('s', count($storedCategories));
        array_push($parameters, ...$storedCategories);
    }

    $sql .= ' ORDER BY listing_id';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        respond(500, ["success" => false, "error" => "Server error."]);
    }
    if (count($parameters) > 0) {
        $stmt->bind_param($types, ...$parameters);
    }
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
            "category"   => canonical_category($row['category']),
        ];
    }

    $stmt->close();
    $conn->close();

    respond(200, ["success" => true, "results" => $results]);

} catch (Throwable $e) {
    // Never expose the underlying PHP/SQL error to the client
    respond(500, ["success" => false, "error" => "Server error."]);
}
