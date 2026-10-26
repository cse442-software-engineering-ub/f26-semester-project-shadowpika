<?php
// Local disposable-server test. Creates and drops only its own random checkin_test_* database.
// Usage: KARAVAN_CHECKIN_TEST_DSN=mysql:host=127.0.0.1;port=<temporary-server-port>
//        php tests/mysql/meeting_checkin_test.php
require_once dirname(__DIR__, 2) . '/backend/includes/meeting_checkin.php';

$dsn = getenv('KARAVAN_CHECKIN_TEST_DSN') ?: '';
if (!preg_match('/^mysql:host=127\.0\.0\.1;port=\d+$/', $dsn)) {
    throw new RuntimeException('Provide a local disposable-server DSN, without a database name.');
}
$connect = static fn(string $database = '') => new PDO($dsn . ($database ? ';dbname=' . $database : ''), 'root', '',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

if (($argv[1] ?? '') === 'worker') {
    $database = $argv[2] ?? '';
    if (!preg_match('/^checkin_test_[a-f0-9]{16}$/', $database)) throw new RuntimeException('Unsafe test database.');
    $pdo = $connect($database);
    file_put_contents($argv[3], 'ready');
    $now = new DateTimeImmutable('2026-11-06T17:00:0' . $argv[4] . 'Z');
    echo json_encode(karavan_check_in_meeting($pdo, 1, ['request_id' => 1, 'latitude' => 43, 'longitude' => -78.78,
        'accuracy_m' => 10, 'captured_at' => (float) $now->format('U.u') * 1000], $now));
    exit;
}

function check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
    echo 'PASS ' . $message . PHP_EOL;
}

$admin = $connect();
$database = 'checkin_test_' . bin2hex(random_bytes(8));
$admin->exec("CREATE DATABASE `$database`");
$workers = [];
$files = [];
try {
    $pdo = $connect($database);
    $pdo->exec('CREATE TABLE users (id INT PRIMARY KEY) ENGINE=InnoDB');
    $pdo->exec('CREATE TABLE listings (listing_id INT PRIMARY KEY, name VARCHAR(150), price DECIMAL(10,2), image_url VARCHAR(255)) ENGINE=InnoDB');
    $pdo->exec('CREATE TABLE approved_locations (id INT UNSIGNED PRIMARY KEY, lat DOUBLE, lng DOUBLE) ENGINE=InnoDB');
    $schema = file_get_contents(dirname(__DIR__, 2) . '/database/schema/meeting_requests.sql');
    $pdo->exec(str_replace('        checked_in_at  DATETIME(6)   NULL DEFAULT NULL,' . "\n", '', str_replace("\r\n", "\n", $schema)));
    $pdo->exec('INSERT INTO users VALUES (1)');
    $pdo->exec("INSERT INTO listings VALUES (1, 'Disposable check-in fixture', 12, NULL)");
    $pdo->exec('INSERT INTO approved_locations VALUES (1, 43, -78.78)');
    $pdo->exec("INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
        VALUES (1, 1, '2026-11-06', '12:00:00', 1, 'Disposable test location', 'approved')");
    $before = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    $migration = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/012_meeting_checkin.sql');
    $pdo->exec($migration);
    $pdo->exec($migration);
    $after = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    check(array_key_exists('checked_in_at', $after) && $after['checked_in_at'] === null, 'Migration adds nullable timestamp and can run twice.');
    unset($after['checked_in_at']);
    check($before === $after, 'Existing meeting fields are unchanged.');

    // Hold the row while both independent PHP workers enter the validation/write path.
    $pdo->beginTransaction();
    $pdo->query('SELECT * FROM meeting_requests WHERE request_id = 1 FOR UPDATE')->fetch();
    foreach ([1, 2] as $index) {
        $base = tempnam(sys_get_temp_dir(), 'checkin_worker_');
        $files = array_merge($files, [$base, "$base.out", "$base.err"]);
        $process = proc_open([PHP_BINARY, __FILE__, 'worker', $database, $base, (string) $index],
            [1 => ['file', "$base.out", 'w'], 2 => ['file', "$base.err", 'w']], $pipes);
        $workers[] = ['process' => $process, 'base' => $base];
    }
    foreach ($workers as $worker) {
        $ready = false;
        for ($i = 0; $i < 100; $i++) {
            if (file_get_contents($worker['base']) === 'ready') { $ready = true; break; }
            usleep(20000);
        }
        if (!$ready) throw new RuntimeException('Concurrent worker did not start.');
    }
    $pdo->commit();
    $results = [];
    foreach ($workers as &$worker) {
        $exit = proc_close($worker['process']);
        $worker['process'] = null;
        check($exit === 0, 'Concurrent worker completed.');
        $results[] = json_decode(file_get_contents($worker['base'] . '.out'), true, 512, JSON_THROW_ON_ERROR);
    }
    unset($worker);
    check($results[0][0] === 200 && $results[0] === $results[1], 'Concurrent submissions return the same first timestamp.');
    $saved = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    $pdo->exec($migration);
    check($saved === $pdo->query('SELECT * FROM meeting_requests')->fetch(), 'Migration rerun preserves a successful check-in.');
    $pdo->exec('DROP TABLE meeting_requests');
    $pdo->exec($schema);
    check($pdo->query("SHOW COLUMNS FROM meeting_requests LIKE 'checked_in_at'")->fetch() !== false, 'Fresh-install schema includes checked_in_at.');
} finally {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    foreach ($workers as $worker) {
        if (is_resource($worker['process'])) { proc_terminate($worker['process']); proc_close($worker['process']); }
    }
    $admin->exec("DROP DATABASE `$database`");
    foreach ($files as $file) if (is_file($file)) unlink($file);
}
