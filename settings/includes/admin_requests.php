<?php
// Business logic for community-partner admin requests. Every function returns
// [httpStatus, responseBody] so the endpoints stay thin and PHPUnit can call these directly.

// Aptitude's PHP caps uploads at 2MB (upload_max_filesize) and ignores .user.ini/.htaccess overrides.
const KARAVAN_MAX_PROOF_BYTES = 2 * 1024 * 1024;

const KARAVAN_ALLOWED_PROOF_TYPES = [
    'pdf'  => ['application/pdf'],
    'jpg'  => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
    'png'  => ['image/png'],
];

const KARAVAN_FORBIDDEN_ERROR = 'You do not have permission to perform this action.';

function karavan_validate_proof_file(?array $file): ?string
{
    if ($file === null || !isset($file['error']) || is_array($file['error'])
        || $file['error'] === UPLOAD_ERR_NO_FILE) {
        return 'Proof of ownership is required.';
    }
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
        return 'File is too large. Maximum size is 2MB.';
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return 'File upload failed. Please try again.';
    }
    if (empty($file['tmp_name']) || !is_file($file['tmp_name'])) {
        return 'Proof of ownership is required.';
    }
    if (filesize($file['tmp_name']) === 0) {
        return 'The file is empty. Please choose a different file.';
    }

    $extension = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset(KARAVAN_ALLOWED_PROOF_TYPES[$extension])
        || !in_array($mime, KARAVAN_ALLOWED_PROOF_TYPES[$extension], true)) {
        return 'Invalid file type. Accepted formats: PDF, JPG, PNG.';
    }

    if (filesize($file['tmp_name']) > KARAVAN_MAX_PROOF_BYTES) {
        return 'File is too large. Maximum size is 2MB.';
    }

    return null;
}

/**
 * The id of the regular ('user') account that owns $email, null when no account does,
 * or false when it belongs to an admin or moderator, who can't apply again.
 * Accounts made before the email column existed only have their email in username.
 */
function karavan_regular_account_for_email(PDO $pdo, string $email): int|null|false
{
    $stmt = $pdo->prepare(
        'SELECT id, role FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
         ORDER BY LOWER(email) = LOWER(?) DESC, id ASC'
    );
    $stmt->execute([$email, $email, $email]);
    $matches = $stmt->fetchAll();
    foreach ($matches as $match) {
        if ($match['role'] !== 'user') {
            return false;
        }
    }
    return $matches ? (int) $matches[0]['id'] : null;
}

/**
 * @param callable $moveFile fn(string $from, string $to): bool — move_uploaded_file in production.
 */
