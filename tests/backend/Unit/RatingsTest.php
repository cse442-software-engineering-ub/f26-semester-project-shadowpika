<?php
namespace Karavan\Tests\Unit;

use DateTimeImmutable;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 3) . '/backend/includes/ratings.php';

// Backend task card #133 (Review backend) and user story #132 (rate a seller after a purchase).
final class RatingsTest extends TestCase
{
    private PDO $pdo;
    private int $seller;
    private int $buyer;
    private int $listing;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->seller = TestDatabase::addUser($this->pdo, 'morgan.keller1');
        $this->buyer = TestDatabase::addUser($this->pdo, 'taylor.shopper');
        $this->listing = TestDatabase::addListing($this->pdo, $this->seller, ['status' => 'sold']);
    }

    private function completePurchase(int $buyer): void
    {
        TestDatabase::addMeeting($this->pdo, $buyer, $this->listing, [
            'checked_in_at' => '2026-11-02 17:00:00', 'seller_checked_in_at' => '2026-11-02 17:01:00',
        ]);
    }

    private function rate(int $buyer, $stars, $review = '', string $at = '2026-11-03T15:00:00Z'): array
    {
        return karavan_save_rating($this->pdo, $buyer, ['seller_id' => $this->seller, 'rating' => $stars, 'review' => $review],
            new DateTimeImmutable($at));
    }

    public function testBuyerWithCompletedPurchaseRatesAndCanUpdateTheirRating(): void
    {
        $this->completePurchase($this->buyer);
        $this->assertTrue(karavan_get_seller_ratings($this->pdo, $this->buyer, $this->seller)[1]['can_rate']);

        [$status, $body] = $this->rate($this->buyer, 4, '  Fast and friendly.  ');
        $this->assertSame(200, $status);
        $this->assertSame('Rating saved successfully.', $body['message']);
        $this->assertFalse($body['updated']);
        $this->assertSame(4.0, $body['averageRating']);
        $this->assertSame(1, $body['ratingCount']);

        [$status, $body] = $this->rate($this->buyer, '2', 'Changed my mind.', '2026-11-04T15:00:00Z');
        $this->assertSame(200, $status);
        $this->assertSame('Rating saved successfully.', $body['message']);
        $this->assertTrue($body['updated']);
        $this->assertSame(2.0, $body['averageRating']);
        $this->assertSame(1, $body['ratingCount']);

        [, $page] = karavan_get_seller_ratings($this->pdo, $this->buyer, $this->seller);
        $this->assertSame(['rating' => 2, 'review' => 'Changed my mind.'], $page['my_rating']);
        $this->assertSame('taylor.shopper', $page['ratings'][0]['reviewer_name']);
        $this->assertSame('2026-11-04T15:00:00Z', $page['ratings'][0]['created_at']);
    }

    public function testSummaryAveragesEveryBuyerToOneDecimalNewestFirst(): void
    {
        $second = TestDatabase::addUser($this->pdo, 'riley.shopper');
        $this->completePurchase($this->buyer);
        $this->completePurchase($second);
        $this->rate($this->buyer, 5, 'Great', '2026-11-03T15:00:00Z');
        $this->rate($second, 4, '', '2026-11-03T16:00:00Z');
        $third = TestDatabase::addUser($this->pdo, 'quinn.buyer');
        $this->completePurchase($third);
        $this->rate($third, 4, '', '2026-11-03T17:00:00Z');

        [$status, $body] = karavan_get_seller_ratings($this->pdo, $this->seller, (string) $this->seller);
        $this->assertSame(200, $status);
        $this->assertSame('morgan.keller1', $body['seller_name']);
        $this->assertSame(4.3, $body['averageRating']);
        $this->assertSame(3, $body['ratingCount']);
        $this->assertSame(['quinn.buyer', 'riley.shopper', 'taylor.shopper'], array_column($body['ratings'], 'reviewer_name'));
        $this->assertTrue($body['is_seller']);
        $this->assertFalse($body['can_rate']);
        $this->assertSame(['average_rating' => 4.3, 'rating_count' => 3], karavan_seller_rating_summary($this->pdo, $this->seller));
    }

    public function testSellerWithNoRatingsHasNoAverage(): void
    {
        [, $body] = karavan_get_seller_ratings($this->pdo, $this->buyer, $this->seller);
        $this->assertNull($body['averageRating']);
        $this->assertSame(0, $body['ratingCount']);
        $this->assertSame([], $body['ratings']);
        $this->assertFalse($body['can_rate']);
        $this->assertNull($body['my_rating']);
    }

    public function testRatingRequiresAPurchaseWhereBothPeopleCheckedIn(): void
    {
        $meetings = [
            ['status' => 'pending'],
            ['checked_in_at' => '2026-11-02 17:00:00'],
            ['seller_checked_in_at' => '2026-11-02 17:01:00'],
        ];
        foreach ($meetings as $meeting) {
            TestDatabase::addMeeting($this->pdo, $this->buyer, $this->listing, $meeting);
        }
        $this->assertSame([403, ['success' => false, 'error' => 'You can only rate a seller after completing a purchase with them.']],
            $this->rate($this->buyer, 5));
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM ratings')->fetchColumn());
    }

    public function testValidation(): void
    {
        $this->completePurchase($this->buyer);
        $cases = [
            [['seller_id' => $this->seller, 'rating' => 0], 400, 'Rating must be between 1 and 5 stars.'],
            [['seller_id' => $this->seller, 'rating' => 6], 400, 'Rating must be between 1 and 5 stars.'],
            [['seller_id' => $this->seller, 'rating' => 4.5], 400, 'Rating must be between 1 and 5 stars.'],
            [['seller_id' => $this->seller], 400, 'Rating must be between 1 and 5 stars.'],
            [['seller_id' => $this->seller, 'rating' => 5, 'review' => str_repeat('a', 1001)], 400, 'Review must be 1000 characters or fewer.'],
            [['seller_id' => $this->buyer, 'rating' => 5], 400, 'You cannot rate yourself.'],
            [['seller_id' => 'abc', 'rating' => 5], 400, 'A valid seller_id is required.'],
            [['seller_id' => 99999, 'rating' => 5], 404, 'Seller not found.'],
        ];
        foreach ($cases as [$input, $status, $error]) {
            $this->assertSame([$status, ['success' => false, 'error' => $error]],
                karavan_save_rating($this->pdo, $this->buyer, $input), json_encode($input));
        }
        $this->assertSame(200, karavan_save_rating($this->pdo, $this->buyer,
            ['seller_id' => $this->seller, 'rating' => 5, 'review' => str_repeat('a', 1000)])[0]);
    }

    public function testRequiresLoginAndAnExistingSeller(): void
    {
        $this->assertSame([401, ['success' => false, 'error' => 'You must be logged in to submit a rating.']],
            karavan_save_rating($this->pdo, null, ['seller_id' => $this->seller, 'rating' => 5]));
        $this->assertSame(401, karavan_get_seller_ratings($this->pdo, null, $this->seller)[0]);
        $this->assertSame(404, karavan_get_seller_ratings($this->pdo, $this->buyer, 99999)[0]);
        $this->assertSame(400, karavan_get_seller_ratings($this->pdo, $this->buyer, '1 OR 1=1')[0]);
    }
}
