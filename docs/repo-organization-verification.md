# Organization verification — 2026-10-09

Baseline: latest `origin/dev` (`3d9a1a5`) merged into branch
`165-frontend-add-price-range-filtering`. The user retains all Git
branch/commit/push/merge and WinSCP deployment operations. Nothing was uploaded to a
course server by these checks.

## Implemented

- Source is separated into frontend, backend, database, tests, scripts, and docs.
- The generated `deploy/` bundle is ignored by Git. It is reproduced locally by the
  release build and uploaded with WinSCP after review.
- Latest `dev` work was retained in the organized source, including persistent login,
  responsive navigation, community leaving, account/admin settings, and Manage Listings.
- Old root wrappers, hashed assets, duplicated PHP includes, personal project copies,
  and generated settings pages are not source files.
- Existing public page/API URLs remain compatible through the generated release layout
  and lightweight redirects for older nested settings URLs.
- Server credentials, user uploads, sessions, dependencies, caches, and generated
  deployment files remain outside Git.

## Evidence

- Frontend: 12 test files and 155 tests passed.
- Production frontend build completed successfully with 80 transformed modules.
- Lint completed with warnings only and no errors. The warnings are in existing or
  newly merged App, navigation, and Manage Listings code.
- Release verifier: 4 tests passed for links/hashes, tampering, a missing image, and
  unsafe manifest traversal.
- Build safety: 2 tests passed for deterministic rebuilding, preservation of an
  unmanaged runtime file, and refusal to overwrite a manually edited release page.
- The assembled local deployment contains 109 manifest-managed files and passed its
  local-reference and SHA-256 checks.
- PHP syntax and PHPUnit could not be rerun in this Codex environment because a PHP
  executable is not installed. They remain required before deployment.

## Review before release

- The missing Manage Listings endpoints were recovered from the server copy and
  rewritten to use the repository's database configuration and authenticated user.
  Updates, status changes, and deletion are restricted to listings owned by that user.
  Their PHP and MySQL behavior still requires server-side verification before release.
- MySQL filtering/Create Listing APIs still need verification with the server
  configuration. The local release verifier is not a MySQL integration test.
- Real session-cookie expiry and Cattle/Aptitude behavior require server testing.
- Preserve server-only secrets, user uploads, sessions, and database contents when
  replacing the live application files.
- PM/card review and actual server/UI acceptance remain required. Keep #165 In Progress
  until the reorganized source and deployment are reviewed.

Old generated wrappers/assets remain recoverable from Git history and the local backup
at `D:\Download\CSE 442\repo-organization-backup-5f7daaf`; they are not duplicated in
the organized source tree.

The [Sprint 2 rubric](https://webdev.cse.buffalo.edu/cse404/442rubric2/) requires clear
directory organization. Per the PM's feedback, generated deployment copies are not
tracked when the same files are reproducible from source.
