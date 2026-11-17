<?php
declare(strict_types=1);

// "Today" for the future-date check is the campus date, not the server's default timezone.
const KARAVAN_MEETING_TIMEZONE = 'America/New_York';

/** Shared with check-in and listing freezing; preserve the existing campus-time window. */
function karavan_meeting_window(array $row): array
{
    $value = $row['meeting_date'] . ' ' . $row['meeting_time'];
    $meeting = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new DateTimeZone(KARAVAN_MEETING_TIMEZONE));
    if (!$meeting || $meeting->format('Y-m-d H:i:s') !== $value) {
        throw new RuntimeException('Invalid stored meeting time.');
    }
    return ['opens' => $meeting->modify('-15 minutes'), 'closes' => $meeting->modify('+2 hours')];
}

/** Serialize mutations with Sold/check-in: listing first, then its meeting rows. */
function karavan_with_listing_transaction(PDO $pdo, int $listingId, callable $operation): array
{
    $pdo->beginTransaction();
    try {
        $lock = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
        $stmt = $pdo->prepare('SELECT listing_id FROM listings WHERE listing_id = ?' . $lock);
        $stmt->execute([$listingId]);
        $stmt->fetchColumn();
        $result = $operation();
        if ($result[0] < 400) $pdo->commit();
        return $result;
    } finally {
        if ($pdo->inTransaction()) $pdo->rollBack();
    }
}

/** The initial lookup is only a lock locator; the operation rereads authority/state under lock. */
function karavan_with_request_listing_transaction(PDO $pdo, ?int $userId, $input, callable $operation): array
{
    if ($userId === null || !is_array($input)) return $operation();
    $requestId = karavan_parse_positive_id($input['request_id'] ?? null);
    if ($requestId === null) return $operation();
    $stmt = $pdo->prepare('SELECT listing_id FROM meeting_requests WHERE request_id = ?');
    $stmt->execute([$requestId]);
    $listingId = $stmt->fetchColumn();
    return $listingId === false ? $operation()
        : karavan_with_listing_transaction($pdo, (int) $listingId, $operation);
}
