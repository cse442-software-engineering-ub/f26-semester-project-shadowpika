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
