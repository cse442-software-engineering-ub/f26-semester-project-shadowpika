-- Run once against cse442_2026_fall_team_j_db (e.g. in phpMyAdmin's SQL tab), after 001 and 002.
-- Each approved community partner's business is a joinable community, identified by its
-- admin_requests.id. A user joins at most one; joining another replaces it.
-- If the partner's request row is ever deleted, members simply go back to no community.

ALTER TABLE users
    ADD COLUMN community_id INT UNSIGNED NULL,
    ADD CONSTRAINT fk_users_community
        FOREIGN KEY (community_id) REFERENCES admin_requests (id) ON DELETE SET NULL;
