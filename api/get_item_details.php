<?php
// GET /api/get_item_details.php?listing_id=<id>
// Returns the details shown on item.html for one ACTIVE listing: name, price, condition,
// category, and description. Sold, inactive, and missing listings are all "Listing not found."
header("Content-Type: application/json");

// Suppress all warnings/notices so nothing (SQL errors, stack traces) leaks into the JSON payload
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

// Earlier marketplace prototypes stored shorter category labels. Clients always receive the
// Create Listing label. Kept in sync with CATEGORY_STORAGE_ALIASES in search_listings.php.
const LEGACY_CATEGORY_LABELS = [
    'Books'       => 'Textbooks',
    'Electronics' => 'Tech & Electronics',
    'Furniture'   => 'Dorm Living',
    'Clothing'    => 'Clothing & Gear',
];

function respond(int $status, array $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// KARAVAN_DB_DSN lets the test suite point this endpoint at SQLite, like includes/config.php.
function item_details_pdo(): PDO {
    $dsn = getenv('KARAVAN_DB_DSN') ?: 'mysql:host=localhost;dbname=cse442_2026_fall_team_j_db;charset=utf8mb4';
    $user = getenv('KARAVAN_DB_USER') ?: 'ndberg';
    $pass = getenv('KARAVAN_DB_PASS') ?: '50250298';

    return new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    respond(405, ["success" => false, "error" => "Method not allowed."]);
}

// --- INPUT VALIDATION ---
// Only a whole number of 1 or more; "abc", "0", and "91001 OR 1=1" are all rejected here.
$listingId = filter_var($_GET['listing_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($listingId === false) {
    respond(400, ["success" => false, "error" => "A valid listing_id is required."]);
}

try {
    $stmt = item_details_pdo()->prepare(
        "SELECT listing_id, name, price, `condition`, category, description
           FROM listings
          WHERE listing_id = ? AND status = 'active'"
    );
    $stmt->execute([$listingId]);
    $row = $stmt->fetch();

    if (!$row) {
        respond(404, ["success" => false, "error" => "Listing not found."]);
    }

    $description = $row['description'] ?? null;

    respond(200, [
        "success" => true,
        "listing" => [
            "listing_id"  => (int) $row['listing_id'],
            "name"        => $row['name'],
            "price"       => number_format((float) $row['price'], 2, '.', ''),
            "condition"   => $row['condition'],
            "category"    => LEGACY_CATEGORY_LABELS[$row['category']] ?? $row['category'],
            "description" => ($description === null || trim($description) === '') ? null : $description,
        ],
    ]);
} catch (Throwable $e) {
    // Never expose the underlying PHP/SQL error to the client
    respond(500, ["success" => false, "error" => "Server error."]);
}
