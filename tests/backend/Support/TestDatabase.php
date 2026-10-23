<?php
namespace Karavan\Tests\Support;

use PDO;

// SQLite stand-in for the MySQL schema in database/migrations/001_admin_requests.sql.
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
                email TEXT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
                community_id INTEGER NULL REFERENCES admin_requests (id) ON DELETE SET NULL
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
        // Mirrors database/migrations/002_approved_locations.sql.
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec(
            "CREATE TABLE approved_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                label TEXT NOT NULL,
                community TEXT NULL,
                created_by INTEGER NULL REFERENCES users (id) ON DELETE SET NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        );
        // Mirrors database/migrations/008_community_members.sql.
        $pdo->exec(
            "CREATE TABLE community_members (
                user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                community_id INTEGER NOT NULL REFERENCES admin_requests (id) ON DELETE CASCADE,
                shopping INTEGER NOT NULL DEFAULT 1,
                joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, community_id)
            )"
        );
        $pdo->exec(
            "CREATE TABLE community_join_requests (
                user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                community_id INTEGER NOT NULL REFERENCES admin_requests (id) ON DELETE CASCADE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, community_id)
            )"
        );
        // Mirrors sql/005_auth_tokens.sql.
        $pdo->exec(
            "CREATE TABLE auth_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                selector TEXT NOT NULL UNIQUE,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        );
        $pdo->exec(
            "CREATE TABLE listings (
                listing_id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NULL REFERENCES users (id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                price NUMERIC NOT NULL,
                `condition` TEXT NOT NULL,
                image_url TEXT NULL,
                category TEXT NOT NULL DEFAULT 'Other',
                related_course TEXT NULL,
                community TEXT NULL,
                meeting_location TEXT NULL,
                description TEXT NULL,
                status TEXT NOT NULL DEFAULT 'active'
            )"
        );

        return $pdo;
    }

    public static function addLocation(
        PDO $pdo,
        float $lat,
        float $lng,
        string $label,
        ?int $createdBy = null,
        ?string $community = null
    ): int
    {
        $stmt = $pdo->prepare('INSERT INTO approved_locations (lat, lng, label, created_by, community) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$lat, $lng, $label, $createdBy, $community]);
        return (int) $pdo->lastInsertId();
    }

    public static function addUser(PDO $pdo, string $username, string $role = 'user', ?string $email = null): int
    {
        $stmt = $pdo->prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)');
        $stmt->execute([$username, $email, password_hash('Password123!', PASSWORD_BCRYPT), $role]);
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
                (full_name, business_name, email, phone, password_hash, proof_file_name, proof_original_name, proof_mime_type, status, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $row['full_name'], $row['business_name'], $row['email'], $row['phone'],
            password_hash($row['password'], PASSWORD_BCRYPT),
            $row['proof_file_name'], $row['proof_original_name'], $row['proof_mime_type'], $row['status'],
            $row['user_id'] ?? null,
        ]);
        return (int) $pdo->lastInsertId();
    }

    public static function addListing(PDO $pdo, ?int $ownerId, array $overrides = []): int
    {
        $row = array_merge([
            'name'             => 'Calculus Textbook',
            'price'            => '35.00',
            'condition'        => 'Good',
            'image_url'        => 'uploads/calculus-textbook.jpg',
            'category'         => 'Textbooks',
            'related_course'   => 'MTH 141',
            'community'        => 'All of UB',
            'meeting_location' => 'Capen Hall · Main entrance',
            'description'      => 'Used for one semester.',
            'status'           => 'active',
        ], $overrides);
        $stmt = $pdo->prepare(
            'INSERT INTO listings
                (owner_id, name, price, `condition`, image_url, category, related_course, community, meeting_location, description, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $ownerId, $row['name'], $row['price'], $row['condition'], $row['image_url'],
            $row['category'], $row['related_course'], $row['community'], $row['meeting_location'],
            $row['description'], $row['status'],
        ]);
        return (int) $pdo->lastInsertId();
    }
}
