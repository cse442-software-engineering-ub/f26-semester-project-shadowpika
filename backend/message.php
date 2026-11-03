<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../includes/db.php';

function respond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

error_log(
    'mb_strlen available: ' .
    (function_exists('mb_strlen') ? 'yes' : 'no')
);

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

    $stmt = $pdo->prepare(
        'SELECT id, username
         FROM users
         WHERE username = :username OR email = :email
         LIMIT 1'
    );

    $stmt->execute([
        'username' => $identity,
        'email' => $identity
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        respond(401, [
            'success' => false,
            'error' => 'Invalid login.'
        ]);
    }

    $userId = (int) $user['id'];
    $currentUsername = $user['username'];
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // Retrieve messages for one user and one listing.
    if ($method === 'GET') {
        $otherUserId = filter_var(
            $_GET['with'] ?? null,
            FILTER_VALIDATE_INT
        );

        $listingId = filter_var(
            $_GET['listing_id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (
            !$otherUserId || $otherUserId === $userId ||
            !$listingId || $listingId < 1
        ) {
            respond(400, [
                'success' => false,
                'error' => 'A valid user ID and listing ID are required.'
            ]);
        }

        $stmt = $pdo->prepare(
            'SELECT username
            FROM users
            WHERE id = :id
            LIMIT 1'
        );

        $stmt->execute(['id' => $otherUserId]);
        $otherUser = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$otherUser) {
            respond(404, [
                'success' => false,
                'error' => 'User not found.'
            ]);
        }

        $stmt = $pdo->prepare(
            'SELECT
                sender_id,
                receiver_id,
                listing_id,
                message,
                position,
                `timestamp`
             FROM messages
             WHERE listing_id = :listing_id
               AND (
                    (sender_id = :me_sender AND receiver_id = :other_receiver)
                    OR
                    (sender_id = :other_sender AND receiver_id = :me_receiver)
               )
             ORDER BY `timestamp` ASC, position ASC'
        );

        $stmt->execute([
            'listing_id' => $listingId,
            'me_sender' => $userId,
            'other_receiver' => $otherUserId,
            'other_sender' => $otherUserId,
            'me_receiver' => $userId
        ]);

        respond(200, [
            'success' => true,
            'current_user_id' => $userId,
            'other_username' => $otherUser['username'],
            'messages' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    // Send a message.
    if ($method === 'POST') {
        $input = json_decode(
            file_get_contents('php://input'),
            true
        );

        if (!is_array($input)) {
            respond(400, [
                'success' => false,
                'error' => 'Invalid JSON request.'
            ]);
        }

        $receiverId = filter_var(
            $input['receiver_id'] ?? null,
            FILTER_VALIDATE_INT
        );

        $listingId = filter_var(
            $input['listing_id'] ?? null,
            FILTER_VALIDATE_INT
        );

        $message = trim((string) ($input['message'] ?? ''));

        if (!$receiverId || $receiverId === $userId) {
            respond(400, [
                'success' => false,
                'error' => 'A valid recipient is required.'
            ]);
        }

        if (!$listingId || $listingId < 1) {
            respond(400, [
                'success' => false,
                'error' => 'A valid listing ID is required.'
            ]);
        }

        if ($message === '' || mb_strlen($message) > 5000) {
            respond(400, [
                'success' => false,
                'error' => 'Messages must contain 1–5000 characters.'
            ]);
        }

        // Confirm that the recipient exists.
        $stmt = $pdo->prepare(
            'SELECT id FROM users WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $receiverId]);

        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            respond(404, [
                'success' => false,
                'error' => 'Recipient not found.'
            ]);
        }

        // The listing must exist and belong to one of the participants.
        $stmt = $pdo->prepare(
            'SELECT owner_id
             FROM listings
             WHERE listing_id = :listing_id
             LIMIT 1'
        );
        $stmt->execute(['listing_id' => $listingId]);
        $listing = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$listing) {
            respond(404, [
                'success' => false,
                'error' => 'Listing not found.'
            ]);
        }

        $ownerId = (int) $listing['owner_id'];

        if ($ownerId !== $userId && $ownerId !== $receiverId) {
            respond(403, [
                'success' => false,
                'error' => 'This listing is not associated with either participant.'
            ]);
        }

        $pdo->beginTransaction();

        try {
            // Keep position numbering separate for each conversation/listing.
            $stmt = $pdo->prepare(
                'SELECT COALESCE(MAX(position), 0) + 1
                 FROM messages
                 WHERE listing_id = :listing_id
                   AND (
                        (sender_id = :sender1 AND receiver_id = :receiver1)
                        OR
                        (sender_id = :sender2 AND receiver_id = :receiver2)
                   )'
            );

            $stmt->execute([
                'listing_id' => $listingId,
                'sender1' => $userId,
                'receiver1' => $receiverId,
                'sender2' => $receiverId,
                'receiver2' => $userId
            ]);

            $position = (int) $stmt->fetchColumn();

            $stmt = $pdo->prepare(
                'INSERT INTO messages
                    (sender_id, receiver_id, listing_id, message, position, `timestamp`)
                 VALUES
                    (:sender_id, :receiver_id, :listing_id, :message, :position, CURRENT_TIMESTAMP)'
            );

            $stmt->execute([
                'sender_id' => $userId,
                'receiver_id' => $receiverId,
                'listing_id' => $listingId,
                'message' => $message,
                'position' => $position
            ]);

            $stmt = $pdo->prepare(
                'SELECT `timestamp`
                 FROM messages
                 WHERE sender_id = :sender_id
                   AND receiver_id = :receiver_id
                   AND listing_id = :listing_id
                   AND position = :position
                 ORDER BY `timestamp` DESC
                 LIMIT 1'
            );

            $stmt->execute([
                'sender_id' => $userId,
                'receiver_id' => $receiverId,
                'listing_id' => $listingId,
                'position' => $position
            ]);

            $timestamp = $stmt->fetchColumn();

            $pdo->commit();

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        respond(201, [
            'success' => true,
            'message' => [
                'sender_id' => $userId,
                'receiver_id' => $receiverId,
                'listing_id' => $listingId,
                'message' => $message,
                'position' => $position,
                'timestamp' => $timestamp
            ]
        ]);
    }

    header('Allow: GET, POST');
    respond(405, [
        'success' => false,
        'error' => 'Method not allowed.'
    ]);

} catch (Throwable $e) {
    error_log('Messages API error: ' . $e->getMessage());

    respond(500, [
        'success' => false,
        'error' => 'Could not process messages.'
    ]);
}