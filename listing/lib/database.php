<?php
declare(strict_types=1);

function listing_database(): mysqli
{
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    $host = getenv('KARAVAN_DB_HOST') ?: 'localhost';
    $database = getenv('KARAVAN_DB_NAME') ?: 'cse442_2026_fall_team_j_db';
    $username = getenv('KARAVAN_DB_USER') ?: 'ndberg';
    $password = getenv('KARAVAN_DB_PASSWORD') ?: '50250298';

    $connection = new mysqli($host, $username, $password, $database);
    $connection->set_charset('utf8mb4');

    return $connection;
}
