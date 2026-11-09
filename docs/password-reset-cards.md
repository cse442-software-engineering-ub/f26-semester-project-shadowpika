# Revised cards #40 / #106 / #107

## Review of the copied originals (2026-11-09)

The original design delivered an email link and reset-token form. Shared dev has
neither of those endpoints/pages. Settings instead changes a password by asking
for the old password. The new assignment requires a security answer and one
shared reset flow. The old tests therefore cannot establish acceptance.

Keep these goals: password confirmation, failed-request feedback, responsive
layout, hashing, rejection of unauthorized changes, and one-time reset authority.
Rewrite the steps: remove inbox dependencies, unknown expiry waits, invented
password_resets schema, shared mutable credentials and Test 1 → Test 3 coupling.
Providing identical mocked responses only proves identical UI rendering; it does
not establish account-enumeration protection. Chrome response overrides also do
not by themselves prove an HTTP error status. Verify hashes with password_verify,
not a hardcoded algorithm prefix. No previous numeric grading breakdown was
provided, so these are observed defects, not invented explanations of lost marks.

## #40 — User Story

As a student who forgot my password, I want to reset it, which is confirmed by
answering a security question and being able to set a new password.

### Test setup

Use https://cattle.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/ after #106 and #107
and their database migration are deployed. Each test uses a fresh ordinary student
account. For each run choose a new suffix in the username/email, for example
`reset40a1109` / `reset40a1109@example.com`; do not reuse a teammate's account.
Use initial password `Before123!`, question **What was the name of your first pet?**
and answer `MiLo`. In each test register that account using **Sign up**, fill all
fields, select the question, enter the answer and select **Sign Up**. Confirm the
registration succeeds and the login page returns. Never reuse another test's reset.
Log out at the end of each test and verify Email, Password and Log In appear.

### Happy Test 1 — Reset from Forgot Password

1. Complete this test's fresh-account registration above.
2. On Log In select **Forgot Password**, enter this test's email and select **Continue**.
3. Verify the saved security question appears. Enter `mILO` and select **Verify answer**.
4. Verify New password and Confirm password appear. Enter `After123!` in both and select **Reset Password**.
5. Verify the password-reset confirmation and select **Back to Log In**.
6. Enter the email and `Before123!`; select Log In and verify login is rejected.
7. Enter the same email and `After123!`; select Log In and verify Home opens. Log out.

### Happy Test 2 — Reset from Settings

1. Register a separate fresh account using the setup, then log in with its email and `Before123!`.
2. Open Settings and **Account Settings**, then select **Reset Password**. On mobile use the navigation menu first.
3. Verify the same Reset Password page, Email and Continue appear; a new password cannot be entered yet.
4. Enter this account's email, continue, answer `milo` and verify the answer.
5. Enter `Settings123!` in both password fields and select Reset Password.
6. Return to Log In. Verify `Before123!` is rejected and `Settings123!` opens Home. Log out.

### Alt Test 1 — Incorrect answer does not change the password

1. Register a separate fresh account using the setup.
2. Open Forgot Password, enter its email and continue. Answer `WrongAnswer` and select Verify answer.
3. Verify an incorrect-answer message appears and new password fields are absent.
4. Return to Log In. Verify the original `Before123!` still opens Home. Log out.

### Alt Test 2 — Password confirmation and restart

1. Register a separate fresh account using the setup; open Forgot Password and continue with its email.
2. Answer `MILO` correctly. Enter `First123!` and `Different123!` in the two password fields.
3. Select Reset Password. Verify **Passwords do not match.** and that no success is reported.
4. Select **Start over**. Verify Email is shown and password fields disappear.
5. Return to Log In; verify `Before123!` still works. Log out.

### Alt Test 3 — Unknown email

1. Open Cattle logged out; choose a newly generated email that has never been registered.
2. Select Forgot Password, enter that email and Continue.
3. Verify an account-not-found message, no security question and no password fields. Return to Log In.

