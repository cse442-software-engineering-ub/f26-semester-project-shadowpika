<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/database.php';
require_once __DIR__ . '/../lib/listing_repository.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(0);

function listing_json_response(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? (string) $_SERVER['REQUEST_METHOD'] : '';
if ($method !== 'GET') {
    header('Allow: GET');
    listing_json_response(405, [
        'success' => false,
        'error' => 'Method not allowed.',
    ]);
}

$listingId = filter_input(INPUT_GET, 'listing_id', FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1],
]);
if ($listingId === false || $listingId === null) {
    listing_json_response(400, [
        'success' => false,
        'error' => 'A valid listing_id is required.',
    ]);
}

try {
    $connection = listing_database();
    $listing = find_listing_by_id($connection, (int) $listingId);
    $connection->close();

    if ($listing === null) {
        listing_json_response(404, [
            'success' => false,
            'error' => 'Listing not found.',
        ]);
    }

    listing_json_response(200, [
        'success' => true,
        'listing' => $listing,
    ]);
} catch (Throwable $exception) {
    listing_json_response(500, [
        'success' => false,
        'error' => 'The listing could not be loaded. Please try again.',
    ]);
}
