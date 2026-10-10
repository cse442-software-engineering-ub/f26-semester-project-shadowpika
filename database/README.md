# Database scripts

- `schema/listings.sql`: listing table creation and compatibility upgrades.
- `schema/meeting_requests.sql`: production meeting-request table without test fixtures.
- `migrations/`: account/admin/community/location/item/meeting upgrades.
- `seeds/listings.sql`: original listing schema plus development seed rows (combined
  script retained to avoid changing database behavior during directory organization).

Review dependencies and existing tables before executing. Some migrations include
development seed rows and others are not idempotent. Do not run every file alphabetically
or reset a shared database as part of deployment. The build never executes SQL.

## Legacy Cattle bootstrap

The original Cattle database may contain only the legacy `users` table. Export a SQL
backup first, then run these files in order:

1. `migrations/000_users_email.sql`
2. `migrations/001_admin_requests.sql`
3. `migrations/002_approved_locations.sql`
4. `migrations/003_user_communities.sql`
5. Check for duplicate non-NULL email addresses, then run
   `migrations/004_unique_user_email.sql`.
6. `migrations/005_auth_tokens.sql`
7. `schema/listings.sql`
8. `schema/meeting_requests.sql`

For the isolated Cattle QA environment, `seeds/listings.sql` may then be run to add the
search/filter fixtures without replacing existing rows. `migrations/item_details.sql`
may be run afterward when the item-details card fixtures are required.

Do not run `migrations/meeting_requests.sql` as a production schema migration: it also
resets task-card data for a specific test account. The schema-only equivalent is
`schema/meeting_requests.sql`.
