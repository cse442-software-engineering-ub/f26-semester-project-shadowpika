<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/database.php';
require_once __DIR__ . '/../lib/listing_validation.php';
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

function read_create_listing_input(): array
{
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? (string) $_SERVER['CONTENT_TYPE'] : '';
    if (stripos($contentType, 'application/json') === 0) {
        $rawInput = file_get_contents('php://input');
        $decoded = json_decode($rawInput ?: '', true);
        if (!is_array($decoded)) {
            listing_json_response(400, [
                'success' => false,
                'error' => 'The request body must contain valid JSON.',
            ]);
        }
        return $decoded;
    }

    return $_POST;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? (string) $_SERVER['REQUEST_METHOD'] : '';
if ($method !== 'POST') {
    header('Allow: POST');
    listing_json_response(405, [
        'success' => false,
        'error' => 'Method not allowed.',
    ]);
}

$validation = validate_create_listing(read_create_listing_input());
if (!empty($validation['errors'])) {
    listing_json_response(422, [
        'success' => false,
        'error' => 'Correct the highlighted listing fields and try again.',
        'errors' => $validation['errors'],
    ]);
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$ownerId = isset($_SESSION['user_id']) && (int) $_SESSION['user_id'] > 0
    ? (int) $_SESSION['user_id']
    : null;

try {
    $connection = listing_database();
    $createdListing = create_listing($connection, $validation['data'], $ownerId);
    $connection->close();

    listing_json_response(201, [
        'success' => true,
        'message' => 'Your listing was published.',
        'listing' => $createdListing,
    ]);
} catch (Throwable $exception) {
    listing_json_response(500, [
        'success' => false,
        'error' => 'The listing could not be created. Please try again.',
    ]);
}
