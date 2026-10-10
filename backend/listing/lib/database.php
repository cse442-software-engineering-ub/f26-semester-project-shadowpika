<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/includes/config.php';

function listing_database(): mysqli
{
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    $config = karavan_config();
    $host = $config['db_host'];
    $database = $config['db_name'];
    $username = $config['db_user'];
    $password = $config['db_pass'];
    if (empty($database) || empty($username)) {
        throw new RuntimeException('Database credentials are not configured.');
    }

    $connection = new mysqli($host, $username, $password, $database);
    $connection->set_charset('utf8mb4');

    return $connection;
}
