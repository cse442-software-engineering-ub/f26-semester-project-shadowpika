# Organization verification — 2026-10-08

Baseline: `5f7daaf`, branch `165-frontend-add-price-range-filtering`. The user retains
all Git branch/commit/push/merge and WinSCP deployment operations. Nothing has been
uploaded to a course server by these checks.

## Implemented

- Source separated into frontend, backend, database, tests, scripts, and docs.
- Generated release is tracked under `deploy/`; old root wrappers and stale bundles
  are replaced by one reproducible build and manifest.
- Existing root page/API routes and seed image URLs remain compatible.
- Profile preserves its existing handwritten page instead of the React placeholder.
- Account/password/general settings remain available alongside React admin locations.
- Shared navigation replaces fixed historical navbar bundles and duplicated wrapper
  logout injection, including desktop/mobile controls and the existing POST contract.
- Search, listing, and item-details connections use server configuration rather than
  embedded database credentials. Check that configuration before deployment.

## Evidence

- Frontend: 130 tests pass with the existing npm lockfile; lint has only preexisting
  warnings in App/NavBar.
- PHP: 84 syntax checks passed, including source, release, and test files.
- Backend: 162 tests / 493 assertions passed against the assembled `deploy/`
  layout, including configuration-alias regressions.
- Release verifier: 5 tests pass, including tampering, broken-image, placeholder,
  and unsafe-manifest detection. All 100 managed release files passed reference/hash
  checks; rebuilding twice produced identical manifests.
- Build safety: 2 tests pass for deterministic rebuilding, unmanaged runtime-file
  preservation, and refusal to overwrite a manually edited release page.
- All six PowerShell build/API scripts parsed successfully; `git diff --check` passed.
- Headless Chrome: ten desktop pages loaded below a simulated course subdirectory
  without local 404s or JavaScript exceptions. Four mobile navigation paths and logout
  were exercised. APIs were mocked: this is not live integrated acceptance testing.
- Screenshots and the one-time smoke runner are outside the repo at
  `D:\Download\CSE 442\repo-organization-qa` and
  `D:\Download\CSE 442\karavan-release-smoke.mjs`.

## Review before release

- MySQL filtering/Create Listing APIs still need verification with the new server
  configuration. The SQLite PHPUnit suite is not a MySQL filtering test.
- Real session-cookie expiry and Cattle integration have not been verified; existing
  login/logout cookie domain settings target Aptitude.
- Legacy Profile and static Account Settings still overflow at 390px. Their navigation
  can be exercised, but they are not certified responsive by this smoke test.
- npm audit reports one preexisting high-severity development dependency advisory
  in `source-map-js` (`GHSA-68fv-2mgg-jv7q`). No dependency upgrade/audit fix is included.
- Check for newer legitimate server-only teammate changes before replacing a live
  release. Preserve secrets, user uploads, sessions, and database contents.
- PM/card review and actual server/UI acceptance remain required. Keep #165 In Progress
  while reviewing; do not treat these local checks as authorization to merge/deploy.

Old generated wrappers/assets are recoverable in the local backup:
`D:\Download\CSE 442\repo-organization-backup-5f7daaf`.

The [Sprint 2 rubric](https://webdev.cse.buffalo.edu/cse404/442rubric2/) requires clear
directory organization and release files in the repo but does not prescribe this
specific layout. An unmerged development branch is an appropriate review stage, not
by itself the finished rubric release.