function karavan_admin_register(PDO $pdo, array $post, array $files, string $uploadDir, callable $moveFile): array
{
    $file = $files['proof_of_ownership'] ?? null;
    $fileError = karavan_validate_proof_file($file);
    if ($fileError !== null) {
        return [400, ['success' => false, 'error' => $fileError]];
    }

    $fullName     = trim((string) ($post['full_name'] ?? ''));
    $businessName = trim((string) ($post['business_name'] ?? ''));
    $email        = trim((string) ($post['email'] ?? ''));
    $phone        = trim((string) ($post['phone'] ?? ''));
    // Trimmed to match login.php, which trims the password before password_verify().
    $password     = trim((string) ($post['password'] ?? ''));

    if ($fullName === '' || $businessName === '' || $email === '' || $phone === '' || $password === '') {
        return [400, ['success' => false, 'error' => 'Please fill in all fields.']];
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return [400, ['success' => false, 'error' => 'Please enter a valid email address.']];
    }
    // Approval copies the email into users.username, which is VARCHAR(50), and login.php caps input at 50.
    if (strlen($email) > 50) {
        return [400, ['success' => false, 'error' => 'Email must be 50 characters or fewer.']];
    }
    if (strlen($password) < 8) {
        return [400, ['success' => false, 'error' => 'Password must be at least 8 characters.']];
    }

    // A student with a regular account can apply with the same email; approval then promotes that account.
    $linkedUserId = karavan_regular_account_for_email($pdo, $email);
    if ($linkedUserId === false) {
        return [409, ['success' => false, 'error' => 'An account with this email already exists.']];
    }
    $existingRequest = $pdo->prepare('SELECT id FROM admin_requests WHERE LOWER(email) = LOWER(?)');
    $existingRequest->execute([$email]);
    if ($existingRequest->fetch()) {
        return [409, ['success' => false, 'error' => 'A request for this email is already pending review.']];
    }

    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0750, true) && !is_dir($uploadDir)) {
        return [500, ['success' => false, 'error' => 'Could not save the uploaded file.']];
    }
    // Aptitude ignores .htaccess, so a blank index file is what stops Apache listing the folder.
    $indexFile = rtrim($uploadDir, '/') . '/index.html';
    if (!is_file($indexFile)) {
        @file_put_contents($indexFile, '');
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $storedName = bin2hex(random_bytes(16)) . '.' . ($extension === 'jpeg' ? 'jpg' : $extension);
    $destination = rtrim($uploadDir, '/') . '/' . $storedName;

    if (!$moveFile($file['tmp_name'], $destination)) {
        return [500, ['success' => false, 'error' => 'Could not save the uploaded file.']];
    }

    // A new applicant's account is only created when a moderator approves the request.
    try {
        $insertRequest = $pdo->prepare(
            "INSERT INTO admin_requests
                (full_name, business_name, email, phone, password_hash, proof_file_name, proof_original_name, proof_mime_type, status, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)"
        );
        $insertRequest->execute([
            $fullName, $businessName, $email, $phone, password_hash($password, PASSWORD_BCRYPT),
            $storedName, basename($file['name']), $mime, $linkedUserId,
        ]);
        $requestId = (int) $pdo->lastInsertId();
    } catch (PDOException $e) {
        @unlink($destination);
        if ($e->getCode() == 23000) {
            return [409, ['success' => false, 'error' => 'A request for this email is already pending review.']];
        }
        return [500, ['success' => false, 'error' => 'Registration database failure.']];
    }

    return [201, ['success' => true, 'request_id' => $requestId, 'status' => 'pending']];
}

function karavan_find_user(PDO $pdo, ?int $userId): ?array
{
    if ($userId === null) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id, username, role FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: null;
}

// Role is re-read from the database on every request so promotions/demotions apply immediately.
function karavan_is_moderator(?array $user): bool
{
    return $user !== null && ($user['role'] ?? null) === 'moderator';
}

function karavan_forbidden(): array
{
    return [403, ['success' => false, 'error' => KARAVAN_FORBIDDEN_ERROR]];
}

function karavan_list_pending_requests(PDO $pdo, ?int $userId): array
{
    if (!karavan_is_moderator(karavan_find_user($pdo, $userId))) {
        return karavan_forbidden();
    }

    $stmt = $pdo->query(
        "SELECT id, full_name, business_name, email, phone, created_at
         FROM admin_requests
         WHERE status = 'pending'
         ORDER BY created_at ASC, id ASC"
    );

    $requests = [];
    foreach ($stmt->fetchAll() as $row) {
        $requests[] = [
            'request_id'             => (int) $row['id'],
            'full_name'              => $row['full_name'],
            'business_name'          => $row['business_name'],
            'email'                  => $row['email'],
            'phone'                  => $row['phone'],
            'status'                 => 'pending',
            'created_at'             => $row['created_at'],
            'proof_of_ownership_url' => 'proof_file.php?request_id=' . (int) $row['id'],
        ];
    }

    return [200, ['success' => true, 'requests' => $requests]];
}

