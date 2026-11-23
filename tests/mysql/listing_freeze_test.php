<?php
declare(strict_types=1);
// #232: real HTTP + PDO/mysqli and deterministic InnoDB races, disposable loopback server only.
require_once dirname(__DIR__, 2) . '/backend/listing/lib/manage_listings.php';
require_once dirname(__DIR__, 2) . '/backend/includes/meeting_requests.php';
require_once dirname(__DIR__) . '/backend/Support/Fixtures.php';

use Karavan\Tests\Support\Fixtures;

$dsn = getenv('KARAVAN_FREEZE_TEST_DSN') ?: '';
if (!preg_match('/\Amysql:host=127\.0\.0\.1;port=(\d+)\z/', $dsn, $matches)) {
    throw new RuntimeException('Set loopback-only KARAVAN_FREEZE_TEST_DSN without a database name.');
}
$connect = static fn(string $db = '') => new PDO($dsn . ($db ? ';dbname=' . $db : ''), 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);
$clock = new DateTimeImmutable('2026-11-16T19:00:00Z');

/** Test-only barrier after the real application acquires its listing lock. */
final class FreezeRaceStatement extends PDOStatement
{
    protected function __construct(private string $directory) {}
    public function execute(?array $params = null): bool
    {
        $ok = parent::execute($params);
        if (stripos($this->queryString, 'FROM listings') !== false
            && stripos($this->queryString, 'FOR UPDATE') !== false
            && !is_file($this->directory . '/locked')) {
            file_put_contents($this->directory . '/locked', 'locked');
            $until = microtime(true) + 15;
            while (!is_file($this->directory . '/release')) {
                if (microtime(true) > $until) throw new RuntimeException('Race barrier timed out.');
                usleep(10000);
            }
        }
        return $ok;
    }
}

if (($argv[1] ?? '') === 'worker') {
    $db = $argv[2] ?? '';
    if (!preg_match('/\Afreeze_test_[a-f0-9]{16}\z/', $db)) throw new RuntimeException('Unsafe test database.');
    $pdo = $connect($db);
    $directory = $argv[3];
    file_put_contents($directory . '/ready', (string) $pdo->query('SELECT CONNECTION_ID()')->fetchColumn());
    if ($argv[5] === 'barrier') $pdo->setAttribute(PDO::ATTR_STATEMENT_CLASS, [FreezeRaceStatement::class, [$directory]]);
    $result = match ($argv[4]) {
        'freeze' => update_my_listing($pdo, 1, ['action' => 'freeze_all'], $clock),
        'approve' => karavan_respond_meeting_request($pdo, 1, ['request_id' => 1, 'action' => 'approve']),
        'accept' => karavan_accept_location_change($pdo, 2, ['request_id' => 1]),
        'create' => karavan_create_meeting_request($pdo, 2, ['listing_id' => 1, 'location_id' => 1,
            'meeting_date' => '2099-12-18', 'meeting_time' => '14:00']),
        default => throw new RuntimeException('Unknown worker action.'),
    };
    echo json_encode($result, JSON_THROW_ON_ERROR);
    exit;
}

$checks = 0;
function freeze_check(bool $condition, string $label): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($label);
    ++$checks;
    echo "PASS $label\n";
}
function freeze_wait(callable $ready, string $label): void
{
    $until = microtime(true) + 10;
    do {
        if ($ready()) return;
        usleep(20000);
    } while (microtime(true) < $until);
    throw new RuntimeException($label);
}

