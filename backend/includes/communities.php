<?php
// Business logic for communities. Every function returns
// [httpStatus, responseBody] so the endpoints stay thin and PHPUnit can call these directly.
//
// Each approved community partner's business is one community; community_id is that
// partner's admin_requests.id. Partners who registered the same business name (ignoring case
// and surrounding spaces) share one community, listed under the lowest id.
// community_members records the communities a user joined and which of them they shop from.
// A listing stores its community's exact business name in listings.community (006).
require_once __DIR__ . '/admin_requests.php';

// Everyone is automatically a member of the campus-wide community and can't leave it.
// Listings without a community were moved into it by 006.
const KARAVAN_CAMPUS_COMMUNITY = 'All of UB';

const KARAVAN_NOT_A_MEMBER_ERROR = 'This item is only available to members of its community.';
const KARAVAN_SHOPPING_IDS_ERROR = 'community_ids must be a list of community ids.';

function karavan_community_key(string $name): string
{
    return strtolower(trim($name));
}

/**
 * Approved communities sorted by name, keyed by their listed community_id.
 * `names` holds every exact business name in the community, `ids` every partner id.
 *
 * @return array<int, array{community_id: int, name: string, names: string[], ids: int[], automatic: bool}>
 */
function karavan_approved_communities(PDO $pdo): array
{
    $groups = [];
    $rows = $pdo->query("SELECT id, business_name FROM admin_requests WHERE status = 'approved' ORDER BY id ASC");
    foreach ($rows->fetchAll() as $row) {
        $key = karavan_community_key($row['business_name']);
        $groups[$key] ??= [
            'community_id' => (int) $row['id'],
            'name'         => $row['business_name'],
            'names'        => [],
            'ids'          => [],
            'automatic'    => $key === karavan_community_key(KARAVAN_CAMPUS_COMMUNITY),
        ];
        $groups[$key]['names'][] = $row['business_name'];
        $groups[$key]['ids'][] = (int) $row['id'];
    }

    usort($groups, fn ($a, $b) => strcasecmp($a['name'], $b['name']) ?: $a['community_id'] <=> $b['community_id']);
    return array_column($groups, null, 'community_id');
}

/** Returns the listed community_id that a partner id belongs to, or null if it isn't an approved community. */
function karavan_listed_community_id(array $communities, int $partnerId): ?int
{
    foreach ($communities as $listedId => $community) {
        if (in_array($partnerId, $community['ids'], true)) {
            return $listedId;
        }
    }
    return null;
}

function karavan_parse_community_id($value): ?int
{
    if (!is_int($value) && !is_string($value)) {
        return null;
    }
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    return $id === false ? null : $id;
}

/**
 * The communities the user is in, as community_id => whether they shop from it.
 * Always includes the campus community when it is an approved community.
 *
 * @return array<int, bool>
 */
function karavan_user_memberships(PDO $pdo, int $userId, array $communities): array
{
    $stmt = $pdo->prepare('SELECT community_id, shopping FROM community_members WHERE user_id = ?');
    $stmt->execute([$userId]);
    $stored = [];
    foreach ($stmt->fetchAll() as $row) {
        $listedId = karavan_listed_community_id($communities, (int) $row['community_id']);
        if ($listedId !== null) {
            $stored[$listedId] = ($stored[$listedId] ?? false) || (int) $row['shopping'] === 1;
        }
    }

    $memberships = [];
    foreach ($communities as $listedId => $community) {
        if ($community['automatic'] || array_key_exists($listedId, $stored)) {
            // A campus row only exists to record that the user stopped shopping from it.
            $memberships[$listedId] = $stored[$listedId] ?? true;
        }
    }
    return $memberships;
}

/**
 * Exact listings.community values the user may see. With $shoppingOnly, only the communities
 * they chose to shop from.
 *
 * @return string[]
 */
function karavan_member_listing_communities(PDO $pdo, int $userId, bool $shoppingOnly = false): array
{
    $communities = karavan_approved_communities($pdo);
    $names = [];
    $campusListed = false;
    foreach (karavan_user_memberships($pdo, $userId, $communities) as $listedId => $shopping) {
        $campusListed = $campusListed || $communities[$listedId]['automatic'];
        if (!$shoppingOnly || $shopping) {
            array_push($names, ...$communities[$listedId]['names']);
        }
    }
    // Campus listings stay visible on a database where no "All of UB" partner was approved.
    if (!$campusListed) {
        $names[] = KARAVAN_CAMPUS_COMMUNITY;
    }
    return array_values(array_unique($names));
}

