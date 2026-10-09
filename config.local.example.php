<?php
// Copy to config.local.php (gitignored) on the server and fill in real values.
// Environment variables KARAVAN_DB_HOST / _NAME / _USER / _PASS / KARAVAN_UPLOAD_DIR override these.
return [
    'db_host'    => 'localhost',
    'db_name'    => 'cse442_2026_fall_team_j_db',
    'db_user'    => '',
    'db_pass'    => '',
    // Absolute path to a writable directory that is NOT inside the web root.
    'upload_dir' => '/path/outside/web/root/karavan_uploads',
];