// approve: promotes the linked regular account to 'admin', or creates a new admin users row
//          when the applicant had no account, and marks the request approved.
// deny:    deletes the request row and its uploaded document; no account is ever created.
function karavan_decide_request(PDO $pdo, ?int $userId, $input, string $uploadDir): array
{
    $moderator = karavan_find_user($pdo, $userId);
    if (!karavan_is_moderator($moderator)) {
        return karavan_forbidden();
    }

    $requestId = is_array($input) ? filter_var($input['request_id'] ?? null, FILTER_VALIDATE_INT) : false;
    $action = is_array($input) ? ($input['action'] ?? null) : null;
    if ($requestId === false || $requestId <= 0 || !in_array($action, ['approve', 'deny'], true)) {
        return [400, ['success' => false, 'error' => 'A valid request_id and action ("approve" or "deny") are required.']];
    }

    $newStatus = $action === 'approve' ? 'approved' : 'denied';

    

    try {
        $pdo->beginTransaction();

        $find = $pdo->prepare('SELECT id, email, password_hash, proof_file_name, status, user_id FROM admin_requests WHERE id = ?');
        $find->execute([$requestId]);
        $request = $find->fetch();

        if (!$request) {
            $pdo->rollBack();
            return [404, ['success' => false, 'error' => 'Request not found.']];
        }

        // The status guard in each WHERE clause stops two moderators from both deciding the same request.
        if ($newStatus === 'approved') {
            $update = $pdo->prepare(
                "UPDATE admin_requests
                 SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND status = 'pending'"
            );
            $update->execute([(int) $moderator['id'], $requestId]);
        } else {
            $update = $pdo->prepare("DELETE FROM admin_requests WHERE id = ? AND status = 'pending'");
            $update->execute([$requestId]);
        }

        if ($update->rowCount() === 0) {
            $pdo->rollBack();
            return [409, ['success' => false, 'error' => 'This request has already been reviewed.']];
        }

        if ($newStatus === 'approved') {
            $linkedUser = karavan_find_user($pdo, $request['user_id'] !== null ? (int) $request['user_id'] : null);
            if ($linkedUser === null) {
                // The applicant may have made a regular account after applying.
                $laterAccountId = karavan_regular_account_for_email($pdo, $request['email']);
                if ($laterAccountId === false) {
                    $pdo->rollBack();
                    return [409, ['success' => false, 'error' => 'An account with this email already exists.']];
                }
                $linkedUser = karavan_find_user($pdo, $laterAccountId);
            }

            if ($linkedUser !== null) {
                // The applicant keeps their existing login; a moderator is never demoted to admin.
                $promote = $pdo->prepare("UPDATE users SET role = 'admin' WHERE id = ? AND role = 'user'");
                $promote->execute([(int) $linkedUser['id']]);
                $link = $pdo->prepare('UPDATE admin_requests SET user_id = ? WHERE id = ?');
                $link->execute([(int) $linkedUser['id'], $requestId]);
            } else {
                // login.php looks accounts up by email, so the applicant's email fills both columns.
                $createUser = $pdo->prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')");
                $createUser->execute([$request['email'], $request['email'], $request['password_hash']]);
                $link = $pdo->prepare('UPDATE admin_requests SET user_id = ? WHERE id = ?');
                $link->execute([(int) $pdo->lastInsertId(), $requestId]);
            }
        }

        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($e->getCode() == 23000) {
            return [409, ['success' => false, 'error' => 'An account with this email already exists.']];
        }
        return [500, ['success' => false, 'error' => 'Could not update the request.']];
    }

    if ($newStatus === 'denied') {
        @unlink(rtrim($uploadDir, '/') . '/' . basename($request['proof_file_name']));
    }

    return [200, ['success' => true, 'request_id' => $requestId, 'status' => $newStatus]];
}

/** Returns [status, body] on failure or [200, ['path' => ..., 'mime' => ..., 'name' => ...]] on success. */
function karavan_locate_proof_file(PDO $pdo, ?int $userId, $requestId, string $uploadDir): array
{
    if (!karavan_is_moderator(karavan_find_user($pdo, $userId))) {
        return karavan_forbidden();
    }
    function karavan_is_admin(?array $user): bool
    {
        return $user !== null && ($user['role'] ?? null) === 'admin';
    }

    $requestId = filter_var($requestId, FILTER_VALIDATE_INT);
    if ($requestId === false || $requestId <= 0) {
        return [400, ['success' => false, 'error' => 'A valid request_id is required.']];
    }

    $stmt = $pdo->prepare('SELECT proof_file_name, proof_original_name, proof_mime_type FROM admin_requests WHERE id = ?');
    $stmt->execute([$requestId]);
    $row = $stmt->fetch();

    $path = $row ? rtrim($uploadDir, '/') . '/' . basename($row['proof_file_name']) : null;
    if (!$row || !is_file($path)) {
        return [404, ['success' => false, 'error' => 'File not found.']];
    }

    return [200, ['path' => $path, 'mime' => $row['proof_mime_type'], 'name' => $row['proof_original_name']]];
}