/** True when the user owns the listing or is a member of its community. $listing needs owner_id and community. */
function karavan_can_shop_listing(PDO $pdo, int $userId, array $listing): bool
{
    if (isset($listing['owner_id']) && (int) $listing['owner_id'] === $userId) {
        return true;
    }
    $community = $listing['community'] ?? null;
    return $community !== null
        && in_array((string) $community, karavan_member_listing_communities($pdo, $userId), true);
}

/**
 * Communities the user chose to join (the automatic campus community is not included).
 *
 * @return array<int, array{community_id: int, name: string}>
 */
function karavan_joined_communities(PDO $pdo, int $userId): array
{
    $communities = karavan_approved_communities($pdo);
    $joined = [];
    foreach (array_keys(karavan_user_memberships($pdo, $userId, $communities)) as $listedId) {
        if (!$communities[$listedId]['automatic']) {
            $joined[] = ['community_id' => $listedId, 'name' => $communities[$listedId]['name']];
        }
    }
    return $joined;
}

function karavan_list_communities(PDO $pdo, ?int $userId): array
{
    $user = karavan_find_user($pdo, $userId);
    if ($user === null) {
        return karavan_forbidden();
    }

    $communities = karavan_approved_communities($pdo);
    $memberships = karavan_user_memberships($pdo, (int) $user['id'], $communities);

    $list = [];
    foreach ($communities as $listedId => $community) {
        $list[] = [
            'community_id' => $listedId,
            'name'         => $community['name'],
            'joined'       => array_key_exists($listedId, $memberships),
            'shopping'     => $memberships[$listedId] ?? false,
            'automatic'    => $community['automatic'],
        ];
    }

    return [200, ['success' => true, 'communities' => $list]];
}

// A user can be in any number of communities. Joining one they're already in changes nothing.
function karavan_join_community(PDO $pdo, ?int $userId, $input): array
{
    $user = karavan_find_user($pdo, $userId);
    if ($user === null) {
        return karavan_forbidden();
    }

    $communities = karavan_approved_communities($pdo);
    $partnerId = karavan_parse_community_id(is_array($input) ? ($input['community_id'] ?? null) : null);
    $listedId = $partnerId === null ? null : karavan_listed_community_id($communities, $partnerId);
    if ($listedId === null) {
        return [404, ['success' => false, 'error' => 'Community not found.']];
    }
    $community = $communities[$listedId];

    if (!$community['automatic']
        && !array_key_exists($listedId, karavan_user_memberships($pdo, (int) $user['id'], $communities))) {
        try {
            // New communities are shopped from straight away.
            $insert = $pdo->prepare('INSERT INTO community_members (user_id, community_id, shopping) VALUES (?, ?, 1)');
            $insert->execute([(int) $user['id'], $listedId]);
        } catch (PDOException $e) {
            // 23000: a double click already added the same membership.
            if ($e->getCode() != 23000) {
                return [500, ['success' => false, 'error' => 'Could not join the community.']];
            }
        }
    }

    return [200, ['success' => true, 'community_id' => $listedId, 'community_name' => $community['name']]];
}

// With a community_id, leaves that community. Without one (the original one-community client),
// leaves every community the user joined. Leaving one they're not in is still a success, so a
// double click or a stale page is harmless.
function karavan_leave_community(PDO $pdo, ?int $userId, $input = null): array
{
    $user = karavan_find_user($pdo, $userId);
    if ($user === null) {
        return karavan_forbidden();
    }

    $communities = karavan_approved_communities($pdo);
    $leaveOne = is_array($input) && array_key_exists('community_id', $input);
    $community = null;
    if ($leaveOne) {
        $partnerId = karavan_parse_community_id($input['community_id']);
        $listedId = $partnerId === null ? null : karavan_listed_community_id($communities, $partnerId);
        if ($listedId === null) {
            return [404, ['success' => false, 'error' => 'Community not found.']];
        }
        $community = $communities[$listedId];
        if ($community['automatic']) {
            return [400, ['success' => false, 'error' => "Everyone is a member of {$community['name']}, so it can't be left."]];
        }
    }

    $leaving = [];
    foreach ($leaveOne ? [$community] : $communities as $candidate) {
        if (!$candidate['automatic']) {
            array_push($leaving, ...$candidate['ids']);
        }
    }

    try {
        $pdo->beginTransaction();
        if ($leaving) {
            $placeholders = implode(', ', array_fill(0, count($leaving), '?'));
            $delete = $pdo->prepare("DELETE FROM community_members WHERE user_id = ? AND community_id IN ($placeholders)");
            $delete->execute([(int) $user['id'], ...$leaving]);
        }
        karavan_keep_shopping_somewhere($pdo, (int) $user['id'], $communities);
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        return [500, ['success' => false, 'error' => 'Could not leave the community.']];
    }

    return [200, [
        'success'        => true,
        'community_id'   => $community['community_id'] ?? null,
        'community_name' => $community['name'] ?? null,
    ]];
}

