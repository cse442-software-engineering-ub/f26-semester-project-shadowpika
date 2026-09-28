<?php
declare(strict_types=1);

require_once __DIR__ . '/image_storage.php';

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(0);

function respond_with_image_error(int $statusCode, string $message): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode([
        'success' => false,
        'error' => $message,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '';
if ($method !== 'GET' && $method !== 'HEAD') {
    header('Allow: GET, HEAD');
    respond_with_image_error(405, 'Method not allowed.');
}

$filename = isset($_GET['file']) && is_string($_GET['file']) ? $_GET['file'] : '';
$imagePath = listing_image_path($filename);

if ($filename === '' || $imagePath === null) {
    respond_with_image_error(400, 'A valid image file is required.');
}

if (!is_file($imagePath) || !is_readable($imagePath)) {
    respond_with_image_error(404, 'Listing image not found.');
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($imagePath);
if (!is_string($mimeType) || !array_key_exists($mimeType, LISTING_IMAGE_ALLOWED_MIME_TYPES)) {
    respond_with_image_error(404, 'Listing image not found.');
}

$size = filesize($imagePath);
if ($size === false) {
    respond_with_image_error(500, 'The listing image could not be read.');
}

header('Content-Type: ' . $mimeType);
header('Content-Length: ' . $size);
header('Content-Disposition: inline; filename="' . $filename . '"');
header('Cache-Control: public, max-age=31536000, immutable');
header('X-Content-Type-Options: nosniff');

if ($method === 'HEAD') {
    exit;
}

readfile($imagePath);
exit;