### Alt Test 4 — Legacy account without a security answer

1. Use a designated team-prepared legacy test account confirmed to have no security answer; record its email in the test-run sheet before testing.
2. Logged out, open Forgot Password, enter that email and Continue.
3. Verify **This account has no security answer and cannot reset its password.** and no password fields.
4. Return to Log In and confirm its existing password still works. Log out. If no designated legacy fixture exists, record this case as blocked rather than guessing an account.

## #106 — Frontend: Security Question Registration and Password Reset

### Independent test environment

Use Aptitude: https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/.
Automated tests intercept fetch entirely and require no backend/account. From
`frontend`, run `node node_modules/vitest/vitest.mjs run src/__tests__/PasswordReset.test.jsx src/__tests__/RegistrationSecurity.test.jsx`.
For manual checks open Chrome DevTools → Network → Fetch/XHR. To override a body,
right-click that exact request → Override content, select an empty local folder,
allow access, paste the complete JSON, save, reload and repeat the action. If an
endpoint is not deployed, use the automated suite; do not claim an unavailable URL
was overridden successfully. Remove all overrides after each manual test.

Mock bodies (body-only overrides test UI messages, not real HTTP status handling):

```json
{"success":true,"question_id":0,"question":"What was the name of your first pet?"}
```
```json
{"success":true}
```
```json
{"success":false,"error":"Incorrect security answer."}
```
```json
{"success":false,"code":"restart_required","error":"Your reset session has expired. Start again."}
```

### Test 1 — Registration and both entry links

1. Start logged out on Aptitude. Open Sign up; verify a required Security question selector and Security answer input.
2. Leave either empty and select Sign Up; verify no registration request. Fill a unique username/email, `Before123!` twice, question 0 and `MiLo`.
3. Inspect the register.php request: username/email/password plus `security_question:0` and `security_answer:"MiLo"`. Use mocked success to verify the login destination.
4. On login inspect Forgot Password's destination. With an independent mocked signed-in session, open Account Settings and inspect Reset Password's destination. Both resolve to the same root reset-password.html.
5. Run RegistrationSecurity.test.jsx for the independent assertions; discard mock state/overrides.

### Test 2 — Three-step form and request contract

1. Open Aptitude reset-password.html in a fresh tab. Override forgot_password.php with the question body, verify_security_answer.php with success, and reset_password.php with success from the examples above.
2. Enter `reset@example.com`, Continue; verify the saved question and Security answer, with no password fields.
3. Enter `MiLo`, Verify answer; verify new/confirmation password fields.
4. Enter `After123!` twice and Reset Password; verify success and Back to Log In.
5. Network requests are JSON POST, same-origin credentials, in order: forgot `{ "email":"reset@example.com" }`, verify `{ "answer":"MiLo" }`, reset `{ "password":"After123!" }`. No caller-supplied account ID is sent. Remove overrides.

### Test 3 — Incorrect answer and mismatched passwords

1. Start reset-password.html fresh with the mocked question response and incorrect-answer body.
2. Continue with an email, submit an answer; verify the message and no password fields.
3. Replace verify response with success; submit an answer again, enter different new and confirmation passwords and submit.
4. Verify **Passwords do not match.**, no reset_password.php request and no success. Remove overrides.

### Test 4 — Network failure, expired flow and repeated clicks

1. Run PasswordReset.test.jsx independently from frontend using the command above.
2. Verify the pending-request case sends exactly one lookup on a double click and disables submission.
3. Verify a thrown network error keeps the form retryable; the restart_required case returns to Email and clears later steps.
4. Verify Start over hides question/password fields. The suite supplies pending promises and failure responses directly; no server timing is required.

### Test 5 — Phone and keyboard

1. Open Aptitude reset-password.html at 390 × 844 with the question/success overrides from Test 2.
2. Complete all three steps using Tab, Shift+Tab and Enter. Verify labels, focused controls, visible errors and no horizontal page scrolling.
3. Verify Back to Log In and Start over can be activated by keyboard. Restore viewport and remove overrides.

