<?php
// Business logic for community-partner admin requests. Every function returns
// [httpStatus, responseBody] so the endpoints stay thin and PHPUnit can call these directly.

const KARAVAN_MAX_PROOF_BYTES = 10 * 1024 * 1024;

const KARAVAN_ALLOWED_PROOF_TYPES = [
    'pdf'  => ['application/pdf'],
    'jpg'  => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
    'png'  => ['image/png'],
];

function karavan_validate_proof_file(?array $file): ?string
{
    if ($file === null || !isset($file['error']) || is_array($file['error'])
        || $file['error'] === UPLOAD_ERR_NO_FILE) {
        return 'Proof of ownership is required.';
    }
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
        return 'File is too large. Maximum size is 10MB.';
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return 'File upload failed. Please try again.';
    }
    if (empty($file['tmp_name']) || !is_file($file['tmp_name'])) {
        return 'Proof of ownership is required.';
    }

    $extension = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset(KARAVAN_ALLOWED_PROOF_TYPES[$extension])
        || !in_array($mime, KARAVAN_ALLOWED_PROOF_TYPES[$extension], true)) {
        return 'Invalid file type. Accepted formats: PDF, JPG, PNG.';
    }

    if (filesize($file['tmp_name']) > KARAVAN_MAX_PROOF_BYTES) {
        return 'File is too large. Maximum size is 10MB.';
    }

    return null;
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
    // Approval copies the email into users.username, which is VARCHAR(50).
    if (strlen($email) > 50) {
        return [400, ['success' => false, 'error' => 'Email must be 50 characters or fewer.']];
    }
    if (strlen($password) < 8) {
        return [400, ['success' => false, 'error' => 'Password must be at least 8 characters.']];
    }

    $existing = $pdo->prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)');
    $existing->execute([$email]);
    if ($existing->fetch()) {
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

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $storedName = bin2hex(random_bytes(16)) . '.' . ($extension === 'jpeg' ? 'jpg' : $extension);
    $destination = rtrim($uploadDir, '/') . '/' . $storedName;

    if (!$moveFile($file['tmp_name'], $destination)) {
        return [500, ['success' => false, 'error' => 'Could not save the uploaded file.']];
    }

    // No users row yet: the account is only created when a moderator approves the request.
    try {
        $insertRequest = $pdo->prepare(
            "INSERT INTO admin_requests
                (full_name, business_name, email, phone, password_hash, proof_file_name, proof_original_name, proof_mime_type, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
        );
        $insertRequest->execute([
            $fullName, $businessName, $email, $phone, password_hash($password, PASSWORD_BCRYPT),
            $storedName, basename($file['name']), $mime,
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
