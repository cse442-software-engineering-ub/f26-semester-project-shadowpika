<?php

function karavan_send_headers(string $methods): void
{
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization");
    header("Access-Control-Allow-Methods: $methods, OPTIONS");
    header("Content-Type: application/json");
}

function karavan_send_json(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function karavan_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function karavan_session_user_id(): ?int
{
    karavan_start_session();
    return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
}
