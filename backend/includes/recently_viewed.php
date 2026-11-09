<?php
// Business logic for the Home page's previously viewed items. Returns [httpStatus, responseBody]
// so the endpoints in api/ stay thin. Reuses the shared login error, id parsing, and community helpers.

require_once __DIR__ . '/favorites.php';
require_once __DIR__ . '/communities.php';
require_once __DIR__ . '/recommended_items.php';

const KARAVAN_PREVIOUSLY_VIEWED_LIMIT = 15;

function karavan_record_viewed_item(PDO $pdo, ?int $userId, $input): array
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
    // Own items are never part of the history, so there is nothing to record.
    if ($listing['owner_id'] !== null && (int) $listing['owner_id'] === $userId) {
        return [200, ['success' => true]];
    }
    if (!karavan_can_shop_listing($pdo, $userId, $listing)) {
        return [403, ['success' => false, 'error' => KARAVAN_NOT_A_MEMBER_ERROR]];
    }

    // One row per user and item: opening an item again only moves it to the front.
    $upsert = $pdo->prepare(
        'INSERT INTO recently_viewed (user_id, listing_id, viewed_at) VALUES (?, ?, NOW(6))
         ON DUPLICATE KEY UPDATE viewed_at = NOW(6)'
    );
    $upsert->execute([$userId, $listingId]);

    return [200, ['success' => true]];
}

function karavan_list_previously_viewed_items(PDO $pdo, ?int $userId): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    // Items that were sold, hidden, or left behind with a community the user left drop out of the list.
    $communities = karavan_member_listing_communities($pdo, $userId);

    $placeholders = implode(', ', array_fill(0, count($communities), '?'));
    $stmt = $pdo->prepare(
        "SELECT l.listing_id, l.name, l.price, l.image_url
           FROM recently_viewed rv
           JOIN listings l ON l.listing_id = rv.listing_id
          WHERE rv.user_id = ?
            AND l.status = 'active'
            AND l.community IN ($placeholders)
            AND (l.owner_id IS NULL OR l.owner_id <> ?)
          ORDER BY rv.viewed_at DESC, l.listing_id DESC
          LIMIT " . KARAVAN_PREVIOUSLY_VIEWED_LIMIT
    );
    $stmt->execute([$userId, ...$communities, $userId]);

    return [200, ['success' => true, 'items' => array_map('karavan_format_recommended_item', $stmt->fetchAll())]];
}
