<?php
// Business logic for the Home page's recommended items. Returns [httpStatus, responseBody]
// so the endpoint in api/ stays thin. Reuses the shared login error and community helpers.

require_once __DIR__ . '/meeting_requests.php';
require_once __DIR__ . '/communities.php';

const KARAVAN_RECOMMENDED_ITEMS_LIMIT = 15;

function karavan_format_recommended_item(array $row): array
{
    return [
        'listing_id' => (int) $row['listing_id'],
        'name'       => $row['name'],
        'price'      => number_format((float) $row['price'], 2, '.', ''),
        'image_url'  => $row['image_url'],
    ];
}

function karavan_list_recommended_items(PDO $pdo, ?int $userId): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }

    // Only communities the user shops from; with none there is nothing to recommend (and no empty IN ()).
    $communities = karavan_member_listing_communities($pdo, $userId, true);
    if ($communities === []) {
        return [200, ['success' => true, 'items' => []]];
    }

    $placeholders = implode(', ', array_fill(0, count($communities), '?'));
    $stmt = $pdo->prepare(
        "SELECT listing_id, name, price, image_url
           FROM listings
          WHERE status = 'active'
            AND community IN ($placeholders)
            AND (owner_id IS NULL OR owner_id <> ?)
          ORDER BY RAND()
          LIMIT " . KARAVAN_RECOMMENDED_ITEMS_LIMIT
    );
    $stmt->execute([...$communities, $userId]);

    return [200, ['success' => true, 'items' => array_map('karavan_format_recommended_item', $stmt->fetchAll())]];
}