// Leaving the last community a user shopped from would leave them with an empty marketplace,
// so they go back to shopping from the campus community.
function karavan_keep_shopping_somewhere(PDO $pdo, int $userId, array $communities): void
{
    if (in_array(true, karavan_user_memberships($pdo, $userId, $communities), true)) {
        return;
    }
    foreach ($communities as $community) {
        if ($community['automatic']) {
            karavan_store_campus_shopping($pdo, $userId, $community, true);
        }
    }
}

function karavan_store_campus_shopping(PDO $pdo, int $userId, array $campus, bool $shopping): void
{
    $placeholders = implode(', ', array_fill(0, count($campus['ids']), '?'));
    $delete = $pdo->prepare("DELETE FROM community_members WHERE user_id = ? AND community_id IN ($placeholders)");
    $delete->execute([$userId, ...$campus['ids']]);
    if (!$shopping) {
        $insert = $pdo->prepare('INSERT INTO community_members (user_id, community_id, shopping) VALUES (?, ?, 0)');
        $insert->execute([$userId, $campus['community_id']]);
    }
}

// Replaces which of the user's communities they shop from. Every id must be a community the
// user is in, and at least one is required; otherwise nothing changes.
function karavan_set_shopping_communities(PDO $pdo, ?int $userId, $input): array
{
    $user = karavan_find_user($pdo, $userId);
    if ($user === null) {
        return karavan_forbidden();
    }

    $ids = is_array($input) ? ($input['community_ids'] ?? null) : null;
    if (!is_array($ids) || !array_is_list($ids)) {
        return [400, ['success' => false, 'error' => KARAVAN_SHOPPING_IDS_ERROR]];
    }

    $communities = karavan_approved_communities($pdo);
    $memberships = karavan_user_memberships($pdo, (int) $user['id'], $communities);
    $selected = [];
    foreach ($ids as $value) {
        $partnerId = karavan_parse_community_id($value);
        if ($partnerId === null) {
            return [400, ['success' => false, 'error' => KARAVAN_SHOPPING_IDS_ERROR]];
        }
        $listedId = karavan_listed_community_id($communities, $partnerId);
        if ($listedId === null || !array_key_exists($listedId, $memberships)) {
            return [403, ['success' => false, 'error' => 'You can only shop from communities you have joined.']];
        }
        $selected[$listedId] = true;
    }
    if (!$selected) {
        return [400, ['success' => false, 'error' => 'Select at least one community to shop from.']];
    }

    try {
        $pdo->beginTransaction();
        foreach (array_keys($memberships) as $listedId) {
            $community = $communities[$listedId];
            $shopping = isset($selected[$listedId]);
            if ($community['automatic']) {
                karavan_store_campus_shopping($pdo, (int) $user['id'], $community, $shopping);
                continue;
            }
            $placeholders = implode(', ', array_fill(0, count($community['ids']), '?'));
            $update = $pdo->prepare("UPDATE community_members SET shopping = ? WHERE user_id = ? AND community_id IN ($placeholders)");
            $update->execute([$shopping ? 1 : 0, (int) $user['id'], ...$community['ids']]);
        }
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        return [500, ['success' => false, 'error' => 'Could not save your shopping communities.']];
    }

    return [200, [
        'success'                => true,
        'shopping_community_ids' => array_values(array_filter(array_keys($memberships), fn ($id) => isset($selected[$id]))),
    ]];
}
