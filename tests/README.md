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

## #231 listing freeze frontend

In `frontend/`, run `npm test -- src/__tests__/ListingFreeze.test.jsx
src/__tests__/ManageListings.test.jsx src/__tests__/MeetingRequests.test.jsx`.
These use API mocks and cover confirmation/dismissal, metadata compatibility,
duplicate clicks, stale polling, failure recovery, individual resume and the
disabled meeting location's keyboard behavior/saved JSON ID. See
`docs/listing-freeze.md` for the frontend/backend contract. Native dialog focus
and responsive layout also require browser inspection; jsdom supplies only a
minimal dialog API for the unit tests.

## #232 listing freeze regression

`php tests/mysql/listing_freeze_test.php` uses a disposable loopback MySQL server
selected by `KARAVAN_FREEZE_TEST_DSN=mysql:host=127.0.0.1;port=YOUR_LOCAL_TEST_PORT`
(no database in the DSN). It creates/cleans a random database and user, tests real
HTTP/PDO/mysqli reads and writes, forces both orders of approval/location-accept/
creation versus freezing, and verifies transaction rollback. PHP needs PDO MySQL,
mysqli and curl. Never target Aptitude/Cattle. See `docs/listing-freeze.md` for the
API, local-build override and read-only live fixture check. `ListingFreezeTest`
provides deterministic SQLite business-rule tests, not proof of InnoDB locking.

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