## #107 — Backend: Security Question Password Reset

### Independent setup and cleanup

Use only direct Aptitude requests at
`https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/` with
`Content-Type: application/json`. Each test creates its own uniquely named account
through POST register.php using username/email suffixes and this body shape:
`{"username":"reset107_UNIQUE","email":"reset107_UNIQUE@example.com","password":"Before123!","security_question":0,"security_answer":"MiLo"}`.
Use a fresh Postman cookie jar for each test/session; keep session cookies across
the steps within a single test. POST logout.php and clear that jar afterward.
Only use dedicated disposable accounts; never mutate shared grading users.
The automated backend suite creates and removes isolated database fixtures.

### Test 1 — Registration requires a valid question and hashed answer

1. POST a unique registration with the body above; expect 200 and success true.
2. With a separate unique email each time, repeat with missing answer, whitespace-only answer or question 99; expect success false and no new account.
3. Run PasswordResetTest plus PasswordResetHttpTest to verify stored answers/passwords using password_verify and that no response includes either hash. Log out/clear cookies.

### Test 2 — Case-insensitive reset and password persistence

1. Register this test's fresh account. POST forgot_password.php with its email; expect 200 and the exact question-success JSON above.
2. POST verify_security_answer.php with `{"answer":"  mILO  "}`; expect 200 / `{"success":true}`.
3. POST reset_password.php with `{"password":"After123!"}`; expect 200 / success true and the reset confirmation.
4. Directly POST login.php with this email and Before123!: success false. Repeat with After123!: success true.
5. Log out and clear cookies.

### Test 3 — Wrong answer and direct reset bypass

1. Register a fresh account. Before any lookup POST reset_password.php with `{"password":"Bad123!"}`; expect 410 / restart_required.
2. POST forgot_password.php for this account, then reset_password.php without verifying: 410 / restart_required.
3. Start a fresh lookup, POST verify_security_answer.php with `{"answer":"wrong"}`: 403 / success false.
4. Direct login with Before123! still succeeds. Log out/clear cookies.

### Test 4 — Cross-session and cross-account isolation, one-time use

1. Register separate A/B accounts and use two isolated cookie jars.
2. Jar A: lookup A and verify MiLo. Jar B: POST reset without verification; expect 410.
3. Jar A: start a lookup for B, then POST reset without answering B; expect 410. A's old verification must not carry across.
4. Start A's lookup again, verify, reset successfully; repeat reset immediately and expect 410. Verify A's first new password still logs in; B's password remains unchanged. Log out both jars.

### Test 5 — Unknown, legacy and ambiguous accounts

1. In a fresh jar POST forgot_password.php with a unique unregistered email; expect 422 and success false.
2. Use independent automated fixtures for no-answer and duplicate-email accounts. Expect 422 for no answer and 409 for ambiguity; no account is selected and passwords remain unchanged.
3. Run the backend unit/HTTP suite for these fixture cases; it must not add duplicate or legacy users to Aptitude. Clear cookies.

### Test 6 — Expiry, retries, malformed inputs and methods

1. Run PasswordResetTest with an injected clock: ten-minute expiry must reject verification/reset without sleeping.
2. Five wrong answers consume the challenge; a later correct answer requires a new lookup.
3. Directly request each reset endpoint with GET: expect 405; POST malformed JSON, arrays as strings, missing fields and overlong values: expect 400.
4. Verify stale verified grants from a second session fail after another session changes the password. No failing case changes password storage.

### Automated commands

Build the release, then run `php vendor/bin/phpunit --filter PasswordReset`.
The HTTP suite uses a throwaway SQLite DB and built PHP endpoints. Run the
security migration checks separately against isolated MySQL, including rerun and
existing-row preservation. Online manual acceptance remains pending deployment.
