# No-security-answer fixture precondition (#40 / #107)

The existing ordinary seller `jia.seller@test.com` is the exact input for the
no-answer cases on Aptitude and Cattle. The user confirmed on November 10 that
neither account has a configured security answer. The two servers have separate
databases and user IDs; the check uses the email, not a hardcoded ID.

In phpMyAdmin, select the intended application's database and run
`tests/fixtures/password-reset/check_no_answer_account.sql` during team
preparation. It requires exactly one matching ordinary account and NULL question
and answer-hash fields. It reports READY or BLOCKED without exposing any hashes.
Its identity match follows the reset endpoint's email-or-username lookup.

This is a read-only check, not a seed or reset script. It does not create accounts,
set passwords, clear answers, change membership or delete data. If the check is
blocked, resolve the test-data precondition with the team; do not silently erase
the shared seller's recovery data. The acceptance test itself uses a single fixed
email and expected visible message, with no database action by the evaluator.

All jia.reset registration cases delete only the account they created after their
assertions. Story/frontend cases use Settings -> Delete account, then verify the
deleted identity no longer logs in. Direct backend cases use settings/delete.php
with the case's exact current_username/password and verify a later lookup returns
the unknown-account result. Never target the shared seller, buyer or outsider.
