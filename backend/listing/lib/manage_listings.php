<?php
declare(strict_types=1);

const MANAGE_LISTING_CATEGORIES = [
    'Textbooks',
    'Tech & Electronics',
    'Dorm Living',
    'Clothing & Gear',
    'Other',
];

const MANAGE_LISTING_CONDITIONS = [
    'New',
    'Like New',
    'Good',
    'Fair',
    'Acceptable',
];

function manage_listings_not_logged_in(): array
{
    return [401, ['success' => false, 'error' => 'You are not logged in.']];
}

function manage_listings_positive_id($value): ?int
{
    if (is_bool($value) || is_array($value) || $value === null) {
        return null;
    }
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    return $id === false ? null : $id;
}

function manage_listings_text($value): string
{
    return is_scalar($value) || $value === null ? trim((string) $value) : '';
}

function manage_listings_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function manage_listings_format(array $row): array
{
    return [
        'listing_id'       => (int) $row['listing_id'],
        'name'             => $row['name'],
        'price'            => number_format((float) $row['price'], 2, '.', ''),
        'condition'        => $row['condition'],
        'image_url'        => $row['image_url'],
        'category'         => $row['category'],
        'related_course'   => $row['related_course'],
        'meeting_location' => $row['meeting_location'],
        'description'      => $row['description'],
        'status'           => $row['status'],
    ];
}

function get_my_listings(PDO $pdo, ?int $userId): array
{
    if ($userId === null) {
        return manage_listings_not_logged_in();
    }

    $stmt = $pdo->prepare(
        'SELECT listing_id, name, price, `condition`, image_url, category,
                related_course, meeting_location, description, status
           FROM listings
          WHERE owner_id = ?
          ORDER BY listing_id'
    );
    $stmt->execute([$userId]);

    return [200, [
        'success' => true,
        'results' => array_map('manage_listings_format', $stmt->fetchAll()),
    ]];
}

function manage_listings_owned(PDO $pdo, int $userId, int $listingId): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM listings WHERE listing_id = ? AND owner_id = ?');
    $stmt->execute([$listingId, $userId]);
    return (bool) $stmt->fetchColumn();
}

function manage_listings_price($value): ?string
{
    if ((!is_string($value) && !is_int($value) && !is_float($value))
        || !preg_match('/\A(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?\z/', trim((string) $value))) {
        return null;
    }
    $price = (float) $value;
    return $price >= 0.01 && $price <= 9999.99 ? number_format($price, 2, '.', '') : null;
}

function manage_listings_save_data(array $input): array
{
    $data = [
        'name'             => manage_listings_text($input['name'] ?? ''),
        'price'            => manage_listings_price($input['price'] ?? null),
        'category'         => manage_listings_text($input['category'] ?? ''),
        'condition'        => manage_listings_text($input['condition'] ?? ''),
        'related_course'   => manage_listings_text($input['related_course'] ?? ''),
        'meeting_location' => manage_listings_text($input['meeting_location'] ?? ''),
        'description'      => manage_listings_text($input['description'] ?? ''),
        'image_url'        => manage_listings_text($input['image_url'] ?? ''),
    ];

    $valid = $data['name'] !== '' && manage_listings_length($data['name']) <= 255
        && $data['price'] !== null
        && in_array($data['category'], MANAGE_LISTING_CATEGORIES, true)
        && in_array($data['condition'], MANAGE_LISTING_CONDITIONS, true)
        && manage_listings_length($data['related_course']) <= 100
        && $data['meeting_location'] !== '' && manage_listings_length($data['meeting_location']) <= 150
        && $data['description'] !== '' && manage_listings_length($data['description']) <= 1000
        && manage_listings_length($data['image_url']) <= 255;

    return [$valid, $data];
}

function update_my_listing(PDO $pdo, ?int $userId, $input): array
{
    if ($userId === null) {
        return manage_listings_not_logged_in();
    }
    if (!is_array($input)) {
        return [400, ['success' => false, 'error' => 'The request body must contain valid JSON.']];
    }

    $listingId = manage_listings_positive_id($input['listing_id'] ?? null);
    if ($listingId === null) {
        return [400, ['success' => false, 'error' => 'A valid listing_id is required.']];
    }
    if (!manage_listings_owned($pdo, $userId, $listingId)) {
        return [404, ['success' => false, 'error' => 'Listing not found.']];
    }

    $action = manage_listings_text($input['action'] ?? '');
    if ($action === 'delete') {
        $stmt = $pdo->prepare('DELETE FROM listings WHERE listing_id = ? AND owner_id = ?');
        $stmt->execute([$listingId, $userId]);
        return [200, ['success' => true]];
    }

    if ($action === 'update_status') {
        $status = manage_listings_text($input['status'] ?? '');
        if (!in_array($status, ['active', 'sold'], true)) {
            return [422, ['success' => false, 'error' => 'Status must be active or sold.']];
        }
        $stmt = $pdo->prepare('UPDATE listings SET status = ? WHERE listing_id = ? AND owner_id = ?');
        $stmt->execute([$status, $listingId, $userId]);
        return [200, ['success' => true]];
    }

    if ($action === 'save_changes') {
        [$valid, $data] = manage_listings_save_data($input);
        if (!$valid) {
            return [422, ['success' => false, 'error' => 'Enter valid listing details.']];
        }
        $stmt = $pdo->prepare(
            'UPDATE listings
                SET name = ?, price = ?, category = ?, `condition` = ?, related_course = ?,
                    meeting_location = ?, description = ?, image_url = ?
              WHERE listing_id = ? AND owner_id = ?'
        );
        $stmt->execute([
            $data['name'], $data['price'], $data['category'], $data['condition'],
            $data['related_course'] === '' ? null : $data['related_course'],
            $data['meeting_location'], $data['description'],
            $data['image_url'] === '' ? null : $data['image_url'],
            $listingId, $userId,
        ]);
        return [200, ['success' => true]];
    }

    return [400, ['success' => false, 'error' => 'A valid action is required.']];
}
