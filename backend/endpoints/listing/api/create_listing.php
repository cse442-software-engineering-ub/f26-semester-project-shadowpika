<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/database.php';
require_once __DIR__ . '/../lib/listing_validation.php';
require_once __DIR__ . '/../lib/listing_repository.php';
require_once __DIR__ . '/../lib/community_repository.php';
require_once __DIR__ . '/../lib/image_storage.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/communities.php';

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

try {
    karavan_start_session();
    $authPdo = karavan_pdo();
    $user = karavan_current_user($authPdo);
    if ($user === null) {
        listing_json_response(401, ['success' => false, 'error' => 'You must be logged in.']);
    }
    $ownerId = (int) $user['id'];

    $validation = validate_create_listing(read_create_listing_input());
    if (empty($validation['errors'])) {
        $imageFilename = listing_image_filename_from_url($validation['data']['image_url']);
        if ($imageFilename === null || !listing_image_exists($imageFilename)) {
            $validation['errors']['image_url'] = 'The uploaded item photo could not be found. Upload it again.';
        }
    }
    if (!empty($validation['errors'])) {
        listing_json_response(422, [
            'success' => false,
            'error' => 'Correct the highlighted listing fields and try again.',
            'errors' => $validation['errors'],
        ]);
    }

    $connection = listing_database();
    $communitySelection = validate_listing_community_location(
        $connection,
        $validation['data']['community'],
        $validation['data']['meeting_location_id']
    );
    if (!empty($communitySelection['errors'])) {
        $connection->close();
        listing_json_response(422, [
            'success' => false,
            'error' => 'Correct the highlighted listing fields and try again.',
            'errors' => $communitySelection['errors'],
        ]);
    }

    // Use the same automatic campus, joined-community and administrator rules
    // as the rest of the marketplace. Shopping preferences do not remove membership.
    if (!in_array($validation['data']['community'], karavan_member_listing_communities($authPdo, $ownerId), true)) {
        $connection->close();
        listing_json_response(403, [
            'success' => false,
            'error' => 'You must join this community before creating a listing.',
        ]);
    }

    // Never trust a label supplied by the browser. Store the label attached to the selected ID.
    $validation['data']['meeting_location'] = $communitySelection['location']['label'];
    $connection->begin_transaction();
    $createdListing = create_listing($connection, $validation['data'], $ownerId);
    $connection->commit();
    $connection->close();

    listing_json_response(201, [
        'success' => true,
        'message' => 'Your listing was published.',
        'listing' => $createdListing,
    ]);
} catch (Throwable $exception) {
    if (isset($connection) && $connection instanceof mysqli) {
        $connection->rollback();
        $connection->close();
    }
    listing_json_response(500, [
        'success' => false,
        'error' => 'The listing could not be created. Please try again.',
    ]);
}