$db = 'freeze_test_' . bin2hex(random_bytes(8));
$user = $db;
$password = bin2hex(random_bytes(16));
$work = Fixtures::tempDir('karavan_freeze_');
mkdir($work . '/sessions');
$admin = $connect();
$pdo = null;
$server = null;
$workers = [];
try {
    $admin->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4; CREATE USER '$user'@'127.0.0.1' IDENTIFIED BY '$password'; GRANT ALL ON `$db`.* TO '$user'@'127.0.0.1'");
    $pdo = $connect($db);
    $pdo->exec("CREATE TABLE users(id INT PRIMARY KEY,username VARCHAR(100),email VARCHAR(100),password_hash VARCHAR(255),role VARCHAR(20)) ENGINE=InnoDB;
        CREATE TABLE admin_requests(id INT PRIMARY KEY,business_name VARCHAR(255),status VARCHAR(20),user_id INT NULL) ENGINE=InnoDB;
        CREATE TABLE community_members(user_id INT,community_id INT,shopping INT,PRIMARY KEY(user_id,community_id)) ENGINE=InnoDB;
        CREATE TABLE auth_tokens(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,selector VARCHAR(24),token_hash VARCHAR(64),expires_at DATETIME) ENGINE=InnoDB;
        CREATE TABLE approved_locations(id INT PRIMARY KEY,label VARCHAR(100),community VARCHAR(255),lat DOUBLE,lng DOUBLE) ENGINE=InnoDB;
        CREATE TABLE listings(listing_id INT PRIMARY KEY,owner_id INT,name VARCHAR(255),category VARCHAR(100) DEFAULT 'Other',`condition` VARCHAR(50) DEFAULT 'Good',price DECIMAL(10,2) DEFAULT 10,
            related_course VARCHAR(100),community VARCHAR(255) DEFAULT 'Karavan',meeting_location VARCHAR(150) DEFAULT 'Baldy 19',meeting_location_id INT DEFAULT 1,
            description TEXT,image_url VARCHAR(255),status ENUM('active','sold','inactive') DEFAULT 'active',allow_offers TINYINT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX owner_status(owner_id,status)) ENGINE=InnoDB;
        CREATE TABLE listing_images(listing_id INT,position TINYINT,image_url VARCHAR(255),PRIMARY KEY(listing_id,position)) ENGINE=InnoDB;
        CREATE TABLE meeting_requests(request_id INT AUTO_INCREMENT PRIMARY KEY,buyer_id INT,listing_id INT,
            meeting_date DATE DEFAULT '2099-12-18',meeting_time TIME DEFAULT '14:00:00',location_id INT DEFAULT 1,location_label VARCHAR(150) DEFAULT 'Baldy 19',
            status VARCHAR(32) DEFAULT 'pending',checked_in_at DATETIME(6),seller_checked_in_at DATETIME(6),
            original_location_id INT,original_location_label VARCHAR(150),location_change_result VARCHAR(20),offer_price DECIMAL(10,2),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(listing_id) REFERENCES listings(listing_id)) ENGINE=InnoDB;
        CREATE TABLE favorites(favorite_id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,listing_id INT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
        CREATE TABLE recently_viewed(user_id INT,listing_id INT,viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,listing_id)) ENGINE=InnoDB;
        CREATE TABLE ratings(seller_id INT,reviewer_id INT,stars INT,review TEXT,`time` DATETIME) ENGINE=InnoDB;
        INSERT INTO users VALUES(1,'seller','seller@test.invalid','unused','user'),(2,'buyer','buyer@test.invalid','unused','user');
        INSERT INTO admin_requests VALUES(5001,'Karavan','approved',NULL);
        INSERT INTO approved_locations VALUES(1,'Baldy 19','Karavan',43,-78);
        INSERT INTO listings(listing_id,owner_id,name,status) VALUES(1,1,'Freeze regular','active'),(2,1,'Future protected','active'),
            (3,1,'Completed protected','active'),(4,1,'Expired approved','active'),(5,1,'Sold record','sold'),(6,1,'Already paused','inactive'),
            (7,2,'Other owner','active'),(8,1,'Second eligible','active');
        INSERT INTO meeting_requests(request_id,buyer_id,listing_id,status) VALUES(1,2,1,'pending'),(2,2,1,'location_change_requested'),
            (3,2,1,'denied'),(4,2,2,'approved'),(5,2,2,'pending'),(6,2,3,'approved'),(7,2,4,'approved'),(8,2,4,'pending');
        UPDATE meeting_requests SET meeting_date='2000-01-01' WHERE request_id IN (6,7);
        UPDATE meeting_requests SET checked_in_at='2000-01-01 17:00:00',seller_checked_in_at='2000-01-01 17:01:00' WHERE request_id=6;
        INSERT INTO favorites(user_id,listing_id) VALUES(2,1);
        INSERT INTO recently_viewed(user_id,listing_id) VALUES(2,1);");

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $docRoot = getenv('KARAVAN_FREEZE_TEST_DOCROOT') ?: dirname(__DIR__, 2) . '/deploy';
    $env = array_merge(getenv(), ['KARAVAN_DB_DSN' => $dsn . ';dbname=' . $db,
        'KARAVAN_DB_HOST' => '127.0.0.1:' . $matches[1], 'KARAVAN_DB_NAME' => $db,
        'KARAVAN_DB_USER' => $user, 'KARAVAN_DB_PASS' => $password]);
    $server = proc_open([PHP_BINARY, '-d', 'session.save_path=' . $work . '/sessions', '-S', $address, '-t', $docRoot],
        [1 => ['file', $work . '/server.log', 'a'], 2 => ['file', $work . '/server.log', 'a']], $pipes, $docRoot, $env);
    freeze_wait(static function () use ($address) {
        $s = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
        if ($s) { fclose($s); return true; }
        return false;
    }, 'HTTP server failed to start.');
    $sessions = [];
    foreach ([1, 2] as $id) {
        $sessions[$id] = bin2hex(random_bytes(16));
        file_put_contents($work . '/sessions/sess_' . $sessions[$id], "user_id|i:$id;");
    }
    $http = static function (string $path, ?array $body = null, ?int $as = 1, string $method = 'POST') use ($address, $sessions): array {
        $curl = curl_init('http://' . $address . '/' . $path);
        $headers = ['Content-Type: application/json'];
        if ($as !== null) $headers[] = 'Cookie: PHPSESSID=' . $sessions[$as];
        curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 10]);
        if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body));
        $raw = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        return [$status, json_decode((string) $raw, true), $raw];
    };
    $endpoint = 'listing/api/update_listing.php';
    [$anonymousStatus, $anonymousBody, $anonymousRaw] = $http($endpoint, ['action' => 'freeze_all'], null);
    freeze_check($anonymousStatus === 401, $anonymousStatus === 401 ? 'anonymous freeze rejected'
        : 'anonymous freeze rejected: ' . json_encode([$anonymousStatus, $anonymousBody, $anonymousRaw]));
    freeze_check($http($endpoint, null, 1, 'GET')[0] === 405, 'wrong method rejected');
    [$status, $body] = $http('listing/api/get_my_listings.php', null, 1, 'GET');
    $rows = array_column($body['results'] ?? [], null, 'listing_id');
    freeze_check($status === 200 && $rows[1]['can_freeze'] === true, 'real listing API returns eligibility');
    freeze_check($rows[2]['freeze_block_reason'] === 'approved_meeting' && $rows[3]['freeze_block_reason'] === 'completed_meeting', 'API distinguishes protected meeting reasons');
    [$status, $body] = $http($endpoint, ['action' => 'freeze_all']);
    freeze_check($status === 200 && $body === ['success' => true, 'frozen_count' => 3, 'skipped_count' => 2, 'cancelled_request_count' => 3], 'HTTP freezes correct owner subset and counts cancellations');
    freeze_check($pdo->query("SELECT status FROM listings WHERE listing_id=7")->fetchColumn() === 'active', 'other owner unchanged');
    freeze_check($pdo->query("SELECT status FROM listings WHERE listing_id=5")->fetchColumn() === 'sold', 'Sold record unchanged');
    freeze_check(array_map('intval', $pdo->query('SELECT request_id FROM meeting_requests ORDER BY request_id')->fetchAll(PDO::FETCH_COLUMN)) === [3,4,5,6,7], 'denied, expired, approved and skipped-item requests retained');
    foreach (['api/get_my_meeting_requests.php' => 2, 'api/get_incoming_meeting_requests.php' => 1] as $path => $as) {
        [$status, $body] = $http($path, null, $as, 'GET');
        freeze_check($status === 200 && !array_intersect([1,2,8], array_column($body['requests'] ?? [], 'request_id')), 'canceled requests absent from ' . $path);
    }
    foreach (['api/search_listings.php?q=Freeze%20regular', 'api/get_recommended_items.php', 'api/get_previously_viewed_items.php', 'api/get_favorites.php'] as $path) {
        [$status, $body] = $http($path, null, 2, 'GET');
        $items = $body['results'] ?? $body['items'] ?? $body['favorites'] ?? [];
        freeze_check($status === 200 && !in_array(1, array_column($items, 'listing_id')), 'paused item hidden from ' . $path);
    }
    foreach (['listing/api/get_listing.php', 'api/get_item_details.php'] as $path) {
        freeze_check($http($path . '?listing_id=1', null, 2, 'GET')[0] === 404, 'old item URL unavailable: ' . $path);
    }
    freeze_check($http('listing/api/get_listing.php?listing_id=5', null, 2, 'GET')[0] === 200, 'legacy Sold read contract preserved');
    $create = ['listing_id' => 1, 'location_id' => 1, 'meeting_date' => '2099-12-18', 'meeting_time' => '14:00'];
    freeze_check($http('api/create_meeting_request.php', $create, 2)[0] === 404, 'stale purchase form rejected');
    freeze_check($http($endpoint, ['action' => 'resume', 'listing_id' => 1], 2)[0] === 404, 'nonowner restore rejected');
    freeze_check($http($endpoint, ['action' => 'resume', 'listing_id' => 5])[0] === 409, 'Sold restore rejected');
    freeze_check($http($endpoint, ['action' => 'resume', 'listing_id' => 1])[1] === ['success' => true, 'listing_id' => 1, 'status' => 'active'], 'paused owner listing restored');
    freeze_check($http($endpoint, ['action' => 'resume', 'listing_id' => 1])[0] === 200, 'repeated restore succeeds without extra changes');
    freeze_check((int) $pdo->query('SELECT COUNT(*) FROM meeting_requests WHERE listing_id=1')->fetchColumn() === 1, 'restore retains only old denied history, not canceled requests');
    freeze_check($http('api/create_meeting_request.php', $create, 2)[0] === 201, 'fresh purchase allowed after restore');

    // A database trigger injects a real failure after earlier rows and requests have changed.
    $pdo->exec("DELETE FROM meeting_requests; DELETE FROM listings; INSERT INTO listings(listing_id,owner_id,name) VALUES(1,1,'Rollback A'),(2,1,'Rollback B');
        INSERT INTO meeting_requests(buyer_id,listing_id) VALUES(2,1),(2,2);
        CREATE TRIGGER fail_freeze BEFORE UPDATE ON listings FOR EACH ROW BEGIN
            IF NEW.listing_id=2 AND NEW.status='inactive' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='rollback probe'; END IF; END");
    freeze_check($http($endpoint, ['action' => 'freeze_all'])[0] === 500, 'HTTP database failure reports failure');
    freeze_check((int) $pdo->query("SELECT COUNT(*) FROM listings WHERE status='active'")->fetchColumn() === 2
        && (int) $pdo->query('SELECT COUNT(*) FROM meeting_requests')->fetchColumn() === 2, 'InnoDB rolls back all item and request changes');
    $pdo->exec('DROP TRIGGER fail_freeze');

    $start = static function (string $action, bool $barrier, string $directory) use ($db, &$workers): int {
        mkdir($directory);
        $process = proc_open([PHP_BINARY, __FILE__, 'worker', $db, $directory, $action, $barrier ? 'barrier' : 'normal'],
            [1 => ['file', $directory . '/out', 'w'], 2 => ['file', $directory . '/err', 'w']], $pipes);
        $workers[] = ['process' => $process, 'directory' => $directory];
        return array_key_last($workers);
    };
    foreach (['approve', 'accept', 'create', 'freeze'] as $op) {
        foreach (['freeze', 'other'] as $winner) {
            $pdo->exec("DELETE FROM meeting_requests; DELETE FROM listings;
                INSERT INTO listings(listing_id,owner_id,name) VALUES(1,1,'Race item')");
            if ($op !== 'create') {
                $state = $op === 'accept' ? 'location_change_requested' : 'pending';
                $pdo->exec("INSERT INTO meeting_requests(request_id,buyer_id,listing_id,status) VALUES(1,2,1,'$state')");
            }
            $firstAction = $winner === 'freeze' ? 'freeze' : $op;
            $secondAction = $winner === 'freeze' ? $op : 'freeze';
            $dir = $work . '/' . $op . '-' . $winner;
            mkdir($dir);
            $first = $start($firstAction, true, $dir . '/first');
            freeze_wait(static fn() => is_file($dir . '/first/locked'), 'Winner did not acquire listing lock.');
            $second = $start($secondAction, false, $dir . '/second');
            freeze_wait(static fn() => is_file($dir . '/second/ready'), 'Waiter failed to start.');
            $connectionId = (int) file_get_contents($dir . '/second/ready');
            // Observe a real lock wait rather than hoping a sleep produces a race.
            freeze_wait(static function () use ($admin, $connectionId) {
                return (int) $admin->query("SELECT COUNT(*) FROM information_schema.innodb_trx
                    WHERE trx_mysql_thread_id=$connectionId AND trx_state='LOCK WAIT'")->fetchColumn() > 0;
            }, 'Competing operation did not wait for listing lock.');
            file_put_contents($dir . '/first/release', 'release');
            $results = [];
            foreach ([$first, $second] as $index) {
                $worker = &$workers[$index];
                $code = proc_close($worker['process']);
                $worker['process'] = null;
                if ($code !== 0) throw new RuntimeException('Race worker failed: ' . file_get_contents($worker['directory'] . '/err'));
                $results[] = json_decode(file_get_contents($worker['directory'] . '/out'), true, 512, JSON_THROW_ON_ERROR);
                unset($worker);
            }
            $status = $pdo->query('SELECT status FROM listings WHERE listing_id=1')->fetchColumn();
            $approved = (int) $pdo->query("SELECT COUNT(*) FROM meeting_requests WHERE status='approved'")->fetchColumn();
            $requests = (int) $pdo->query('SELECT COUNT(*) FROM meeting_requests')->fetchColumn();
            if ($winner === 'other' && in_array($op, ['approve', 'accept'], true)) {
                freeze_check($results[0][0] === 200 && $results[1][1]['skipped_count'] === 1
                    && $status === 'active' && $approved === 1, "$op wins: approved meeting preserved and freeze skips");
            } else {
                freeze_check($status === 'inactive' && $approved === 0 && $requests === 0, "$op / $winner wins: frozen state has no new or approved request");
                if ($winner === 'freeze' && $op !== 'freeze') freeze_check($results[1][0] >= 400, "$op loses to freeze with an error");
                if ($op === 'freeze') freeze_check($results[0][1]['frozen_count'] === 1
                    && $results[1][1]['frozen_count'] === 0, 'competing freezes count each changed item only once');
                if ($op === 'create' && $winner === 'other') freeze_check($results[0][0] === 201
                    && $results[1][1]['cancelled_request_count'] === 1, 'creation first is canceled and counted by freeze');
            }
        }
    }
    echo "Completed $checks real MySQL/HTTP checks.\n";
} finally {
    foreach ($workers as $worker) {
        if (is_resource($worker['process'])) { proc_terminate($worker['process']); proc_close($worker['process']); }
    }
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
    $pdo = null;
    $admin->exec("DROP DATABASE IF EXISTS `$db`; DROP USER IF EXISTS '$user'@'127.0.0.1'");
    if ($checks === 0 && is_file($work . '/server.log')) echo file_get_contents($work . '/server.log');
    Fixtures::removeDir($work);
}
