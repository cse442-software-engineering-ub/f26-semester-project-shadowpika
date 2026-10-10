<?php
// Creates (or resets) scripts/local-dev/runtime/local.sqlite with the Karavan schema and two ready-made accounts.
// Usage: php scripts/local-dev/setup_local_db.php
require_once dirname(__DIR__, 2) . '/tests/backend/Support/TestDatabase.php';

use Karavan\Tests\Support\TestDatabase;

$runtimeDir = __DIR__ . '/runtime';
if (!is_dir($runtimeDir)) mkdir($runtimeDir, 0775, true);
$dbFile = $runtimeDir . '/local.sqlite';
$uploadDir = $runtimeDir . '/uploads';

@unlink($dbFile);
if (is_dir($uploadDir)) {
    array_map('unlink', glob("$uploadDir/*") ?: []);
} else {
    mkdir($uploadDir, 0777, true);
}

$pdo = TestDatabase::create("sqlite:$dbFile");

$accounts = [
    ['mod@test.com', 'Moderator123!', 'moderator'],
    ['user@test.com', 'User12345!', 'user'],
];
$insert = $pdo->prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)');
foreach ($accounts as [$username, $password, $role]) {
    $insert->execute([$username, $username, password_hash($password, PASSWORD_BCRYPT), $role]);
}

echo "Local database ready: $dbFile\n\n";
echo "Accounts (log in on the normal login page):\n";
foreach ($accounts as [$username, $password, $role]) {
    printf("  %-10s %-16s password: %s\n", $role, $username, $password);
}
echo "\nAdmin requests start at id 5001. Re-run this script any time to start fresh.\n";
