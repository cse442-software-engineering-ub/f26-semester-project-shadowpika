<?php
require_once __DIR__ . '/config.php';

function karavan_pdo(): PDO
{
    $config = karavan_config();

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    if (!empty($config['db_dsn'])) {
        return new PDO($config['db_dsn'], $config['db_user'], $config['db_pass'], $options);
    }

    if (empty($config['db_name']) || empty($config['db_user'])) {
        throw new RuntimeException('Database credentials are not configured.');
    }

    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4";
    return new PDO($dsn, $config['db_user'], $config['db_pass'], $options);
}
