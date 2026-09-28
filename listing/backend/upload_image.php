<?php
declare(strict_types=1);

// Listing-specific upload endpoint kept separate from the shared project API.
require_once __DIR__ . '/image_storage.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(0);

function respond_with_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '';

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method !== 'POST') {
    header('Allow: POST, OPTIONS');
    respond_with_json(405, [
        'success' => false,
        'error' => 'Method not allowed.',
    ]);
}

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    respond_with_json(400, [
        'success' => false,
        'error' => 'No listing image was provided.',
    ]);
}

try {
    $storedImage = store_listing_image($_FILES['image']);
    $imageUrl = listing_image_public_url($storedImage['filename']);

    respond_with_json(201, [
        'success' => true,
        'image_url' => $imageUrl,
        'image' => [
            'filename' => $storedImage['filename'],
            'url' => $imageUrl,
            'mime_type' => $storedImage['mime_type'],
            'size_bytes' => $storedImage['size_bytes'],
        ],
    ]);
} catch (ListingImageException $exception) {
    respond_with_json($exception->getStatusCode(), [
        'success' => false,
        'error' => $exception->getMessage(),
    ]);
} catch (Throwable $exception) {
    respond_with_json(500, [
        'success' => false,
        'error' => 'The server could not store the listing image.',
    ]);
}
