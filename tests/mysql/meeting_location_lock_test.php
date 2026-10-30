<?php
// #206: races use only a disposable loopback MySQL/MariaDB database.
require_once dirname(__DIR__, 2) . '/backend/includes/meeting_requests.php';

$dsn = getenv('KARAVAN_CHECKIN_TEST_DSN') ?: '';
if (!preg_match('/^mysql:host=127\.0\.0\.1;port=\d+$/', $dsn)) {
    throw new RuntimeException('Provide a local disposable-server DSN, without a database name.');
}
$connect = static fn(string $database = '') => new PDO($dsn . ($database ? ';dbname=' . $database : ''), 'root', '',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

if (($argv[1] ?? '') === 'worker') {
    $database = $argv[2] ?? '';
    if (!preg_match('/^meeting_lock_test_[a-f0-9]{16}$/', $database)) throw new RuntimeException('Unsafe test database.');
    $pdo = $connect($database);
    file_put_contents($argv[3], 'ready');
    echo json_encode(karavan_respond_meeting_request($pdo, 2,
        ['request_id' => 1, 'action' => $argv[4], 'location_id' => 2]), JSON_THROW_ON_ERROR);
    exit;
}

function checkLocationLock(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
    echo 'PASS ' . $message . PHP_EOL;
}

$admin = $connect();
$database = 'meeting_lock_test_' . bin2hex(random_bytes(8));
$admin->exec("CREATE DATABASE `$database`");
$workers = [];
$files = [];
try {
    $pdo = $connect($database);
    $pdo->exec('CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(100)) ENGINE=InnoDB');
    $pdo->exec('CREATE TABLE listings (listing_id INT PRIMARY KEY, owner_id INT, name VARCHAR(100), price DECIMAL(10,2), image_url VARCHAR(255), community VARCHAR(100), status VARCHAR(20) DEFAULT "active") ENGINE=InnoDB');
    $pdo->exec('CREATE TABLE approved_locations (id INT PRIMARY KEY, label VARCHAR(100), community VARCHAR(100)) ENGINE=InnoDB');
    $pdo->exec('CREATE TABLE meeting_requests (request_id INT PRIMARY KEY, buyer_id INT, listing_id INT,
        meeting_date DATE, meeting_time TIME, location_id INT, location_label VARCHAR(100),
        status VARCHAR(30), checked_in_at DATETIME(6), seller_checked_in_at DATETIME(6), created_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
    $pdo->exec("INSERT INTO users VALUES (1, 'buyer@test.invalid'), (2, 'seller@test.invalid')");
    $pdo->exec("INSERT INTO listings (listing_id, owner_id, name, price, image_url, community) VALUES (1, 2, 'Disposable location-lock test', 10, NULL, 'QA')");
    $pdo->exec("INSERT INTO approved_locations VALUES (1, 'Original spot', 'QA'), (2, 'Proposed spot', 'QA')");
    $pdo->exec("INSERT INTO meeting_requests (request_id, buyer_id, listing_id, meeting_date, meeting_time,
        location_id, location_label, status) VALUES (1, 1, 1, '2026-11-06', '12:00:00', 1, 'Original spot', 'pending')");

    // Hold the row while both workers read the pending state and try conditional updates.
    $pdo->beginTransaction();
    $pdo->query('SELECT * FROM meeting_requests WHERE request_id = 1 FOR UPDATE')->fetch();
    foreach (['approve', 'change_location'] as $action) {
        $base = tempnam(sys_get_temp_dir(), 'meeting_lock_');
        $files = array_merge($files, [$base, "$base.out", "$base.err"]);
        $process = proc_open([PHP_BINARY, __FILE__, 'worker', $database, $base, $action],
            [1 => ['file', "$base.out", 'w'], 2 => ['file', "$base.err", 'w']], $pipes);
        $workers[] = ['process' => $process, 'base' => $base, 'action' => $action];
    }
    foreach ($workers as $worker) {
        $ready = false;
        for ($i = 0; $i < 100; $i++) {
            if (file_get_contents($worker['base']) === 'ready') { $ready = true; break; }
            usleep(20000);
        }
        if (!$ready) throw new RuntimeException('Location-lock worker did not start.');
    }
    // Permit both processes to reach their conditional write before releasing the row.
    usleep(200000);
    $pdo->commit();
    $results = [];
    foreach ($workers as &$worker) {
        $exit = proc_close($worker['process']);
        $worker['process'] = null;
        if ($exit !== 0) throw new RuntimeException('Location-lock worker failed.');
        $results[$worker['action']] = json_decode(file_get_contents($worker['base'] . '.out'), true, 512, JSON_THROW_ON_ERROR);
    }
    unset($worker);
    $codes = [$results['approve'][0], $results['change_location'][0]];
    sort($codes);
    checkLocationLock($codes === [200, 409], 'Concurrent approval and location change have exactly one winner.');
    $row = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    $approvalWon = $results['approve'][0] === 200;
    checkLocationLock($row['status'] === ($approvalWon ? 'approved' : 'location_change_requested')
        && (int) $row['location_id'] === ($approvalWon ? 1 : 2)
        && $row['location_label'] === ($approvalWon ? 'Original spot' : 'Proposed spot'),
        'The losing stale request cannot overwrite the winning meeting location.');

    // Independent approved fixture within this disposable database, with a saved check-in.
    $pdo->exec("UPDATE meeting_requests SET status = 'approved', checked_in_at = '2026-11-06 17:00:00.123456'");
    $before = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    $blocked = karavan_respond_meeting_request($pdo, 2,
        ['request_id' => 1, 'action' => 'change_location', 'location_id' => $approvalWon ? 2 : 1]);
    checkLocationLock($blocked[0] === 409 && $before === $pdo->query('SELECT * FROM meeting_requests')->fetch(),
        'Approved location and recorded check-in remain unchanged after a rejected edit.');
} finally {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    foreach ($workers as $worker) {
        if (is_resource($worker['process'])) { proc_terminate($worker['process']); proc_close($worker['process']); }
    }
    $admin->exec("DROP DATABASE `$database`");
    foreach ($files as $file) if (is_file($file)) unlink($file);
}
