<?php
// Settings come from environment variables first, then from config.local.php
// (gitignored, lives next to this repo's PHP files). Never commit real credentials.

function karavan_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $local = [];
    $localPath = dirname(__DIR__) . '/../config.local.php';
    if (is_file($localPath)) {
        $loaded = require $localPath;
        if (is_array($loaded)) {
            $local = $loaded;
        }
    }

    $pick = function (string $envName, string $key, $default = null) use ($local) {
        $env = getenv($envName);
        if ($env !== false && $env !== '') {
            return $env;
        }
        return $local[$key] ?? $default;
    };

    $config = [
        // Full DSN override (used by the test suite to point at SQLite).
        'db_dsn'     => $pick('KARAVAN_DB_DSN', 'db_dsn'),
        'db_host'    => $pick('KARAVAN_DB_HOST', 'db_host', 'localhost'),
        'db_name'    => $pick('KARAVAN_DB_NAME', 'db_name'),
        'db_user'    => $pick('KARAVAN_DB_USER', 'db_user'),
        'db_pass'    => $pick('KARAVAN_DB_PASS', 'db_pass'),
        // Must be outside the web root so uploaded documents can't be fetched directly.
        'upload_dir' => $pick('KARAVAN_UPLOAD_DIR', 'upload_dir', dirname(__DIR__, 2) . '/karavan_uploads'),
    ];

    return $config;
}
