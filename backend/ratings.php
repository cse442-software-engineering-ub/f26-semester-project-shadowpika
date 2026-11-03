<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../includes/db.php';

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    $pdo = karavan_pdo();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    /*
     * GET: Retrieve all ratings for a seller.
     * Example: rating.php?seller_id=12
     */
    if ($method === 'GET') {
        $sellerId = filter_input(
            INPUT_GET,
            'seller_id',
            FILTER_VALIDATE_INT
        );

        if (!$sellerId || $sellerId < 1) {
            respond(400, [
                'success' => false,
                'message' => 'A valid seller_id is required.'
            ]);
        }

        $stmt = $pdo->prepare("
            SELECT
                r.reviewer_id,
                r.seller_id,
                r.stars,
                r.review,
                r.time,
                reviewer.username AS reviewer_username,
                seller.username AS seller_username
            FROM ratings AS r
            LEFT JOIN users AS reviewer
                ON reviewer.id = r.reviewer_id
            LEFT JOIN users AS seller
                ON seller.id = r.seller_id
            WHERE r.seller_id = ?
            ORDER BY r.time DESC
        ");

$stmt->execute([$sellerId]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt->execute([$sellerId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $ratings = [];

        foreach ($rows as $row) {
            $ratings[] = [
                'reviewer_id' => (int) $row['reviewer_id'],
                'seller_id' => (int) $row['seller_id'],
                'rating' => (int) $row['stars'],
                'review' => $row['review'] ?? '',
                'name' => $row['username'] ?? 'User',
                'seller_name' => $row['seller_username'] ?? 'Seller',
                'createdAt' => $row['time']
            ];
        }

        $stmt = $pdo->prepare("
            SELECT rating, username
            FROM users
            WHERE id = ?
            LIMIT 1
        ");
        $stmt->execute([$sellerId]);
        $seller = $stmt->fetch(PDO::FETCH_ASSOC);

        $sellerRating = $seller['rating'] ?? null;
        $sellerUsername = $seller['username'] ?? null;

        respond(200, [
            'success' => true,
            'ratings' => $ratings,
            'averageRating' => $sellerRating === false
                || $sellerRating === null
                ? null
                : (float) $sellerRating,
            'ratingCount' => count($ratings),
            'seller_name' => $sellerUsername
        ]);
    }

    /*
     * POST: Submit or update the logged-in user's rating.
     * Expects a JSON body:
     * {
     *   "seller_id": 12,
     *   "rating": 5,
     *   "review": "Great seller!"
     * }
     */
    if ($method === 'POST') {
        // Authentication check.
        if (empty($_SESSION['user_id'])) {
            respond(401, [
                'success' => false,
                'message' => 'You must be logged in to submit a rating.'
            ]);
        }

        $reviewerId = (int) $_SESSION['user_id'];

        $input = json_decode(
            file_get_contents('php://input'),
            true
        );

        if (!is_array($input)) {
            respond(400, [
                'success' => false,
                'message' => 'Invalid JSON request.'
            ]);
        }

        $sellerId = filter_var(
            $input['seller_id'] ?? null,
            FILTER_VALIDATE_INT
        );

        $stars = filter_var(
            $input['rating'] ?? null,
            FILTER_VALIDATE_INT
        );

        $review = trim((string) ($input['review'] ?? ''));

        if (!$sellerId || $sellerId < 1) {
            respond(400, [
                'success' => false,
                'message' => 'A valid seller_id is required.'
            ]);
        }

        if ($stars === false || $stars < 1 || $stars > 5) {
            respond(400, [
                'success' => false,
                'message' => 'Rating must be between 1 and 5 stars.'
            ]);
        }

        if (mb_strlen($review) > 1000) {
            respond(400, [
                'success' => false,
                'message' => 'Review must be 1000 characters or fewer.'
            ]);
        }

        if ($reviewerId === (int) $sellerId) {
            respond(400, [
                'success' => false,
                'message' => 'You cannot rate yourself.'
            ]);
        }

        // Confirm that the seller exists.
        $stmt = $pdo->prepare("
            SELECT id
            FROM users
            WHERE id = ?
            LIMIT 1
        ");
        $stmt->execute([$sellerId]);

        if (!$stmt->fetchColumn()) {
            respond(404, [
                'success' => false,
                'message' => 'Seller not found.'
            ]);
        }

        $pdo->beginTransaction();

        /*
         * Save the rating.
         * Requires a UNIQUE index on (reviewer_id, seller_id).
         * A reviewer can then have only one rating per seller.
         */
        $stmt = $pdo->prepare("
            INSERT INTO ratings
                (reviewer_id, seller_id, stars, review, time)
            VALUES
                (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                stars = VALUES(stars),
                review = VALUES(review),
                time = CURRENT_TIMESTAMP
        ");

        $stmt->execute([
            $reviewerId,
            $sellerId,
            $stars,
            $review
        ]);

        /*
         * Recalculate the seller's average using every rating.
         * Updating an existing review will not count it twice.
         */
        $stmt = $pdo->prepare("
            SELECT AVG(stars)
            FROM ratings
            WHERE seller_id = ?
        ");
        $stmt->execute([$sellerId]);

        $averageRating = $stmt->fetchColumn();

        // Save the average in users.rating.
        $stmt = $pdo->prepare("
            UPDATE users
            SET rating = ?
            WHERE id = ?
        ");

        $stmt->execute([
            $averageRating,
            $sellerId
        ]);

        $pdo->commit();

        respond(200, [
            'success' => true,
            'message' => 'Rating saved successfully.',
            'averageRating' => round((float) $averageRating, 2)
        ]);
    }

    header('Allow: GET, POST');

    respond(405, [
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Rating API error: ' . $e->getMessage());

    respond(500, [
        'success' => false,
        'message' => 'A server error occurred while processing the rating.'
    ]);
}
