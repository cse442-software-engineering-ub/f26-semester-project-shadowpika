# Password reset — cards #40 / #106 / #107

One security question is required for new student registrations. Keep the existing
q2/q3 columns untouched. Existing accounts without q1 and its answer cannot reset.
No email delivery or inbox is involved.

## Questions and normalization

Use stable zero-based question IDs: 0 = What was the name of your first pet?,
1 = In what city were you born?, 2 = What was the name of your elementary school?
No question catalog currently exists in shared dev. These IDs must not be reordered.
Answer normalization is UTF-8 lowercase after trimming surrounding whitespace;
answers must contain 1–100 characters. Store only password_hash(normalized answer).
Use the existing 1–50-byte, trimmed password convention from registration/login.

## Requests (JSON POST, same-origin cookies)

| Endpoint | Body | Success |
| --- | --- | --- |
| register.php | username, email, password, security_question (integer), security_answer | existing success response |
| forgot_password.php | email | 200: `{"success":true,"question_id":0,"question":"What was the name of your first pet?"}` |
| verify_security_answer.php | answer | 200: `{"success":true}` |
| reset_password.php | password | 200: `{"success":true,"message":"Your password has been reset. Please log in."}` |

The server binds the account to the PHP session, never to a client-supplied user ID.
Question and verified grant expire after ten minutes from starting the flow.
Starting another lookup clears previous verification, including a failed lookup.
Five wrong answers consume the challenge. A reset succeeds once only. A database
compare-and-swap against the password hash captured at verification also rejects
stale grants from other sessions. Revoke remembered-login tokens on success.

Errors use `{"success":false,"error":"..."}` and an optional stable `code`:
400 invalid input; 403 incorrect answer; 409 ambiguous account; 410 missing,
expired or consumed challenge/grant; 422 account not found or no configured answer;
405 wrong method; 500 server failure. `code: "restart_required"` returns the UI to
email entry. Responses must never include answers, answer hashes or password hashes.
Registration's existing legacy error response contract stays compatible.

Both Login → Forgot Password and Settings → Reset Password link to
`reset-password.html`. Settings does not skip answer verification. On success,
clear this browser's login session and return to the login page explicitly.

## Verification boundaries

Frontend tests use fetch mocks and assert outgoing JSON, form state, errors and
loading. They do not prove password storage. Backend tests use direct HTTP and
isolated databases without the frontend. Story tests run complete UI flows on
Cattle only after both PRs and the schema migration are deployed.
