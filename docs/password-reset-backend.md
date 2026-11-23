# Card 107 backend deployment

Deploy with card 106. Apply `database/migrations/015_security_question_reset.sql`
on the intended application database first; it only adds missing q1 columns and
preserves existing rows and q2/q3. The shared contract and rewritten cards are in
card 106's `docs/password-reset-contract.md` and `docs/password-reset-cards.md`.

New answer hashes have a `sha256:` format prefix followed by bcrypt of SHA-256
of the normalized answer. This avoids bcrypt truncation for long UTF-8 answers.
Existing direct password_hash answer values are also verified for compatibility.
Answer hashes never leave the server. The implementation does not add email reset
links or enrollment for legacy users without a configured answer.

Build release, then `php vendor/bin/phpunit --filter PasswordReset`.
Run `tests/mysql/password_reset_test.php` with `KARAVAN_RESET_TEST_DSN` set to
`mysql:host=127.0.0.1;port=33341` only on a disposable local MySQL installation.
It creates/removes a random database; verifies migration reruns/data preservation,
case-insensitive reset, transactional stale-grant rejection and hash compatibility.

## Local validation (2026-11-09)

- PasswordReset unit/HTTP: 11 tests, 74 assertions passed.
- Isolated MySQL: 15 migration/data/reset checks passed.
- Combined card 106 build + card 107 endpoints: 12 direct-HTTP/static-entry checks
  passed; desktop and 390px initial reset page inspected. This is not Cattle UI acceptance.
- Full PHP regression: 283 tests, 1203 assertions, with three ConfigTest errors
  caused by the existing duplicate KARAVAN_NOT_LOGGED_IN_ERROR constant and two
  existing moderator HTTP failures that query username instead of the generated
  username/email relation. All five reproduced on an unmodified archive of dev
  eea5052. They are not counted as passes and are outside card 107.
