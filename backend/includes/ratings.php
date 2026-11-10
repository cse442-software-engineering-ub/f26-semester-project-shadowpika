<?php
// Seller ratings and reviews (cards #132, #133). A buyer can rate a seller once they have
// completed a purchase together: an approved meeting where both of them checked in.
// Each buyer has one rating per seller; submitting again replaces it.
require_once __DIR__ . '/meeting_requests.php';

const KARAVAN_REVIEW_MAX_LENGTH = 1000;
const KARAVAN_RATING_PURCHASE_ERROR = 'You can only rate a seller after completing a purchase with them.';

function karavan_rating_error(int $status, string $error): array
{
    return [$status, ['success' => false, 'error' => $error]];
}

/** @return array{average_rating: ?float, rating_count: int} */
function karavan_seller_rating_summary(PDO $pdo, int $sellerId): array
{
    $stmt = $pdo->prepare('SELECT COUNT(*) AS rating_count, AVG(stars) AS average FROM ratings WHERE seller_id = ?');
    $stmt->execute([$sellerId]);
    $row = $stmt->fetch();
    $count = (int) ($row['rating_count'] ?? 0);
    return [
        'average_rating' => $count === 0 ? null : round((float) $row['average'], 1),
        'rating_count'   => $count,
    ];
}

function karavan_has_completed_purchase(PDO $pdo, int $buyerId, int $sellerId): bool
{
    $stmt = $pdo->prepare(
        "SELECT 1 FROM meeting_requests r
           JOIN listings l ON l.listing_id = r.listing_id
          WHERE r.buyer_id = ? AND l.owner_id = ? AND r.status = 'approved'
            AND r.checked_in_at IS NOT NULL AND r.seller_checked_in_at IS NOT NULL
          LIMIT 1"
    );
    $stmt->execute([$buyerId, $sellerId]);
    return $stmt->fetchColumn() !== false;
}

function karavan_find_seller(PDO $pdo, $sellerInput): ?array
{
    $sellerId = filter_var($sellerInput, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($sellerId === false) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id, username FROM users WHERE id = ?');
    $stmt->execute([$sellerId]);
    $row = $stmt->fetch();
    return $row ? ['id' => (int) $row['id'], 'username' => $row['username']] : ['id' => $sellerId, 'username' => null];
}

/** GET api/ratings.php?seller_id=<id> */
function karavan_get_seller_ratings(PDO $pdo, ?int $viewerId, $sellerInput): array
{
    if ($viewerId === null) {
        return karavan_not_logged_in();
    }
    $seller = karavan_find_seller($pdo, $sellerInput);
    if ($seller === null) {
        return karavan_rating_error(400, 'A valid seller_id is required.');
    }
    if ($seller['username'] === null) {
        return karavan_rating_error(404, 'Seller not found.');
    }

    $stmt = $pdo->prepare(
        'SELECT r.reviewer_id, r.stars, r.review, r.`time`, u.username AS reviewer_username
           FROM ratings r
           LEFT JOIN users u ON u.id = r.reviewer_id
          WHERE r.seller_id = ?
          ORDER BY r.`time` DESC'
    );
    $stmt->execute([$seller['id']]);

    $ratings = [];
    $mine = null;
    foreach ($stmt->fetchAll() as $row) {
        $rating = [
            'reviewer_name' => $row['reviewer_username'] ?? 'Former user',
            'rating'        => (int) $row['stars'],
            'review'        => $row['review'] ?? '',
            'created_at'    => karavan_rating_time($row['time']),
        ];
        $ratings[] = $rating;
        if ((int) $row['reviewer_id'] === $viewerId) {
            $mine = ['rating' => $rating['rating'], 'review' => $rating['review']];
        }
    }

    $summary = karavan_seller_rating_summary($pdo, $seller['id']);
    $isSeller = $seller['id'] === $viewerId;
    return [200, [
        'success'       => true,
        'seller_id'     => $seller['id'],
        'seller_name'   => $seller['username'],
        'averageRating' => $summary['average_rating'],
        'ratingCount'   => $summary['rating_count'],
        'ratings'       => $ratings,
        'is_seller'     => $isSeller,
        'can_rate'      => !$isSeller && karavan_has_completed_purchase($pdo, $viewerId, $seller['id']),
        'my_rating'     => $mine,
    ]];
}

function karavan_rating_time(?string $value): ?string
{
    if ($value === null || $value === '') return null;
    return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z');
}

/** POST api/ratings.php  Body: {"seller_id": 217, "rating": 5, "review": "Great seller!"} */
function karavan_save_rating(PDO $pdo, ?int $viewerId, $input, ?DateTimeImmutable $now = null): array
{
    if ($viewerId === null) {
        return karavan_rating_error(401, 'You must be logged in to submit a rating.');
    }
    if (!is_array($input)) {
        return karavan_rating_error(400, 'Invalid JSON request.');
    }
    $seller = karavan_find_seller($pdo, $input['seller_id'] ?? null);
    if ($seller === null) {
        return karavan_rating_error(400, 'A valid seller_id is required.');
    }
    $stars = filter_var($input['rating'] ?? null, FILTER_VALIDATE_INT);
    if ($stars === false || $stars < 1 || $stars > 5) {
        return karavan_rating_error(400, 'Rating must be between 1 and 5 stars.');
    }
    $rawReview = $input['review'] ?? '';
    if (!is_string($rawReview)) {
        return karavan_rating_error(400, 'Review must be text.');
    }
    $review = trim($rawReview);
    if (mb_strlen($review) > KARAVAN_REVIEW_MAX_LENGTH) {
        return karavan_rating_error(400, 'Review must be 1000 characters or fewer.');
    }
    if ($seller['id'] === $viewerId) {
        return karavan_rating_error(400, 'You cannot rate yourself.');
    }
    if ($seller['username'] === null) {
        return karavan_rating_error(404, 'Seller not found.');
    }
    if (!karavan_has_completed_purchase($pdo, $viewerId, $seller['id'])) {
        return karavan_rating_error(403, KARAVAN_RATING_PURCHASE_ERROR);
    }

    $time = ($now ?? new DateTimeImmutable('now'))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM ratings WHERE reviewer_id = ? AND seller_id = ?');
        $stmt->execute([$viewerId, $seller['id']]);
        $updated = (int) $stmt->fetchColumn() > 0;
        if ($updated) {
            $pdo->prepare('UPDATE ratings SET stars = ?, review = ?, `time` = ? WHERE reviewer_id = ? AND seller_id = ?')
                ->execute([$stars, $review, $time, $viewerId, $seller['id']]);
        } else {
            $pdo->prepare('INSERT INTO ratings (reviewer_id, seller_id, stars, review, `time`) VALUES (?, ?, ?, ?, ?)')
                ->execute([$viewerId, $seller['id'], $stars, $review, $time]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $summary = karavan_seller_rating_summary($pdo, $seller['id']);
    return [200, [
        'success'       => true,
        'message'       => 'Rating saved successfully.',
        'updated'       => $updated,
        'averageRating' => $summary['average_rating'],
        'ratingCount'   => $summary['rating_count'],
    ]];
}
