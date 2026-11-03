<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../includes/db.php';

function respond(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    $pdo = karavan_pdo();

    // Identify the logged-in user.
    $identity = $_COOKIE['karavan_auth_cookie'] ?? '';

    if ($identity === '') {
        respond(401, [
            'success' => false,
            'error' => 'Please log in.'
        ]);
    }

    error_log("Conversations API: executing query");

    $stmt = $pdo->prepare(
        'SELECT id
         FROM users
         WHERE username = :username OR email = :email
         LIMIT 1'
    );

    $stmt->execute([
        'username' => $identity,
        'email' => $identity
    ]);

    error_log("Conversations API: query executed");

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        respond(401, [
            'success' => false,
            'error' => 'Invalid login.'
        ]);
    }

    $userId = (int) $user['id'];

    // Optionally retrieve a seller's username for a new draft chat.
    if (isset($_GET['seller_id'])) {
        $sellerId = filter_var(
            $_GET['seller_id'],
            FILTER_VALIDATE_INT
        );

        if (!$sellerId || $sellerId === $userId) {
            respond(400, [
                'success' => false,
                'error' => 'Invalid seller ID.'
            ]);
        }

        $stmt = $pdo->prepare(
            'SELECT username
            FROM users
            WHERE id = :seller_id
            LIMIT 1'
        );

        $stmt->execute(['seller_id' => $sellerId]);
        $seller = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$seller) {
            respond(404, [
                'success' => false,
                'error' => 'Seller not found.'
            ]);
        }

        respond(200, [
            'success' => true,
            'username' => $seller['username']
        ]);
    }

    /*
     * Each conversation is identified by:
     *   1. The other participant
     *   2. The listing being discussed
     *
     * The <=> operator handles NULL listing IDs for older messages.
     */
    $sql = '
        SELECT
            c.partner_id AS id,
            partner.username AS name,
            c.listing_id,
            COALESCE(listing.name, \'\') AS listing,

            (
                SELECT m.message
                FROM messages m
                WHERE (
                    (m.sender_id = :last_sender AND m.receiver_id = c.partner_id)
                    OR
                    (m.sender_id = c.partner_id AND m.receiver_id = :last_receiver)
                )
                AND m.listing_id <=> c.listing_id
                ORDER BY m.`timestamp` DESC, m.position DESC
                LIMIT 1
            ) AS last_message,

            (
                SELECT m.`timestamp`
                FROM messages m
                WHERE (
                    (m.sender_id = :time_sender AND m.receiver_id = c.partner_id)
                    OR
                    (m.sender_id = c.partner_id AND m.receiver_id = :time_receiver)
                )
                AND m.listing_id <=> c.listing_id
                ORDER BY m.`timestamp` DESC, m.position DESC
                LIMIT 1
            ) AS last_timestamp

        FROM (
            SELECT DISTINCT
                CASE
                    WHEN sender_id = :case_user
                    THEN receiver_id
                    ELSE sender_id
                END AS partner_id,
                listing_id
            FROM messages
            WHERE sender_id = :sent_user
               OR receiver_id = :received_user
        ) c

        INNER JOIN users partner
            ON partner.id = c.partner_id

        LEFT JOIN listings listing
            ON listing.listing_id = c.listing_id

        WHERE c.partner_id <> :exclude_user

        ORDER BY last_timestamp DESC, partner.username ASC
    ';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'last_sender' => $userId,
        'last_receiver' => $userId,
        'time_sender' => $userId,
        'time_receiver' => $userId,
        'case_user' => $userId,
        'sent_user' => $userId,
        'received_user' => $userId,
        'exclude_user' => $userId
    ]);

    $conversations = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $conversations[] = [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'listing_id' => $row['listing_id'] !== null
                ? (int) $row['listing_id']
                : null,
            'listing' => $row['listing'],
            'last_message' => $row['last_message'] ?? '',
            'last_timestamp' => $row['last_timestamp']
        ];
    }

    respond(200, [
        'success' => true,
        'current_user_id' => $userId,
        'conversations' => $conversations
    ]);

} catch (Throwable $e) {
    error_log('Conversations API error: ' . $e->getMessage());

    respond(500, [
        'success' => false,
        // 'error' => 'Could not load conversations.'
        'error' => $e->getMessage()
    ]);
}