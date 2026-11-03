<?php
// Disposable loopback server only. Creates/drops its own random checkin_test_* database.
// KARAVAN_CHECKIN_TEST_DSN=mysql:host=127.0.0.1;port=<temporary-server-port>
require_once dirname(__DIR__, 2) . '/backend/includes/meeting_checkin.php';
require_once dirname(__DIR__, 2) . '/backend/listing/lib/manage_listings.php';

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
    $result = $argv[6] === 'sold'
        ? update_my_listing($pdo, (int) $argv[5], ['action' => 'update_status', 'listing_id' => 1, 'status' => 'sold'])
        : karavan_check_in_meeting($pdo, (int) $argv[5], ['request_id' => 1, 'latitude' => 43, 'longitude' => -78.78,
            'accuracy_m' => 10, 'captured_at' => (float) $now->format('U.u') * 1000], $now);
    echo json_encode($result, JSON_THROW_ON_ERROR);
    exit;
}

function check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
    echo 'PASS ' . $message . PHP_EOL;
}

$admin = $connect();
$database = 'checkin_test_' . bin2hex(random_bytes(8));
$admin->exec('CREATE DATABASE ' . $database);
$workers = [];
$files = [];
try {
    $pdo = $connect($database);
    $pdo->exec('CREATE TABLE users (id INT PRIMARY KEY) ENGINE=InnoDB');
    $pdo->exec('CREATE TABLE listings (listing_id INT PRIMARY KEY, owner_id INT, status VARCHAR(20),
        name VARCHAR(150), price DECIMAL(10,2), image_url VARCHAR(255)) ENGINE=InnoDB');
    $pdo->exec('CREATE TABLE approved_locations (id INT UNSIGNED PRIMARY KEY, lat DOUBLE, lng DOUBLE) ENGINE=InnoDB');
    $schema = str_replace("\r\n", "\n", file_get_contents(dirname(__DIR__, 2) . '/database/schema/meeting_requests.sql'));
    $legacySchema = preg_replace('/^        (?:checked_in_at|seller_checked_in_at)\s+DATETIME\(6\)[^\n]+\n/m', '', $schema);
    $pdo->exec($legacySchema);
    $pdo->exec('INSERT INTO users VALUES (1), (2)');
    $pdo->exec("INSERT INTO listings VALUES (1, 2, 'active', 'Disposable check-in fixture', 12, NULL)");
    $pdo->exec('INSERT INTO approved_locations VALUES (1, 43, -78.78)');
    $pdo->exec("INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
        VALUES (1, 1, '2026-11-06', '12:00:00', 1, 'Disposable test location', 'approved')");
    $before = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    $migration = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/012_meeting_checkin.sql');
    $pdo->exec($migration); $pdo->exec($migration);
    $after = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    check(array_key_exists('checked_in_at', $after) && $after['checked_in_at'] === null, '012 adds nullable buyer timestamp and can run twice.');
    unset($after['checked_in_at']);
    check($before === $after, '012 preserves existing meeting fields.');
    $pdo->exec("UPDATE meeting_requests SET checked_in_at = '2026-11-06 16:59:00.654321'");
    $before = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    $sellerMigration = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/013_seller_meeting_checkin.sql');
    $pdo->exec($sellerMigration); $pdo->exec($sellerMigration);
    $after = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    check(array_key_exists('seller_checked_in_at', $after) && $after['seller_checked_in_at'] === null,
        '013 adds nullable seller timestamp and can run twice.');
    unset($after['seller_checked_in_at']);
    check($before === $after, '013 preserves existing buyer timestamp and all meeting data.');

    $race = static function (array $jobs) use ($pdo, $database, &$workers, &$files): array {
        $start = count($workers);
        $pdo->beginTransaction();
        $pdo->query('SELECT * FROM listings WHERE listing_id = 1 FOR UPDATE')->fetch();
        foreach ($jobs as $index => [$user, $action]) {
            $base = tempnam(sys_get_temp_dir(), 'checkin_worker_');
            $files = array_merge($files, [$base, "$base.out", "$base.err"]);
            $process = proc_open([PHP_BINARY, __FILE__, 'worker', $database, $base, (string) ($index + 1), (string) $user, $action],
                [1 => ['file', "$base.out", 'w'], 2 => ['file', "$base.err", 'w']], $pipes);
            $workers[] = ['process' => $process, 'base' => $base];
        }
        foreach (array_slice($workers, $start) as $worker) {
            $ready = false;
            for ($i = 0; $i < 100; $i++) {
                if (file_get_contents($worker['base']) === 'ready') { $ready = true; break; }
                usleep(20000);
            }
            if (!$ready) throw new RuntimeException('Concurrent worker did not start.');
        }
        usleep(100000);
        $pdo->commit();
        $results = [];
        for ($i = $start; $i < count($workers); $i++) {
            $exit = proc_close($workers[$i]['process']);
            $workers[$i]['process'] = null;
            if ($exit !== 0) throw new RuntimeException('Concurrent worker failed: ' . file_get_contents($workers[$i]['base'] . '.err'));
            $results[] = json_decode(file_get_contents($workers[$i]['base'] . '.out'), true, 512, JSON_THROW_ON_ERROR);
        }
        return $results;
    };

    // Only this random disposable fixture is reset between independent race cases.
    $pdo->exec('UPDATE meeting_requests SET checked_in_at = NULL');
    $results = $race([[1, 'checkin'], [1, 'checkin']]);
    check($results[0][0] === 200 && $results[0] === $results[1], 'Duplicate concurrent buyer submissions keep one first timestamp.');
    $buyerTimestamp = $pdo->query('SELECT checked_in_at FROM meeting_requests')->fetchColumn();
    $results = $race([[2, 'checkin'], [2, 'checkin']]);
    check($results[0][0] === 200 && $results[0] === $results[1] && $results[0][1]['both_checked_in'],
        'Duplicate concurrent seller submissions keep one independent first timestamp.');
    check($buyerTimestamp === $pdo->query('SELECT checked_in_at FROM meeting_requests')->fetchColumn()
        && $pdo->query('SELECT status FROM listings')->fetchColumn() === 'active',
        'Seller check-in preserves buyer timestamp and never automatically sells.');
    $saved = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    $pdo->exec($migration); $pdo->exec($sellerMigration);
    check($saved === $pdo->query('SELECT * FROM meeting_requests')->fetch(), 'Migration reruns preserve both successful check-ins.');

    $pdo->exec('UPDATE meeting_requests SET checked_in_at = NULL, seller_checked_in_at = NULL');
    $results = $race([[1, 'checkin'], [2, 'checkin']]);
    $row = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    check($results[0][0] === 200 && $results[1][0] === 200 && $row['checked_in_at'] !== null && $row['seller_checked_in_at'] !== null,
        'Concurrent buyer and seller check-ins both persist without overwriting each other.');
    $pdo->exec('UPDATE meeting_requests SET seller_checked_in_at = NULL');
    $results = $race([[2, 'checkin'], [2, 'sold']]);
    $row = $pdo->query('SELECT * FROM meeting_requests')->fetch();
    $listingStatus = $pdo->query('SELECT status FROM listings')->fetchColumn();
    check($results[0][0] === 200 && in_array($results[1][0], [200, 409], true)
        && $row['checked_in_at'] !== null && $row['seller_checked_in_at'] !== null
        && $listingStatus === ($results[1][0] === 200 ? 'sold' : 'active'),
        'Concurrent Sold waits for both check-ins or rejects; no deadlock or premature sale.');
    check(update_my_listing($pdo, 2, ['action' => 'update_status', 'listing_id' => 1, 'status' => 'sold'])[0] === 200,
        'Seller can safely retry Sold after both check-ins.');

    $pdo->exec('DROP TABLE meeting_requests');
    $pdo->exec($schema);
    check($pdo->query("SHOW COLUMNS FROM meeting_requests LIKE 'checked_in_at'")->fetch() !== false
        && $pdo->query("SHOW COLUMNS FROM meeting_requests LIKE 'seller_checked_in_at'")->fetch() !== false,
        'Fresh-install schema includes both timestamp columns.');
} finally {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    foreach ($workers as $worker) {
        if (is_resource($worker['process'])) { proc_terminate($worker['process']); proc_close($worker['process']); }
    }
    $admin->exec('DROP DATABASE ' . $database);
    foreach ($files as $file) if (is_file($file)) unlink($file);
}
