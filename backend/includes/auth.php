<?php
// Who is logged in. The PHP session ends when the browser closes (and Aptitude clears idle
// sessions), so a 30-day "remember me" token in auth_tokens brings the login back after that.
// The cookie is "selector:validator" and only a SHA-256 hash of the validator is stored.
// A token is not replaced when used: a browser restoring several tabs sends the same cookie
// from all of them at once. Logging out deletes it.
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/admin_requests.php';

const KARAVAN_REMEMBER_COOKIE = 'karavan_remember';
const KARAVAN_REMEMBER_SECONDS = 30 * 86400;
const KARAVAN_NOT_LOGGED_IN_ERROR = 'You are not logged in.';
// The settings/*.php account endpoints identify the user by this cookie instead of the session.
const KARAVAN_AUTH_COOKIE = 'karavan_auth_cookie';

function karavan_set_auth_cookie(string $value, int $expires): void
{
    if (headers_sent()) {
        return;
    }
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    setcookie(KARAVAN_AUTH_COOKIE, $value, [
        'expires'  => $expires,
        'path'     => '/',
        // No domain option: keep the cookie on whichever host is serving the app
        // (Aptitude, Cattle, or localhost) instead of tying it to one server.
        'secure'   => $secure,
        // The settings pages read it from JavaScript, and it must also be sent inside the Figma iframe.
        'httponly' => false,
        'samesite' => $secure ? 'None' : 'Lax',
    ]);

}

// Every Aptitude team shares this host, so the cookie is scoped to this deployment's folder.
function karavan_app_cookie_path(): string
{
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return $dir . '/';
}

function karavan_set_remember_cookie(string $value, int $expires): void
{
    if (headers_sent()) {
        return;
    }
    setcookie(KARAVAN_REMEMBER_COOKIE, $value, [
        'expires'  => $expires,
        'path'     => karavan_app_cookie_path(),
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** @return array{0: string, 1: string}|null [selector, validator] */
function karavan_parse_remember_cookie(?string $cookie): ?array
{
    if ($cookie === null || !preg_match('/^([a-f0-9]{24}):([a-f0-9]{64})$/', $cookie, $m)) {
        return null;
    }
    return [$m[1], $m[2]];
}

/** Stores a new token for the user, sets the cookie, and returns the cookie value. */
function karavan_issue_remember_token(PDO $pdo, int $userId, ?int $now = null): string
{
    $now ??= time();
    $selector = bin2hex(random_bytes(12));
    $validator = bin2hex(random_bytes(32));
    $expires = $now + KARAVAN_REMEMBER_SECONDS;

    $stmt = $pdo->prepare('INSERT INTO auth_tokens (user_id, selector, token_hash, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, $selector, hash('sha256', $validator), date('Y-m-d H:i:s', $expires)]);

    $value = "$selector:$validator";
    karavan_set_remember_cookie($value, $expires);
    return $value;
}

/** Returns the user id a valid, unexpired token belongs to; null for anything else. */
function karavan_check_remember_token(PDO $pdo, ?string $cookie, ?int $now = null): ?int
{
    $parts = karavan_parse_remember_cookie($cookie);
    if ($parts === null) {
        return null;
    }
    [$selector, $validator] = $parts;

    $stmt = $pdo->prepare('SELECT id, user_id, token_hash, expires_at FROM auth_tokens WHERE selector = ?');
    $stmt->execute([$selector]);
    $row = $stmt->fetch();
    if (!$row || !hash_equals($row['token_hash'], hash('sha256', $validator))) {
        return null;
    }
    if (strtotime($row['expires_at']) <= ($now ?? time())) {
        $pdo->prepare('DELETE FROM auth_tokens WHERE id = ?')->execute([$row['id']]);
        return null;
    }
    return (int) $row['user_id'];
}

function karavan_forget_remember_token(PDO $pdo, ?string $cookie): void
{
    $parts = karavan_parse_remember_cookie($cookie);
    if ($parts !== null) {
        $pdo->prepare('DELETE FROM auth_tokens WHERE selector = ?')->execute([$parts[0]]);
    }
    karavan_set_remember_cookie('', time() - 3600);
}

/** The logged-in user from the session, falling back to the remember-me cookie. */
function karavan_current_user(PDO $pdo): ?array
{
    $user = karavan_find_user($pdo, karavan_session_user_id());
    if ($user !== null) {
        return $user;
    }

    $cookie = $_COOKIE[KARAVAN_REMEMBER_COOKIE] ?? null;
    $user = karavan_find_user($pdo, karavan_check_remember_token($pdo, $cookie));
    if ($user === null) {
        unset($_SESSION['user_id']);
        if ($cookie !== null) {
            karavan_set_remember_cookie('', time() - 3600);
        }
        return null;
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    return $user;
}

function karavan_session_status(?array $user): array
{
    if ($user === null) {
        return [401, ['success' => false, 'logged_in' => false, 'error' => KARAVAN_NOT_LOGGED_IN_ERROR]];
    }
    return [200, [
        'success'   => true,
        'logged_in' => true,
        'user_id'   => (int) $user['id'],
        'username'  => $user['username'],
        'email'     => $user['email'] ?? null,
        'role'      => $user['role'],
    ]];
}
