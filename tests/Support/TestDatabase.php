<?php
namespace Karavan\Tests\Support;

use PDO;

// SQLite stand-in for the MySQL schema in sql/001_admin_requests.sql.
final class TestDatabase
{
    public static function create(string $dsn = 'sqlite::memory:'): PDO
    {
        $pdo = new PDO($dsn, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        $pdo->exec(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator'))
            )"
        );
        $pdo->exec(
            "CREATE TABLE admin_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                business_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                proof_file_name TEXT NOT NULL,
                proof_original_name TEXT NOT NULL,
                proof_mime_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
                user_id INTEGER NULL,
                reviewed_by INTEGER NULL,
                reviewed_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        );
        // Mirrors AUTO_INCREMENT=5001 in the MySQL migration.
        $pdo->exec("INSERT INTO sqlite_sequence (name, seq) VALUES ('admin_requests', 5000)");
        // Mirrors sql/002_approved_locations.sql.
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec(
            "CREATE TABLE approved_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                label TEXT NOT NULL,
                created_by INTEGER NULL REFERENCES users (id) ON DELETE SET NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        );

        return $pdo;
    }

    public static function addLocation(PDO $pdo, float $lat, float $lng, string $label, ?int $createdBy = null): int
    {
        $stmt = $pdo->prepare('INSERT INTO approved_locations (lat, lng, label, created_by) VALUES (?, ?, ?, ?)');
        $stmt->execute([$lat, $lng, $label, $createdBy]);
        return (int) $pdo->lastInsertId();
    }

    public static function addUser(PDO $pdo, string $username, string $role = 'user'): int
    {
        $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
        $stmt->execute([$username, password_hash('Password123!', PASSWORD_BCRYPT), $role]);
        return (int) $pdo->lastInsertId();
    }

    public static function addRequest(PDO $pdo, array $overrides = []): int
    {
        static $counter = 0;
        $counter++;
        $row = array_merge([
            'full_name'           => 'Chun Admin',
            'business_name'       => 'Test business',
            'email'               => "applicant{$counter}@test.com",
            'phone'               => '123-456-7890',
            'password'            => 'Applicant123!',
            'proof_file_name'     => 'proof.pdf',
            'proof_original_name' => 'lease.pdf',
            'proof_mime_type'     => 'application/pdf',
            'status'              => 'pending',
        ], $overrides);

        $stmt = $pdo->prepare(
            'INSERT INTO admin_requests
                (full_name, business_name, email, phone, password_hash, proof_file_name, proof_original_name, proof_mime_type, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $row['full_name'], $row['business_name'], $row['email'], $row['phone'],
            password_hash($row['password'], PASSWORD_BCRYPT),
            $row['proof_file_name'], $row['proof_original_name'], $row['proof_mime_type'], $row['status'],
        ]);
        return (int) $pdo->lastInsertId();
    }
}
