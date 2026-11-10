<?php
// Buyer-seller messaging (cards #12, #13). A conversation is the two users plus the listing
// they are talking about, and the listing's owner must be one of the two.
require_once __DIR__ . '/communities.php';
require_once __DIR__ . '/meeting_requests.php';

const KARAVAN_MESSAGE_MAX_LENGTH = 5000;
const KARAVAN_MESSAGE_LENGTH_ERROR = 'Messages must contain 1–5000 characters.';

function karavan_message_error(int $status, string $error): array
{
    return [$status, ['success' => false, 'error' => $error]];
}

function karavan_message_id($value): ?int
{
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    return $id === false ? null : $id;
}

/** Conversation between the logged-in user and another user about one listing, in sent order. */
function karavan_conversation_messages(PDO $pdo, int $userId, int $otherId, int $listingId): array
{
    $stmt = $pdo->prepare(
        'SELECT sender_id, receiver_id, message, position, `timestamp`
           FROM messages
          WHERE listing_id = ?
            AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
          ORDER BY position ASC, `timestamp` ASC'
    );
    $stmt->execute([$listingId, $userId, $otherId, $otherId, $userId]);
    return array_map('karavan_format_message', $stmt->fetchAll());
}

function karavan_format_message(array $row): array
{
    return [
        'sender_id'   => (int) $row['sender_id'],
        'receiver_id' => (int) $row['receiver_id'],
        'message'     => $row['message'],
        'position'    => (int) $row['position'],
        'timestamp'   => karavan_message_time($row['timestamp']),
    ];
}

/** Stored as UTC; sent as ISO 8601 so the browser shows the reader's local time. */
function karavan_message_time(?string $value): ?string
{
    if ($value === null || $value === '') return null;
    return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z');
}

/**
 * Checks everything a read or a send shares: both ids, the other user, the listing, and that the
 * logged-in user may see the listing. Returns [error response, null] or [null, context].
 */
function karavan_message_context(PDO $pdo, int $userId, $otherInput, $listingInput): array
{
    $otherId = karavan_message_id($otherInput);
    if ($otherId === null || $otherId === $userId) {
        return [karavan_message_error(400, 'A valid recipient is required.'), null];
    }
    $listingId = karavan_message_id($listingInput);
    if ($listingId === null) {
        return [karavan_message_error(400, 'A valid listing ID is required.'), null];
    }

    $stmt = $pdo->prepare('SELECT id, username FROM users WHERE id = ?');
    $stmt->execute([$otherId]);
    $other = $stmt->fetch();
    if (!$other) {
        return [karavan_message_error(404, 'Recipient not found.'), null];
    }

    $stmt = $pdo->prepare('SELECT listing_id, owner_id, name, community FROM listings WHERE listing_id = ?');
    $stmt->execute([$listingId]);
    $listing = $stmt->fetch();
    if (!$listing) {
        return [karavan_message_error(404, 'Listing not found.'), null];
    }

    $ownerId = $listing['owner_id'] === null ? null : (int) $listing['owner_id'];
    if ($ownerId !== $userId && $ownerId !== $otherId) {
        return [karavan_message_error(403, 'This listing is not associated with either participant.'), null];
    }
    if (!karavan_can_shop_listing($pdo, $userId, $listing)) {
        return [karavan_message_error(403, KARAVAN_NOT_A_MEMBER_ERROR), null];
    }

    return [null, [
        'other'   => ['id' => (int) $other['id'], 'username' => $other['username']],
        'listing' => ['listing_id' => (int) $listing['listing_id'], 'name' => $listing['name']],
        'is_seller' => $ownerId === $userId,
    ]];
}

/** GET api/message.php?with=<user id>&listing_id=<id> */
function karavan_get_conversation(PDO $pdo, ?int $userId, $otherInput, $listingInput): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }
    [$error, $context] = karavan_message_context($pdo, $userId, $otherInput, $listingInput);
    if ($error !== null) {
        return $error;
    }
    $otherId = $context['other']['id'];
    $listingId = $context['listing']['listing_id'];

    return [200, [
        'success'         => true,
        'current_user_id' => $userId,
        'other_user_id'   => $otherId,
        'other_username'  => $context['other']['username'],
        'listing_id'      => $listingId,
        'listing_name'    => $context['listing']['name'],
        'messages'        => karavan_conversation_messages($pdo, $userId, $otherId, $listingId),
    ]];
}

