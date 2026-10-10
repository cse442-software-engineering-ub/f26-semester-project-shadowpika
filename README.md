# Karavan Campus Exchange

CSE 442 campus marketplace. This repository contains the application source, tests,
documentation, and scripts used to create a deployment bundle.

## Where files belong

| Directory | Contents |
| --- | --- |
| `frontend/` | React app, HTML entry templates, styles, shared navigation, frontend tests |
| `frontend/src/features/listings/` | Create Listing UI |
| `frontend/settings/` | Account and password HTML/CSS entry pages |
| `frontend/public/assets/images/` and `icons/` | Static site images/icons |
| `frontend/public/uploads/` | Seed listing images; keep existing database image URLs |
| `backend/endpoints/` | PHP endpoints, with subpaths matching their deployed URLs |
| `backend/includes/` and `backend/listing/lib/` | Shared backend helpers |
| `backend/server/` | Apache configuration and upload-directory protection |
| `database/schema/`, `migrations/`, `seeds/` | SQL definitions, upgrades, and development seed scripts |
| `tests/backend/` | PHPUnit unit and direct-HTTP backend tests |
| `tests/api/` | PowerShell direct-API task tests |
| `tests/fixtures/` | Test images/documents, including admin-registration fixtures |
| `scripts/build/`, `local-dev/`, `verify/` | Release generation, local setup, release checks |
| `docs/` | Feature documentation and task-card notes |
| `deploy/` | Generated, ignored local release; upload its contents, never commit it |

Add source changes in the appropriate feature directory, not a personal project copy.
Do not hand-edit generated HTML or hashed assets in `deploy/`; change source and rebuild.
External page/API URLs have not been renamed: `home.html`, `product-search.html`,
`sell.html`, `api/search_listings.php`, `listing/api/image.php`, etc. still exist at
the application's deployed root.

## Frontend development and tests

Install Node.js compatible with `frontend/package-lock.json` (Node 22.12+ or 24+).
From `frontend/`:

```sh
npm ci
npm test
npm run lint
npm run dev
```

The frontend task tests mock API responses; they do not require a working backend.
Vite proxies PHP requests, including `/api/`, `/listing/api/`, and `/settings/`, to
`http://localhost:8000` without removing any URL prefix. Run PHP against `deploy/`,
not `backend/endpoints/`, because the release assembles endpoints and their helpers
into the expected web-server layout.

## Build and verify a release

After installing frontend dependencies, from the repository root:

```sh
node scripts/build/build-release.mjs
node scripts/verify/verify-release.mjs
node --test tests/release/verify-release.test.mjs
node --test tests/release/build-safety.test.mjs
```

PowerShell equivalent: `powershell -File .\scripts\build\build-release.ps1`.
The build runs Vite, copies PHP and server configuration from `backend/`, and writes
`deploy/release-manifest.json` with a SHA-256 digest for every managed application file.
It checks local references before updating the release. A rebuild refuses to overwrite
manually edited or conflicting unmanaged files, and removes only unchanged obsolete
files listed in the previous manifest. Runtime files/configuration are preserved.
`deploy/` is ignored by Git: commit only source, tests, documentation, and build scripts.

See [deployment instructions](docs/deployment.md) before uploading.

## Backend tests and local configuration

PHPUnit requires PHP 8.3+ for the locked PHPUnit 11 dependency, Composer, PDO/SQLite,
curl, fileinfo, mbstring, DOM/XML, and mysqli for the listing/search endpoints.

```sh
composer install
composer test
```

Build `deploy/` first. The HTTP tests start PHP with `deploy/` as its document root and
use a throwaway SQLite database; they do not use the frontend. Search and Create Listing
currently use MySQL/mysqli, so the SQLite test server is **not** a complete marketplace
backend. Run their direct-API scripts against a configured development server:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\api\condition_filter_api_test.ps1 -ProjectBaseUrl "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j"
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\api\price_filter_api_test.ps1 -ProjectBaseUrl "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j"
```

The create-listing/image scripts upload fixtures and create records: use a designated
test environment and follow their cleanup instructions, not a production database.
SQL scripts are not run automatically by the release build; review their prerequisites.

Server credentials go in `deploy/config.local.php` (copy the example in `backend/`) or
`KARAVAN_DB_HOST`, `KARAVAN_DB_NAME`, `KARAVAN_DB_USER`, `KARAVAN_DB_PASS` environment
variables. Listing APIs also accept the older `KARAVAN_DB_PASSWORD` name. Never commit
credentials, user uploads, sessions, or database contents.

## Team workflow

Work on the task's branch, test the source, build and verify a local release. Push that
branch and merge completed work into `dev` using a pull request. After merge, one person
should build and upload the contents of `deploy/`; do not mix teammates' bundles on the server.
For the current organization work, reuse card/branch #165 per the PM, keep it In Progress
while reviewing, and mention **organizing the repo** in the eventual commit message.
