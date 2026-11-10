<?php
declare(strict_types=1);

function listing_gallery_urls(array $rows, ?string $legacy): array
{
    return $rows ? array_column($rows, 'image_url') : (($legacy !== null && trim($legacy) !== '') ? [$legacy] : []);
}
function listing_images_pdo(PDO $pdo, int $listingId, ?string $legacy): array
{
    $stmt = $pdo->prepare('SELECT image_url FROM listing_images WHERE listing_id = ? ORDER BY `position`');
    $stmt->execute([$listingId]);
    return listing_gallery_urls($stmt->fetchAll(PDO::FETCH_ASSOC), $legacy);
}
function listing_images_mysqli(mysqli $connection, int $listingId, ?string $legacy): array
{
    $stmt = $connection->prepare('SELECT image_url FROM listing_images WHERE listing_id = ? ORDER BY `position`');
    $stmt->bind_param('i', $listingId); $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC); $stmt->close();
    return listing_gallery_urls($rows, $legacy);
}
// Caller owns the listing/image transaction, including rollback on insert failure.
function store_listing_images(mysqli $connection, int $listingId, array $urls): void
{
    $stmt = $connection->prepare('INSERT INTO listing_images (listing_id, `position`, image_url) VALUES (?, ?, ?)');
    foreach ($urls as $position => $url) {
        $stmt->bind_param('iis', $listingId, $position, $url); $stmt->execute();
    }
    $stmt->close();
}
