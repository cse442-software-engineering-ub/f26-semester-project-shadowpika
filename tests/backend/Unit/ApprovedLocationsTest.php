<?php
namespace Karavan\Tests\Unit;

use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ApprovedLocationsTest extends TestCase
{
    private const FORBIDDEN = ['success' => false, 'error' => 'You do not have permission to perform this action.'];
    private const INVALID_COORDINATES = ['success' => false, 'error' => 'Invalid location coordinates.'];
    private const CAPEN = ['lat' => 42.9612, 'lng' => -78.8328, 'label' => 'Capen Hall Main Entrance'];

    private PDO $pdo;
    private int $adminId;
    private int $moderatorId;
    private int $regularUserId;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->adminId = TestDatabase::addUser($this->pdo, 'alex.landlord@test.com', 'admin');
        $this->moderatorId = TestDatabase::addUser($this->pdo, 'karavan.mod', 'moderator');
        $this->regularUserId = TestDatabase::addUser($this->pdo, 'testuser@test.com', 'user');
    }

    private function locationCount(): int
    {
        return (int) $this->pdo->query('SELECT COUNT(*) FROM approved_locations')->fetchColumn();
    }

    private function locationRow(int $locationId): array|false
    {
        $stmt = $this->pdo->prepare('SELECT * FROM approved_locations WHERE id = ?');
        $stmt->execute([$locationId]);
        return $stmt->fetch();
    }

    private function userIdFor(string $who): ?int
    {
        return match ($who) {
            'none'      => null,
            'user'      => $this->regularUserId,
            'moderator' => $this->moderatorId,
            'missing'   => 999999,
        };
    }

    public static function nonAdmins(): array
    {
        return [
            'not logged in'   => ['none'],
            'regular user'    => ['user'],
            'moderator'       => ['moderator'],
            'unknown user id' => ['missing'],
        ];
    }

    // Backend Test 1
    public function testAdminGetsEveryLocationWithIdCoordinatesAndLabel(): void
    {
        $capenId = TestDatabase::addLocation($this->pdo, 42.9612, -78.8328, 'Capen Hall Main Entrance', $this->adminId);
        $unionId = TestDatabase::addLocation($this->pdo, 43.0011, -78.7861, 'Student Union Lobby', $this->adminId);

        [$status, $body] = karavan_list_approved_locations($this->pdo, $this->adminId);

        $this->assertSame(200, $status);
        $this->assertSame([
            'success'   => true,
            'locations' => [
                ['location_id' => $capenId, 'lat' => 42.9612, 'lng' => -78.8328, 'label' => 'Capen Hall Main Entrance'],
                ['location_id' => $unionId, 'lat' => 43.0011, 'lng' => -78.7861, 'label' => 'Student Union Lobby'],
            ],
        ], $body);
    }

    public function testAdminGetsAnEmptyListWhenNoLocationsExist(): void
    {
        $this->assertSame([200, ['success' => true, 'locations' => []]], karavan_list_approved_locations($this->pdo, $this->adminId));
    }

    public function testCoordinatesAreReturnedAsNumbersNotStrings(): void
    {
        // MySQL's PDO driver returns DECIMAL columns as strings.
        $this->pdo->exec("INSERT INTO approved_locations (lat, lng, label) VALUES ('42.961200', '-78.832800', 'Capen')");

        [, $body] = karavan_list_approved_locations($this->pdo, $this->adminId);

        $this->assertSame(42.9612, $body['locations'][0]['lat']);
        $this->assertSame(-78.8328, $body['locations'][0]['lng']);
    }

    // Backend Test 2
    public function testAdminAddsLocationAndRowIsStored(): void
    {
        [$status, $body] = karavan_add_approved_location($this->pdo, $this->adminId, self::CAPEN);

        $this->assertSame(201, $status);
        $this->assertTrue($body['success']);
        $this->assertIsInt($body['location_id']);
        $this->assertSame(['success', 'location_id'], array_keys($body));

        $row = $this->locationRow($body['location_id']);
        $this->assertEqualsWithDelta(42.9612, (float) $row['lat'], 1e-9);
        $this->assertEqualsWithDelta(-78.8328, (float) $row['lng'], 1e-9);
        $this->assertSame('Capen Hall Main Entrance', $row['label']);
        $this->assertSame($this->adminId, (int) $row['created_by']);
        $this->assertNotEmpty($row['created_at']);
    }

    public function testAddedLocationShowsUpInTheList(): void
    {
        [, $added] = karavan_add_approved_location($this->pdo, $this->adminId, self::CAPEN);

        [, $list] = karavan_list_approved_locations($this->pdo, $this->adminId);

        $this->assertSame([['location_id' => $added['location_id']] + self::CAPEN], $list['locations']);
    }

    public function testLabelIsTrimmedAndSpecialCharactersAreStoredSafely(): void
    {
        $label = "O'Brien's \"Corner\"'); DROP TABLE approved_locations; --";

        [$status, $body] = karavan_add_approved_location($this->pdo, $this->adminId, ['label' => "  $label  "] + self::CAPEN);

        $this->assertSame(201, $status);
        $this->assertSame($label, $this->locationRow($body['location_id'])['label']);
    }

    public function testCoordinatesSentAsNumericStringsAreAccepted(): void
    {
        [$status] = karavan_add_approved_location($this->pdo, $this->adminId, ['lat' => '42.9612', 'lng' => '-78.8328', 'label' => 'Capen']);

        $this->assertSame(201, $status);
    }

    public function testCoordinatesExactlyOnTheLimitsAreAccepted(): void
    {
        [$status] = karavan_add_approved_location($this->pdo, $this->adminId, ['lat' => -90, 'lng' => 180, 'label' => 'Edge']);

        $this->assertSame(201, $status);
    }

    // Backend Test 3
    public function testAdminRemovesLocationAndRowIsDeleted(): void
    {
        $locationId = TestDatabase::addLocation($this->pdo, 42.9612, -78.8328, 'Capen Hall Main Entrance', $this->adminId);
        $otherId = TestDatabase::addLocation($this->pdo, 43.0011, -78.7861, 'Student Union Lobby', $this->adminId);

        [$status, $body] = karavan_remove_approved_location($this->pdo, $this->adminId, ['location_id' => $locationId]);

        $this->assertSame(200, $status);
        $this->assertSame(['success' => true, 'location_id' => $locationId], $body);
        $this->assertFalse($this->locationRow($locationId));
        $this->assertNotFalse($this->locationRow($otherId), 'Only the chosen location is removed.');
    }

    public function testRemovingALocationThatDoesNotExistReturns404(): void
    {
        [$status, $body] = karavan_remove_approved_location($this->pdo, $this->adminId, ['location_id' => 12345]);

        $this->assertSame(404, $status);
        $this->assertSame(['success' => false, 'error' => 'Location not found.'], $body);
    }

    public function testRemovingTheSameLocationTwiceReturns404TheSecondTime(): void
    {
        $locationId = TestDatabase::addLocation($this->pdo, 42.9612, -78.8328, 'Capen');

        karavan_remove_approved_location($this->pdo, $this->adminId, ['location_id' => $locationId]);
        [$status] = karavan_remove_approved_location($this->pdo, $this->adminId, ['location_id' => $locationId]);

        $this->assertSame(404, $status);
    }

    public static function invalidLocationIds(): array
    {
        return [
            'missing'  => [[]],
            'zero'     => [['location_id' => 0]],
            'negative' => [['location_id' => -4]],
            'text'     => [['location_id' => 'abc']],
            'decimal'  => [['location_id' => 1.5]],
            'not json' => [null],
        ];
    }

    #[DataProvider('invalidLocationIds')]
    public function testRemoveRejectsInvalidLocationId($input): void
    {
        $locationId = TestDatabase::addLocation($this->pdo, 42.9612, -78.8328, 'Capen');

        [$status, $body] = karavan_remove_approved_location($this->pdo, $this->adminId, $input);

        $this->assertSame(400, $status);
        $this->assertSame(['success' => false, 'error' => 'A valid location_id is required.'], $body);
        $this->assertNotFalse($this->locationRow($locationId));
    }

    // Backend Test 4
    #[DataProvider('nonAdmins')]
    public function testNonAdminCannotListLocations(string $who): void
    {
        TestDatabase::addLocation($this->pdo, 42.9612, -78.8328, 'Capen');

        $this->assertSame([403, self::FORBIDDEN], karavan_list_approved_locations($this->pdo, $this->userIdFor($who)));
    }

    #[DataProvider('nonAdmins')]
    public function testNonAdminCannotAddLocation(string $who): void
    {
        $result = karavan_add_approved_location($this->pdo, $this->userIdFor($who), ['lat' => 42.9612, 'lng' => -78.8328, 'label' => 'Test']);

        $this->assertSame([403, self::FORBIDDEN], $result);
        $this->assertSame(0, $this->locationCount());
    }

    #[DataProvider('nonAdmins')]
    public function testNonAdminCannotRemoveLocation(string $who): void
    {
        $locationId = TestDatabase::addLocation($this->pdo, 42.9612, -78.8328, 'Capen');

        $result = karavan_remove_approved_location($this->pdo, $this->userIdFor($who), ['location_id' => $locationId]);

        $this->assertSame([403, self::FORBIDDEN], $result);
        $this->assertNotFalse($this->locationRow($locationId));
    }

    public function testPermissionIsCheckedBeforeTheInput(): void
    {
        $this->assertSame([403, self::FORBIDDEN], karavan_add_approved_location($this->pdo, $this->regularUserId, ['lat' => 999]));
    }

    public function testDemotedAdminLosesAccessImmediately(): void
    {
        $this->pdo->exec("UPDATE users SET role = 'user' WHERE id = {$this->adminId}");

        $this->assertSame([403, self::FORBIDDEN], karavan_list_approved_locations($this->pdo, $this->adminId));
    }

    // Backend Test 5
    public static function invalidCoordinates(): array
    {
        return [
            'lat too high (card value)' => [['lat' => 999, 'lng' => -78.8328]],
            'lat too low'               => [['lat' => -90.0001, 'lng' => -78.8328]],
            'lng too high'              => [['lat' => 42.9612, 'lng' => 180.5]],
            'lng too low'               => [['lat' => 42.9612, 'lng' => -181]],
            'lat missing'               => [['lng' => -78.8328]],
            'lng missing'               => [['lat' => 42.9612]],
            'lat is text'               => [['lat' => 'north', 'lng' => -78.8328]],
            'lat is empty'              => [['lat' => '', 'lng' => -78.8328]],
            'lat is boolean'            => [['lat' => true, 'lng' => -78.8328]],
            'lat is null'               => [['lat' => null, 'lng' => -78.8328]],
            'lng is a list'             => [['lat' => 42.9612, 'lng' => [1]]],
        ];
    }

    #[DataProvider('invalidCoordinates')]
    public function testInvalidCoordinatesReturn400AndCreateNoRow(array $coordinates): void
    {
        [$status, $body] = karavan_add_approved_location($this->pdo, $this->adminId, $coordinates + ['label' => 'InvalidSpot']);

        $this->assertSame(400, $status);
        $this->assertSame(self::INVALID_COORDINATES, $body);
        $this->assertSame(0, $this->locationCount());
    }

    public function testNonJsonBodyReturnsInvalidCoordinates(): void
    {
        $this->assertSame([400, self::INVALID_COORDINATES], karavan_add_approved_location($this->pdo, $this->adminId, null));
    }

    public static function invalidLabels(): array
    {
        return [
            'missing'      => [null, 'Please enter a location name.'],
            'empty'        => ['', 'Please enter a location name.'],
            'only spaces'  => ['   ', 'Please enter a location name.'],
            'not a string' => [['Capen'], 'Please enter a location name.'],
            'too long'     => [str_repeat('a', 101), 'Location name must be 100 characters or fewer.'],
        ];
    }

    #[DataProvider('invalidLabels')]
    public function testInvalidLabelReturns400AndCreatesNoRow($label, string $error): void
    {
        $input = ['lat' => 42.9612, 'lng' => -78.8328];
        if ($label !== null) {
            $input['label'] = $label;
        }

        $this->assertSame([400, ['success' => false, 'error' => $error]], karavan_add_approved_location($this->pdo, $this->adminId, $input));
        $this->assertSame(0, $this->locationCount());
    }

    public function testLabelOfExactly100CharactersIncludingAccentsIsAccepted(): void
    {
        [$status] = karavan_add_approved_location($this->pdo, $this->adminId, ['label' => str_repeat('é', 100)] + self::CAPEN);

        $this->assertSame(201, $status);
    }

    public function testDeletingTheAdminKeepsTheirLocations(): void
    {
        $locationId = TestDatabase::addLocation($this->pdo, 42.9612, -78.8328, 'Capen', $this->adminId);

        $this->pdo->exec("DELETE FROM users WHERE id = {$this->adminId}");

        $row = $this->locationRow($locationId);
        $this->assertNotFalse($row);
        $this->assertNull($row['created_by']);
    }
}