/** POST api/message.php  Body: {"receiver_id": 217, "listing_id": 95023, "message": "Is this available?"} */
function karavan_send_message(PDO $pdo, ?int $userId, $input, ?DateTimeImmutable $now = null): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }
    if (!is_array($input)) {
        return karavan_message_error(400, 'Invalid JSON request.');
    }
    [$error, $context] = karavan_message_context($pdo, $userId, $input['receiver_id'] ?? null, $input['listing_id'] ?? null);
    if ($error !== null) {
        return $error;
    }

    $raw = $input['message'] ?? null;
    $message = is_string($raw) ? trim($raw) : '';
    if ($message === '' || mb_strlen($message) > KARAVAN_MESSAGE_MAX_LENGTH) {
        return karavan_message_error(400, KARAVAN_MESSAGE_LENGTH_ERROR);
    }

    $otherId = $context['other']['id'];
    $listingId = $context['listing']['listing_id'];
    // A seller can answer buyers, but cannot start conversations with random users about their listing.
    if ($context['is_seller'] && karavan_conversation_messages($pdo, $userId, $otherId, $listingId) === []) {
        return karavan_message_error(403, 'You can only reply to buyers who messaged you about this listing.');
    }

    $timestamp = ($now ?? new DateTimeImmutable('now'))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'SELECT COALESCE(MAX(position), 0) + 1 FROM messages
              WHERE listing_id = ?
                AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))'
        );
        $stmt->execute([$listingId, $userId, $otherId, $otherId, $userId]);
        $position = (int) $stmt->fetchColumn();

        $pdo->prepare(
            'INSERT INTO messages (sender_id, receiver_id, listing_id, message, position, `timestamp`)
             VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([$userId, $otherId, $listingId, $message, $position, $timestamp]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    return [201, [
        'success' => true,
        'message' => karavan_format_message([
            'sender_id' => $userId, 'receiver_id' => $otherId, 'message' => $message,
            'position' => $position, 'timestamp' => $timestamp,
        ]),
    ]];
}

/** GET api/conversations.php: one entry per (other user, listing), newest first. */
function karavan_list_conversations(PDO $pdo, ?int $userId): array
{
    if ($userId === null) {
        return karavan_not_logged_in();
    }
    $stmt = $pdo->prepare(
        'SELECT m.sender_id, m.receiver_id, m.listing_id, m.message, m.position, m.`timestamp`,
                u.username AS other_username, l.name AS listing_name
           FROM messages m
           JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
           LEFT JOIN listings l ON l.listing_id = m.listing_id
          WHERE (m.sender_id = ? OR m.receiver_id = ?) AND m.listing_id IS NOT NULL
          ORDER BY m.`timestamp` DESC, m.position DESC'
    );
    $stmt->execute([$userId, $userId, $userId]);

    $conversations = [];
    foreach ($stmt->fetchAll() as $row) {
        $otherId = (int) $row['sender_id'] === $userId ? (int) $row['receiver_id'] : (int) $row['sender_id'];
        $key = $otherId . ':' . $row['listing_id'];
        if (isset($conversations[$key])) {
            continue;
        }
        $conversations[$key] = [
            'other_user_id'  => $otherId,
            'other_username' => $row['other_username'],
            'listing_id'     => (int) $row['listing_id'],
            'listing_name'   => $row['listing_name'] ?? 'Removed listing',
            'last_message'   => $row['message'],
            'last_sender_id' => (int) $row['sender_id'],
            'last_timestamp' => karavan_message_time($row['timestamp']),
        ];
    }

    return [200, ['success' => true, 'current_user_id' => $userId, 'conversations' => array_values($conversations)]];
}
