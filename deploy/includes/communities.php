<?php
// Business logic for joinable communities. Every function returns
// [httpStatus, responseBody] so the endpoints stay thin and PHPUnit can call these directly.
//
// Each approved community partner's business is one community; community_id is that
// partner's admin_requests.id, and users.community_id records the one a user has joined.
require_once __DIR__ . '/admin_requests.php';

function karavan_list_communities(PDO $pdo, ?int $userId): array
{
    if (karavan_find_user($pdo, $userId) === null) {
        return karavan_forbidden();
    }

    // Partners who registered the same business name share one community.
    $stmt = $pdo->query(
        "SELECT MIN(id) AS id, MIN(business_name) AS name
         FROM admin_requests
         WHERE status = 'approved'
         GROUP BY LOWER(TRIM(business_name))
         ORDER BY MIN(business_name) ASC"
    );

    $communities = [];
    foreach ($stmt->fetchAll() as $row) {
        $communities[] = ['community_id' => (int) $row['id'], 'name' => $row['name']];
    }

    return [200, ['success' => true, 'communities' => $communities]];
}

/** @return array{community_id: int, community_name: string}|null */
function karavan_find_community(PDO $pdo, $communityId): ?array
{
    if ($communityId === null) {
        return null;
    }
    $stmt = $pdo->prepare("SELECT id, business_name FROM admin_requests WHERE id = ? AND status = 'approved'");
    $stmt->execute([(int) $communityId]);
    $row = $stmt->fetch();
    return $row ? ['community_id' => (int) $row['id'], 'community_name' => $row['business_name']] : null;
}

// A user belongs to at most one community, so joining replaces any earlier choice.
function karavan_join_community(PDO $pdo, ?int $userId, $input): array
{
    $user = karavan_find_user($pdo, $userId);
    if ($user === null) {
        return karavan_forbidden();
    }

    $communityId = is_array($input) ? filter_var($input['community_id'] ?? null, FILTER_VALIDATE_INT) : false;
    $community = $communityId === false || $communityId <= 0 ? null : karavan_find_community($pdo, $communityId);
    if ($community === null) {
        return [404, ['success' => false, 'error' => 'Community not found.']];
    }

    try {
        $update = $pdo->prepare('UPDATE users SET community_id = ? WHERE id = ?');
        $update->execute([$community['community_id'], (int) $user['id']]);
    } catch (PDOException $e) {
        return [500, ['success' => false, 'error' => 'Could not join the community.']];
    }

    return [200, ['success' => true] + $community];
}
