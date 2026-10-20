-- Run once against cse442_2026_fall_team_j_db (e.g. in phpMyAdmin's SQL tab).
-- Assumes users already has an integer primary key column named `id`.
--
-- Roles:
--   user      - regular account (created by the normal Register page)
--   admin     - community partner, created when a moderator approves their admin request
--   moderator - Karavan staff who can review admin requests

ALTER TABLE users
    ADD COLUMN role ENUM('user', 'admin', 'moderator') NOT NULL DEFAULT 'user';

-- An applicant has no users row while pending. Approving copies email + password_hash
-- into users (role 'admin'); denying deletes the row and its uploaded document.
CREATE TABLE admin_requests (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    full_name           VARCHAR(255) NOT NULL,
    business_name       VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(32)  NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    proof_file_name     VARCHAR(255) NOT NULL,
    proof_original_name VARCHAR(255) NOT NULL,
    proof_mime_type     VARCHAR(100) NOT NULL,
    status              ENUM('pending', 'approved') NOT NULL DEFAULT 'pending',
    user_id             INT NULL,
    reviewed_by         INT NULL,
    reviewed_at         DATETIME NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_admin_requests_email (email),
    INDEX idx_admin_requests_status (status)
) ENGINE=InnoDB AUTO_INCREMENT=5001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Request IDs start at 5001; the task-card tests expect the first request to be 5001 and the second 5002.

-- Creating a moderator: register a normal account on the Register page, then promote it:
--   UPDATE users SET role = 'moderator' WHERE username = 'moderator@test.com';
