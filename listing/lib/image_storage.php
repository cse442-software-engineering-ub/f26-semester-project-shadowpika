<?php
declare(strict_types=1);

// Shared by the image API and the future create-listing endpoint.
const LISTING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const LISTING_IMAGE_STORAGE_DIRECTORY = __DIR__ . '/../uploads';

const LISTING_IMAGE_ALLOWED_MIME_TYPES = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];

final class ListingImageException extends RuntimeException
{
    private int $statusCode;

    public function __construct(string $message, int $statusCode)
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}

/**
 * Stores a listing image received through a multipart/form-data upload.
 *
 * The original filename is intentionally not reused. A random server-side
 * filename prevents collisions and keeps user-provided paths out of storage.
 *
 * @return array{filename: string, mime_type: string, size_bytes: int}
 */
function store_listing_image(array $upload): array
{
    validate_listing_image_upload_shape($upload);

    $uploadError = (int) $upload['error'];
    if ($uploadError !== UPLOAD_ERR_OK) {
        throw listing_image_upload_error($uploadError);
    }

    $temporaryPath = (string) $upload['tmp_name'];
    $reportedSize = (int) $upload['size'];

    if ($reportedSize <= 0) {
        throw new ListingImageException('The uploaded image is empty.', 400);
    }

    if ($reportedSize > LISTING_IMAGE_MAX_BYTES) {
        throw new ListingImageException('The image must be 5 MB or smaller.', 413);
    }

    if (!is_uploaded_file($temporaryPath)) {
        throw new ListingImageException('The image upload could not be verified.', 400);
    }

    $actualSize = filesize($temporaryPath);
    if ($actualSize === false || $actualSize <= 0) {
        throw new ListingImageException('The uploaded image is empty.', 400);
    }

    if ($actualSize > LISTING_IMAGE_MAX_BYTES) {
        throw new ListingImageException('The image must be 5 MB or smaller.', 413);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($temporaryPath);
    if (!is_string($mimeType) || !array_key_exists($mimeType, LISTING_IMAGE_ALLOWED_MIME_TYPES)) {
        throw new ListingImageException('Only JPEG, PNG, and WebP images are allowed.', 415);
    }

    ensure_listing_image_storage_directory();

    $extension = LISTING_IMAGE_ALLOWED_MIME_TYPES[$mimeType];
    try {
        $filename = bin2hex(random_bytes(16)) . '.' . $extension;
    } catch (Throwable $exception) {
        throw new ListingImageException('The server could not create an image filename.', 500);
    }

    $destination = LISTING_IMAGE_STORAGE_DIRECTORY . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($temporaryPath, $destination)) {
        throw new ListingImageException('The server could not save the uploaded image.', 500);
    }

    // Failure to change permissions should not make an otherwise valid upload fail.
    @chmod($destination, 0644);

    return [
        'filename' => $filename,
        'mime_type' => $mimeType,
        'size_bytes' => (int) $actualSize,
    ];
}

function ensure_listing_image_storage_directory(): void
{
    if (!is_dir(LISTING_IMAGE_STORAGE_DIRECTORY)) {
        if (!mkdir(LISTING_IMAGE_STORAGE_DIRECTORY, 0755, true) && !is_dir(LISTING_IMAGE_STORAGE_DIRECTORY)) {
            throw new ListingImageException('The image storage directory is unavailable.', 500);
        }
    }

    if (!is_writable(LISTING_IMAGE_STORAGE_DIRECTORY)) {
        throw new ListingImageException('The image storage directory is not writable.', 500);
    }
}

function validate_listing_image_upload_shape(array $upload): void
{
    foreach (['error', 'tmp_name', 'size'] as $requiredKey) {
        if (!array_key_exists($requiredKey, $upload)) {
            throw new ListingImageException('No listing image was provided.', 400);
        }
    }

    if (is_array($upload['error']) || is_array($upload['tmp_name']) || is_array($upload['size'])) {
        throw new ListingImageException('Only one listing image can be uploaded at a time.', 400);
    }
}

function listing_image_upload_error(int $uploadError): ListingImageException
{
    switch ($uploadError) {
        case UPLOAD_ERR_NO_FILE:
            return new ListingImageException('No listing image was provided.', 400);
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return new ListingImageException('The image must be 5 MB or smaller.', 413);
        case UPLOAD_ERR_PARTIAL:
            return new ListingImageException('The image upload was interrupted. Please try again.', 400);
        default:
            return new ListingImageException('The image could not be uploaded.', 500);
    }
}

function listing_image_public_url(string $filename): string
{
    $scriptName = isset($_SERVER['SCRIPT_NAME']) && is_string($_SERVER['SCRIPT_NAME'])
        ? str_replace('\\', '/', $_SERVER['SCRIPT_NAME'])
        : '/api/listing/upload_image.php';

    $directory = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
    return $directory . '/image.php?file=' . rawurlencode($filename);
}

function listing_image_path(string $filename): ?string
{
    if (!preg_match('/\A[a-f0-9]{32}\.(?:jpg|png|webp)\z/', $filename)) {
        return null;
    }

    return LISTING_IMAGE_STORAGE_DIRECTORY . DIRECTORY_SEPARATOR . $filename;
}
