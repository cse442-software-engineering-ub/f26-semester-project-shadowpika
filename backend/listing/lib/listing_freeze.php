<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/meeting_state.php';

/** Completed sales take precedence over a still-open approved meeting. */
function listing_freeze_block_reason(array $meetings, DateTimeImmutable $now): ?string
{
    $reason = null;
    foreach ($meetings as $meeting) {
        if ($meeting['status'] !== 'approved') continue;
        if ($meeting['checked_in_at'] !== null && $meeting['seller_checked_in_at'] !== null) {
            return 'completed_meeting';
        }
        if ($now <= karavan_meeting_window($meeting)['closes']) $reason = 'approved_meeting';
    }
    return $reason;
}

function listing_freeze_reasons(PDO $pdo, int $ownerId, DateTimeImmutable $now): array
{
    $stmt = $pdo->prepare("SELECT r.* FROM meeting_requests r JOIN listings l ON l.listing_id = r.listing_id
        WHERE l.owner_id = ? AND l.status = 'active' AND r.status = 'approved' ORDER BY r.request_id");
    $stmt->execute([$ownerId]);
    $groups = [];
    foreach ($stmt->fetchAll() as $row) $groups[(int) $row['listing_id']][] = $row;
    $reasons = [];
    foreach ($groups as $id => $meetings) $reasons[$id] = listing_freeze_block_reason($meetings, $now);
    return $reasons;
}

function freeze_my_listings(PDO $pdo, int $ownerId, ?DateTimeImmutable $now = null): array
{
    $lock = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
    $pdo->beginTransaction();
    try {
        $listings = $pdo->prepare("SELECT listing_id FROM listings WHERE owner_id = ? AND status = 'active'
            ORDER BY listing_id" . $lock);
        $listings->execute([$ownerId]);
        $ids = $listings->fetchAll(PDO::FETCH_COLUMN);
        $now ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $meetings = $pdo->prepare('SELECT * FROM meeting_requests WHERE listing_id = ? ORDER BY request_id' . $lock);
        $cancel = $pdo->prepare("DELETE FROM meeting_requests WHERE listing_id = ?
            AND status IN ('pending', 'location_change_requested')");
        $freeze = $pdo->prepare("UPDATE listings SET status = 'inactive' WHERE listing_id = ? AND owner_id = ? AND status = 'active'");
        $frozen = $skipped = $cancelled = 0;
        foreach ($ids as $id) {
            $meetings->execute([$id]);
            if (listing_freeze_block_reason($meetings->fetchAll(), $now) !== null) {
                ++$skipped;
                continue;
            }
            $cancel->execute([$id]);
            $cancelled += $cancel->rowCount();
            $freeze->execute([$id, $ownerId]);
            if ($freeze->rowCount() !== 1) throw new RuntimeException('Listing changed while freezing.');
            ++$frozen;
        }
        $pdo->commit();
        return [200, ['success' => true, 'frozen_count' => $frozen,
            'skipped_count' => $skipped, 'cancelled_request_count' => $cancelled]];
    } finally {
        if ($pdo->inTransaction()) $pdo->rollBack();
    }
}

function resume_my_listing(PDO $pdo, int $ownerId, int $listingId): array
{
    return karavan_with_listing_transaction($pdo, $listingId, static function () use ($pdo, $ownerId, $listingId) {
        $stmt = $pdo->prepare('SELECT status FROM listings WHERE listing_id = ? AND owner_id = ?');
        $stmt->execute([$listingId, $ownerId]);
        $status = $stmt->fetchColumn();
        if ($status === false) return [404, ['success' => false, 'error' => 'Listing not found.']];
        if (!in_array($status, ['inactive', 'active'], true)) {
            return [409, ['success' => false, 'error' => 'Only paused listings can be restored.']];
        }
        if ($status === 'inactive') {
            $pdo->prepare("UPDATE listings SET status = 'active' WHERE listing_id = ? AND owner_id = ?")
                ->execute([$listingId, $ownerId]);
        }
        return [200, ['success' => true, 'listing_id' => $listingId, 'status' => 'active']];
    });
}
