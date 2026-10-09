<?php
namespace Karavan\Tests\Unit;

use Karavan\Tests\Support\Fixtures;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

final class AdminRegisterTest extends TestCase
{
    private PDO $pdo;
    private string $tmpDir;
    private string $uploadDir;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->tmpDir = Fixtures::tempDir('karavan_tmp_');
        $this->uploadDir = $this->tmpDir . '/uploads';
    }

    protected function tearDown(): void
    {
        Fixtures::removeDir($this->tmpDir);
    }

    private function validPost(array $overrides = []): array
    {
        return array_merge([
            'full_name'     => 'Chun Admin',
            'business_name' => 'Test business',
            'email'         => 'chun.admin@test.com',
            'phone'         => '123-456-7890',
            'password'      => 'Admin123!',
        ], $overrides);
    }

    private function register(array $post, array $files): array
    {
        return karavan_admin_register($this->pdo, $post, $files, $this->uploadDir, 'rename');
    }

    public function testRejectsMissingFile(): void
    {
        [$status, $body] = $this->register($this->validPost(), []);

        $this->assertSame(400, $status);
        $this->assertSame(['success' => false, 'error' => 'Proof of ownership is required.'], $body);
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM admin_requests')->fetchColumn());
    }

    public function testRejectsEmptyFileField(): void
    {
        $files = ['proof_of_ownership' => ['name' => '', 'type' => '', 'tmp_name' => '', 'error' => UPLOAD_ERR_NO_FILE, 'size' => 0]];

        [$status, $body] = $this->register($this->validPost(), $files);

        $this->assertSame(400, $status);
        $this->assertSame('Proof of ownership is required.', $body['error']);
    }

    public function testRejectsEmptyFile(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'empty.pdf', '')];

        [$status, $body] = $this->register($this->validPost(), $files);

        $this->assertSame(400, $status);
        $this->assertSame(['success' => false, 'error' => 'The file is empty. Please choose a different file.'], $body);
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM admin_requests')->fetchColumn());
    }

    public function testAcceptsFileJustUnderTheLimit(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload(
            $this->tmpDir,
            'big.pdf',
            Fixtures::pdfBytes() . str_repeat('0', KARAVAN_MAX_PROOF_BYTES - strlen(Fixtures::pdfBytes()))
        )];

        [$status] = $this->register($this->validPost(), $files);

        $this->assertSame(201, $status);
    }

    public function testUploadFolderGetsBlankIndexSoApacheCannotListIt(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        $this->register($this->validPost(), $files);

        $this->assertFileExists($this->uploadDir . '/index.html');
        $this->assertSame('', file_get_contents($this->uploadDir . '/index.html'));
    }

    public function testRejectsDisallowedExtension(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'notes.txt', 'plain text')];

        [$status, $body] = $this->register($this->validPost(), $files);

        $this->assertSame(400, $status);
        $this->assertSame(['success' => false, 'error' => 'Invalid file type. Accepted formats: PDF, JPG, PNG.'], $body);
    }

    public function testRejectsFileWhoseContentDoesNotMatchExtension(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'renamed.pdf', "#!/bin/sh\necho hi\n")];

        [$status, $body] = $this->register($this->validPost(), $files);

        $this->assertSame(400, $status);
        $this->assertSame('Invalid file type. Accepted formats: PDF, JPG, PNG.', $body['error']);
    }

    public function testRejectsFilesOverTwoMegabytes(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload(
            $this->tmpDir,
            'huge.pdf',
            Fixtures::pdfBytes() . str_repeat('0', KARAVAN_MAX_PROOF_BYTES)
        )];

        [$status, $body] = $this->register($this->validPost(), $files);

        $this->assertSame(400, $status);
        $this->assertSame('File is too large. Maximum size is 2MB.', $body['error']);
    }

    public function testCreatesPendingRequestOnSuccess(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        [$status, $body] = $this->register($this->validPost(), $files);

        $this->assertSame(201, $status);
        $this->assertTrue($body['success']);
        $this->assertSame('pending', $body['status']);
        $this->assertIsInt($body['request_id']);

        $row = $this->pdo->query('SELECT * FROM admin_requests')->fetch();
        $this->assertSame($body['request_id'], (int) $row['id']);
        $this->assertSame('pending', $row['status']);
        $this->assertSame('Chun Admin', $row['full_name']);
        $this->assertSame('application/pdf', $row['proof_mime_type']);
    }

    public function testStoresHashedPasswordOnRequestWithoutCreatingAccount(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        $this->register($this->validPost(), $files);

        $hash = $this->pdo->query('SELECT password_hash FROM admin_requests')->fetchColumn();
        $this->assertNotSame('Admin123!', $hash);
        $this->assertTrue(password_verify('Admin123!', $hash));
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
    }

    public function testRejectsSecondRequestForSameEmail(): void
    {
        $first = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];
        $second = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'deed.pdf', Fixtures::pdfBytes())];
        $this->register($this->validPost(), $first);

        [$status, $body] = $this->register($this->validPost(['email' => 'Chun.Admin@test.com']), $second);

        $this->assertSame(409, $status);
        $this->assertSame('A request for this email is already pending review.', $body['error']);
        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM admin_requests')->fetchColumn());
    }

    public function testSavesFileIntoUploadDirectoryWithRandomName(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, '../../evil name.png', Fixtures::pngBytes())];

        [$status] = $this->register($this->validPost(), $files);

        $this->assertSame(201, $status);
        $stored = $this->pdo->query('SELECT proof_file_name FROM admin_requests')->fetchColumn();
        $this->assertMatchesRegularExpression('/^[a-f0-9]{32}\.png$/', $stored);
        $this->assertFileExists($this->uploadDir . '/' . $stored);
        $this->assertSame(Fixtures::pngBytes(), file_get_contents($this->uploadDir . '/' . $stored));
    }

    public function testAcceptsJpg(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'license.JPG', Fixtures::jpgBytes())];

        [$status] = $this->register($this->validPost(), $files);

        $this->assertSame(201, $status);
    }

    public function testBusinessNameWithApostrophesAndQuotesIsStoredVerbatim(): void
    {
        $name = "Bob's \"Best\" Rentals'); DROP TABLE users; --";
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        [$status] = $this->register($this->validPost(['business_name' => $name, 'full_name' => "Shaquille O'Neal"]), $files);

        $this->assertSame(201, $status);
        $row = $this->pdo->query('SELECT full_name, business_name FROM admin_requests')->fetch();
        $this->assertSame($name, $row['business_name']);
        $this->assertSame("Shaquille O'Neal", $row['full_name']);
        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM admin_requests')->fetchColumn());
    }

    public function testRejectsMissingTextFields(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        [$status, $body] = $this->register($this->validPost(['business_name' => '   ']), $files);

        $this->assertSame(400, $status);
        $this->assertFalse($body['success']);
    }

    public function testRejectsEmailLongerThanUsernameColumn(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        [$status, $body] = $this->register($this->validPost(['email' => str_repeat('a', 42) . '@test.com']), $files);

        $this->assertSame(400, $status);
        $this->assertSame('Email must be 50 characters or fewer.', $body['error']);
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM admin_requests')->fetchColumn());
    }

    public function testRegularAccountEmailLinksTheRequestToThatAccount(): void
    {
        $studentId = TestDatabase::addUser($this->pdo, 'chun.student', 'user', 'chun.admin@test.com');
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        [$status, $body] = $this->register($this->validPost(['email' => 'CHUN.ADMIN@test.com']), $files);

        $this->assertSame(201, $status);
        $this->assertTrue($body['success']);
        $row = $this->pdo->query('SELECT * FROM admin_requests')->fetch();
        $this->assertSame($studentId, (int) $row['user_id']);
        $this->assertSame('pending', $row['status']);
        $this->assertSame('user', $this->pdo->query("SELECT role FROM users WHERE id = $studentId")->fetchColumn());
    }

    public function testLegacyAccountWithEmailAsUsernameIsAlsoLinked(): void
    {
        $studentId = TestDatabase::addUser($this->pdo, 'chun.admin@test.com');
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        [$status] = $this->register($this->validPost(), $files);

        $this->assertSame(201, $status);
        $this->assertSame($studentId, (int) $this->pdo->query('SELECT user_id FROM admin_requests')->fetchColumn());
    }

    public function testNewEmailLeavesTheRequestUnlinked(): void
    {
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        $this->register($this->validPost(), $files);

        $this->assertNull($this->pdo->query('SELECT user_id FROM admin_requests')->fetchColumn());
    }

    public static function elevatedRoles(): array
    {
        return ['admin' => ['admin'], 'moderator' => ['moderator']];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('elevatedRoles')]
    public function testRejectsEmailOfAnAdminOrModerator(string $role): void
    {
        TestDatabase::addUser($this->pdo, 'chun', $role, 'chun.admin@test.com');
        $files = ['proof_of_ownership' => Fixtures::upload($this->tmpDir, 'lease.pdf', Fixtures::pdfBytes())];

        [$status, $body] = $this->register($this->validPost(['email' => 'CHUN.ADMIN@test.com']), $files);

        $this->assertSame(409, $status);
        $this->assertSame(['success' => false, 'error' => 'An account with this email already exists.'], $body);
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM admin_requests')->fetchColumn());
        $this->assertDirectoryDoesNotExist($this->uploadDir, 'no document is saved for a rejected application');
    }
}
