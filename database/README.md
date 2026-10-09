# Database scripts

- `schema/listings.sql`: listing table creation and compatibility upgrades.
- `migrations/`: account/admin/community/location/item/meeting upgrades.
- `seeds/listings.sql`: original listing schema plus development seed rows (combined
  script retained to avoid changing database behavior during directory organization).

Review dependencies and existing tables before executing. Some migrations include
development seed rows and others are not idempotent. Do not run every file alphabetically
or reset a shared database as part of deployment. The build never executes SQL.
