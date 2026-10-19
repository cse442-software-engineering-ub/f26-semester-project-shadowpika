<?php
// Business logic for the buyer's favorites. Every function returns
// [httpStatus, responseBody] so the endpoints in api/ stay thin.
// Reuses the shared helpers (login error, id parsing, active-listing lookup) from meeting_requests.php.

require_once __DIR__ . '/meeting_requests.php';

const KARAVAN_INVALID_LISTING_ID_ERROR = 'A valid listing_id is required.';

// Older rows store retired category names; clients always receive the Create Listing label.
// Kept in sync with LEGACY_CATEGORY_LABELS in api/get_item_details.php.
const KARAVAN_FAVORITE_CATEGORY_LABELS = [
    'Books'       => 'Textbooks',
    'Electronics' => 'Tech & Electronics',
    'Furniture'   => 'Dorm Living',
    'Clothing'    => 'Clothing & Gear',
];

function karavan_format_favorite(array $row): array
{
    $imageUrl = $row['image_url'] ?? null;

    return [
        'listing_id' => (int) $row['listing_id'],
        'name'       => $row['name'],
        'price'      => number_format((float) $row['price'], 2, '.', ''),
        'condition'  => $row['condition'],
        'image_url'  => ($imageUrl === null || trim($imageUrl) === '') ? null : $imageUrl,
        'category'   => KARAVAN_FAVORITE_CATEGORY_LABELS[$row['category']] ?? $row['category'],
    ];
}

function karavan_save_favorite(PDO $pdo, ?int $userId, $input): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    $listingId = is_array($input) ? karavan_parse_positive_id($input['listing_id'] ?? null) : null;
    if ($listingId === null) {
        return [400, ['success' => false, 'error' => KARAVAN_INVALID_LISTING_ID_ERROR]];
    }

    $listing = karavan_find_active_listing($pdo, $listingId);
    if ($listing === null) {
        return [404, ['success' => false, 'error' => KARAVAN_LISTING_NOT_FOUND_ERROR]];
    }
    if ($listing['owner_id'] !== null && (int) $listing['owner_id'] === $userId) {
        return [403, ['success' => false, 'error' => 'You cannot save your own item.']];
    }

    // INSERT IGNORE skips the row when (user_id, listing_id) already exists: 1 row = new, 0 = already saved.
    $insert = $pdo->prepare('INSERT IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)');
    $insert->execute([$userId, $listingId]);
    $status = $insert->rowCount() === 1 ? 201 : 200;

    return [$status, ['success' => true, 'listing_id' => $listingId, 'saved' => true]];
}

function karavan_list_favorites(PDO $pdo, ?int $userId): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    // Two saves can land in the same second, so favorite_id breaks the tie.
    $stmt = $pdo->prepare(
        "SELECT l.listing_id, l.name, l.price, l.`condition`, l.image_url, l.category
           FROM favorites f
           JOIN listings l ON l.listing_id = f.listing_id
          WHERE f.user_id = ? AND l.status = 'active'
          ORDER BY f.created_at DESC, f.favorite_id DESC"
    );
    $stmt->execute([$userId]);

    return [200, ['success' => true, 'favorites' => array_map('karavan_format_favorite', $stmt->fetchAll())]];
}

function karavan_get_favorite_status(PDO $pdo, ?int $userId, $listingIdInput): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    $listingId = karavan_parse_positive_id($listingIdInput);
    if ($listingId === null) {
        return [400, ['success' => false, 'error' => KARAVAN_INVALID_LISTING_ID_ERROR]];
    }

    if (karavan_find_active_listing($pdo, $listingId) === null) {
        return [404, ['success' => false, 'error' => KARAVAN_LISTING_NOT_FOUND_ERROR]];
    }

    $stmt = $pdo->prepare('SELECT 1 FROM favorites WHERE user_id = ? AND listing_id = ? LIMIT 1');
    $stmt->execute([$userId, $listingId]);

    return [200, ['success' => true, 'listing_id' => $listingId, 'saved' => (bool) $stmt->fetch()]];
}
