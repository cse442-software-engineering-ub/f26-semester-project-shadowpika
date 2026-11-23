<?php
declare(strict_types=1);

const KARAVAN_SECURITY_QUESTIONS = [
    'What was the name of your first pet?',
    'In what city were you born?',
    'What was the name of your elementary school?',
];
const KARAVAN_RESET_SECONDS = 600;

function reset_error(int $status, string $error, ?string $code = null): array
{
    $body = ['success' => false, 'error' => $error];
    if ($code !== null) $body['code'] = $code;
    return [$status, $body];
}

function normalized_security_answer($answer): ?string
{
    if (!is_string($answer) || !mb_check_encoding($answer, 'UTF-8')) return null;
    $answer = mb_strtolower(trim($answer), 'UTF-8');
    return $answer !== '' && mb_strlen($answer, 'UTF-8') <= 100 && !str_contains($answer, "\0") ? $answer : null;
}

// Prehash preserves the whole answer even beyond bcrypt's 72-byte input limit.
function security_answer_hash(string $normalized): string
{
    return 'sha256:' . password_hash(hash('sha256', $normalized), PASSWORD_BCRYPT);
}
function security_answer_matches(string $normalized, string $hash): bool
{
    return str_starts_with($hash, 'sha256:')
        ? password_verify(hash('sha256', $normalized), substr($hash, 7))
        : password_verify($normalized, $hash); // Existing teammate-created answer hashes.
}

function reset_restart(array &$state): array
{
    $state = [];
    return reset_error(410, 'Your reset session has expired. Start again.', 'restart_required');
}

function begin_password_reset(PDO $pdo, array &$state, array $input, ?int $now = null): array
{
    $state = []; // Failed lookups must also revoke an older verified grant.
    $email = $input['email'] ?? null;
    if (!is_string($email) || strlen(trim($email)) > 50 || !filter_var(trim($email), FILTER_VALIDATE_EMAIL)) {
        return reset_error(400, 'Please enter a valid email address.');
    }
    $email = trim($email);
    $stmt = $pdo->prepare('SELECT id, security_q1_index, security_a1_hash FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)');
    $stmt->execute([$email, $email]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($users) === 0) return reset_error(422, 'No account was found for this email.');
    if (count($users) !== 1) return reset_error(409, 'This email matches more than one account. Password reset is unavailable.');
    $user = $users[0];
    $qid = $user['security_q1_index'];
    if ($qid === null || !isset(KARAVAN_SECURITY_QUESTIONS[(int) $qid]) || empty($user['security_a1_hash'])) {
        return reset_error(422, 'This account has no security answer and cannot reset its password.');
    }
    $state = ['user_id' => (int) $user['id'], 'expires_at' => ($now ?? time()) + KARAVAN_RESET_SECONDS, 'attempts' => 0, 'verified' => false];
    return [200, ['success' => true, 'question_id' => (int) $qid, 'question' => KARAVAN_SECURITY_QUESTIONS[(int) $qid]]];
}

function verify_reset_answer(PDO $pdo, array &$state, array $input, ?int $now = null): array
{
    if (empty($state['user_id']) || ($state['expires_at'] ?? 0) <= ($now ?? time())) return reset_restart($state);
    // Any new verification attempt revokes previously granted authority first.
    $state['verified'] = false;
    unset($state['password_hash']);
    $answer = normalized_security_answer($input['answer'] ?? null);
    if ($answer === null) return reset_error(400, 'Please enter a security answer of 1 to 100 characters.');
    $stmt = $pdo->prepare('SELECT security_a1_hash, password_hash FROM users WHERE id = ?');
    $stmt->execute([$state['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user || empty($user['security_a1_hash'])) return reset_restart($state);
    if (!security_answer_matches($answer, $user['security_a1_hash'])) {
        $state['attempts']++;
        if ($state['attempts'] >= 5) return reset_restart($state);
        return reset_error(403, 'Incorrect security answer.');
    }
    $state['verified'] = true;
    $state['password_hash'] = $user['password_hash'];
    return [200, ['success' => true]];
}

function finish_password_reset(PDO $pdo, array &$state, array $input, ?int $now = null): array
{
    if (empty($state['verified']) || empty($state['user_id']) || ($state['expires_at'] ?? 0) <= ($now ?? time())) return reset_restart($state);
    $password = $input['password'] ?? null;
    if (!is_string($password) || trim($password) === '' || strlen(trim($password)) > 50 || str_contains($password, "\0")) {
        return reset_error(400, 'Password must contain 1 to 50 bytes.');
    }
    $hash = password_hash(trim($password), PASSWORD_BCRYPT);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?');
        $stmt->execute([$hash, $state['user_id'], $state['password_hash']]);
        if ($stmt->rowCount() !== 1) { $pdo->rollBack(); return reset_restart($state); }
        $pdo->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$state['user_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    $state = [];
    return [200, ['success' => true, 'message' => 'Your password has been reset. Please log in.']];
}

/** Dispatch only JSON POST requests. Production time is always the server clock. */
function password_reset_endpoint(string $action): void
{
    require_once __DIR__ . '/http.php';
    require_once __DIR__ . '/db.php';
    require_once __DIR__ . '/auth.php';
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST'); karavan_send_json(405, ['success' => false, 'error' => 'Method not allowed.']);
    }
    karavan_start_session();
    $_SESSION['password_reset'] ??= [];
    if ($action === 'begin') $_SESSION['password_reset'] = [];
    $input = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($input) || array_is_list($input)) karavan_send_json(400, ['success' => false, 'error' => 'The request body must contain a JSON object.']);
    // These endpoints accept no external user identity or authority token.
    $allowed = ['begin' => ['email'], 'verify' => ['answer'], 'finish' => ['password']][$action];
    if (array_diff(array_keys($input), $allowed)) karavan_send_json(400, ['success' => false, 'error' => 'Unexpected request fields.']);
    try {
        $pdo = karavan_pdo();
        $handler = ['begin' => 'begin_password_reset', 'verify' => 'verify_reset_answer', 'finish' => 'finish_password_reset'][$action];
        [$status, $body] = $handler($pdo, $_SESSION['password_reset'], $input);
        if ($action === 'verify' && $status === 200) session_regenerate_id(true);
        if ($action === 'finish' && $status === 200) {
            $_SESSION = []; session_regenerate_id(true);
            karavan_set_auth_cookie('', time() - 3600);
            karavan_set_remember_cookie('', time() - 3600);
        }
    } catch (Throwable $e) {
        $status = 500; $body = ['success' => false, 'error' => 'Password reset is temporarily unavailable. Please try again.'];
    }
    karavan_send_json($status, $body);
}
