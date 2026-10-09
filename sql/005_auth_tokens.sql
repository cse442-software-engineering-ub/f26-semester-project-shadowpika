-- Run once against cse442_2026_fall_team_j_db (e.g. in phpMyAdmin's SQL tab), after 001–004.
-- "Remember me" logins: PHP sessions end when the browser closes (and Aptitude clears idle ones),
-- so login.php also issues a 30-day token. The cookie holds "selector:validator"; only a SHA-256
-- hash of the validator is stored here. Logging out deletes the token.
--
-- user_id copies the exact column type of users.id so the foreign key always matches it.
-- Deleting an account deletes its tokens.

SET @users_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);
SET @migration_sql = CONCAT(
    'CREATE TABLE auth_tokens (
        id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id    ', @users_id_type, ' NOT NULL,
        selector   CHAR(24)     NOT NULL,
        token_hash CHAR(64)     NOT NULL,
        expires_at DATETIME     NOT NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_auth_tokens_selector (selector),
        KEY idx_auth_tokens_user (user_id),
        CONSTRAINT fk_auth_tokens_user
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
