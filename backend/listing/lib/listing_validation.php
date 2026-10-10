<?php
declare(strict_types=1);

const LISTING_ALLOWED_CATEGORIES = [
    'Textbooks',
    'Tech & Electronics',
    'Dorm Living',
    'Clothing & Gear',
    'Other',
];

const LISTING_ALLOWED_CONDITIONS = [
    'New',
    'Like New',
    'Good',
    'Fair',
    'Acceptable',
];

const LISTING_ALLOWED_MEETING_LOCATIONS = [
    'Capen Hall · Main entrance',
    'Lockwood Memorial Library · Main entrance',
    'Student Union · Main entrance',
    'Center for the Arts · Main entrance',
    'Abbott Library · Main entrance',
];

/**
 * Validates and normalizes fields used to create a listing.
 *
 * @return array{data: array<string, string|null>, errors: array<string, string>}
 */
function validate_create_listing(array $input): array
{
    $title = listing_text($input['title'] ?? '');
    $category = listing_text($input['category'] ?? '');
    $condition = listing_text($input['condition'] ?? '');
    $priceInput = trim((string) ($input['price'] ?? ''));
    $relatedCourse = listing_text($input['related_course'] ?? '');
    $meetingLocation = listing_text($input['meeting_location'] ?? '');
    $description = listing_text($input['description'] ?? '');
    $imageUrl = listing_text($input['image_url'] ?? '');

    $errors = [];

    if ($title === '') {
        $errors['title'] = 'Item title is required.';
    } elseif (listing_length($title) > 150) {
        $errors['title'] = 'Item title must be 150 characters or fewer.';
    }

    if ($category === '') {
        $errors['category'] = 'Category is required.';
    } elseif (!in_array($category, LISTING_ALLOWED_CATEGORIES, true)) {
        $errors['category'] = 'Select a valid category.';
    }

    if ($condition === '') {
        $errors['condition'] = 'Condition is required.';
    } elseif (!in_array($condition, LISTING_ALLOWED_CONDITIONS, true)) {
        $errors['condition'] = 'Select a valid condition.';
    }

    $normalizedPrice = normalize_listing_price($priceInput);
    if ($priceInput === '') {
        $errors['price'] = 'Price is required.';
    } elseif ($normalizedPrice === null) {
        $errors['price'] = 'Enter a price from $0.01 to $9,999.99 with no more than two decimal places.';
    }

    if ($relatedCourse !== '' && listing_length($relatedCourse) > 100) {
        $errors['related_course'] = 'Related course must be 100 characters or fewer.';
    }

    if ($meetingLocation === '') {
        $errors['meeting_location'] = 'Preferred meeting location is required.';
    } elseif (!in_array($meetingLocation, LISTING_ALLOWED_MEETING_LOCATIONS, true)) {
        $errors['meeting_location'] = 'Select an approved campus meeting location.';
    }

    if ($description === '') {
        $errors['description'] = 'Description is required.';
    } elseif (listing_length($description) > 1000) {
        $errors['description'] = 'Description must be 1,000 characters or fewer.';
    }

    if ($imageUrl === '') {
        $errors['image_url'] = 'Item photo is required.';
    } elseif (!is_valid_listing_image_url($imageUrl)) {
        $errors['image_url'] = 'Upload a valid item photo.';
    }

    return [
        'data' => [
            'title' => $title,
            'category' => $category,
            'condition' => $condition,
            'price' => $normalizedPrice,
            'related_course' => $relatedCourse === '' ? null : $relatedCourse,
            'meeting_location' => $meetingLocation,
            'description' => $description,
            'image_url' => $imageUrl,
        ],
        'errors' => $errors,
    ];
}

function is_valid_listing_image_url(string $imageUrl): bool
{
    if (listing_length($imageUrl) > 255) {
        return false;
    }

    $parts = parse_url($imageUrl);
    if ($parts === false || isset($parts['scheme']) || isset($parts['host']) || isset($parts['fragment'])) {
        return false;
    }

    $path = isset($parts['path']) ? (string) $parts['path'] : '';
    if (!preg_match('#(?:^|/)listing/api/image\.php\z#', $path)) {
        return false;
    }

    $query = [];
    parse_str(isset($parts['query']) ? (string) $parts['query'] : '', $query);
    if (count($query) !== 1 || !isset($query['file']) || !is_string($query['file'])) {
        return false;
    }

    return preg_match('/\A[a-f0-9]{32}\.(?:jpg|png|webp)\z/', $query['file']) === 1;
}

function listing_text($value): string
{
    if (!is_scalar($value) && $value !== null) {
        return '';
    }

    return trim((string) $value);
}

function listing_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function normalize_listing_price(string $price): ?string
{
    if (!preg_match('/\A(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?\z/', $price)) {
        return null;
    }

    $numericPrice = (float) $price;
    if ($numericPrice < 0.01 || $numericPrice > 9999.99) {
        return null;
    }

    return number_format($numericPrice, 2, '.', '');
}
