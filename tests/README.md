# Test ownership

- Frontend: `frontend/src/__tests__/`; `npm test` in `frontend/`. Mock API responses;
  test UI interaction, validation, and request contracts independently of PHP.
- Backend: `tests/backend/`; `composer test` after building `deploy/`. Unit and HTTP
  tests use temporary SQLite data and run without a frontend.
- Direct APIs: `tests/api/*.ps1`; specify the Aptitude project base URL. The image test's
  `-BaseUrl` is the listing base (`.../cse-442j/listing`), whereas filtering/create-listing
  scripts take `-ProjectBaseUrl` (`.../cse-442j`). Read each script's parameters first.
- Fixtures: `tests/fixtures/`; choose these files locally when manual task tests need
  documents/images. Fixtures are not published to the web server by the release build.
- Release: `node scripts/verify/verify-release.mjs`; checks generated routes, local
  assets/imports, endpoint includes, unsafe configuration, and manifest hashes.
  `node --test tests/release/verify-release.test.mjs` checks that overwritten files,
  broken image paths, Profile placeholders, and unsafe manifests are rejected.
  `node --test tests/release/build-safety.test.mjs` verifies deterministic rebuilding,
  runtime preservation, and refusal to overwrite manual release edits. Run these build
  checks when no other process is editing/building `deploy/`.

User-story acceptance tests exercise the integrated UI on Cattle from an ordinary
user's perspective. Frontend/backend task tests use Aptitude and must not rely on the
other layer being correct. This migration does not rewrite the outstanding task cards.

## #175 listing access regression

Build `deploy/`, then run `php tests/mysql/listing_access_test.php` with
`KARAVAN_LISTING_TEST_DSN=mysql:host=127.0.0.1;port=33331` pointing to a disposable
local MySQL server. It requires root with an empty password on that isolated
server, PDO MySQL, mysqli, curl and permission to start a local PHP HTTP server.
Never point it at Aptitude/Cattle. The script only accepts a loopback DSN and
allocates a randomly named database and temporary database user.

The test sends real HTTP requests through the built create-listing endpoint.
Anonymous/deleted users and expired tokens receive 401; nonmembers and pending
join applicants receive 403 without new listings. Campus membership, joined
members with shopping disabled, approved partner administrators, community-name
aliases and valid remember-me login retain publishing access. It also checks
trusted owner/location values and existing method/body/location validation.
Its temporary database, user, image, HTTP server and sessions are removed afterward.

## Sprint 3 Task fixture reproducibility

The fixture SQL and setup instructions live in
`database/seeds/sprint3_task_fixtures.sql` and
`database/seeds/README_sprint3_tasks.md`. On a disposable loopback MySQL server,
set `KARAVAN_FIXTURE_TEST_DSN=mysql:host=127.0.0.1;port=33331`, then run
`php tests/mysql/sprint3_task_fixtures_test.php`. It uses synthetic accounts and
randomly named temporary databases, never the live Aptitude/Cattle records.
