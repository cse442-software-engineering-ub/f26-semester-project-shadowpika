<?php
namespace Karavan\Tests\Unit;

use DateTimeImmutable;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 3) . '/backend/includes/messages.php';

// Backend task card #13 (Messaging backend) and user story #12 (message the seller).
final class MessagesTest extends TestCase
{
    private PDO $pdo;
    private int $seller;
    private int $buyer;
    private int $outsider;
    private int $listing;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->seller = TestDatabase::addUser($this->pdo, 'morgan.keller1');
        $this->buyer = TestDatabase::addUser($this->pdo, 'riley.shopper');
        $this->outsider = TestDatabase::addUser($this->pdo, 'quinn.other');
        $this->listing = TestDatabase::addListing($this->pdo, $this->seller, ['name' => 'Desk Lamp']);
    }

    private function send(int $from, int $to, string $message, ?int $listing = null, string $at = '2026-11-03T15:00:00Z'): array
    {
        return karavan_send_message($this->pdo, $from, [
            'receiver_id' => $to, 'listing_id' => $listing ?? $this->listing, 'message' => $message,
        ], new DateTimeImmutable($at));
    }

    public function testBuyerMessagesSellerAndBothSeeTheConversationInOrder(): void
    {
        [$status, $body] = $this->send($this->buyer, $this->seller, '  Is the lamp still available?  ');
        $this->assertSame(201, $status);
        $this->assertSame('Is the lamp still available?', $body['message']['message']);
        $this->assertSame('2026-11-03T15:00:00Z', $body['message']['timestamp']);

        $this->assertSame(201, $this->send($this->seller, $this->buyer, 'Yes, it is.', null, '2026-11-03T15:01:00Z')[0]);

        [$status, $body] = karavan_get_conversation($this->pdo, $this->seller, $this->buyer, $this->listing);
        $this->assertSame(200, $status);
        $this->assertSame('riley.shopper', $body['other_username']);
        $this->assertSame('Desk Lamp', $body['listing_name']);
        $this->assertSame(['Is the lamp still available?', 'Yes, it is.'], array_column($body['messages'], 'message'));
        $this->assertSame([$this->buyer, $this->seller], array_column($body['messages'], 'sender_id'));
        $this->assertSame([1, 2], array_column($body['messages'], 'position'));
    }

    public function testDraftConversationReturnsTheSellerNameWithNoMessages(): void
    {
        [$status, $body] = karavan_get_conversation($this->pdo, $this->buyer, (string) $this->seller, (string) $this->listing);
        $this->assertSame(200, $status);
        $this->assertSame('morgan.keller1', $body['other_username']);
        $this->assertSame([], $body['messages']);
    }

    public function testInboxListsOneEntryPerPersonAndListingNewestFirst(): void
    {
        $other = TestDatabase::addListing($this->pdo, $this->seller, ['name' => 'Mini Fridge']);
        $this->send($this->buyer, $this->seller, 'Lamp?', null, '2026-11-03T15:00:00Z');
        $this->send($this->buyer, $this->seller, 'Fridge?', $other, '2026-11-03T15:05:00Z');
        $this->send($this->seller, $this->buyer, 'Lamp is yours.', null, '2026-11-03T15:10:00Z');

        [$status, $body] = karavan_list_conversations($this->pdo, $this->seller);
        $this->assertSame(200, $status);
        $this->assertSame(['Desk Lamp', 'Mini Fridge'], array_column($body['conversations'], 'listing_name'));
        $this->assertSame(['Lamp is yours.', 'Fridge?'], array_column($body['conversations'], 'last_message'));
        $this->assertSame('riley.shopper', $body['conversations'][0]['other_username']);
        $this->assertSame([], karavan_list_conversations($this->pdo, $this->outsider)[1]['conversations']);
    }

    public function testOutsidersCannotReadAConversation(): void
    {
        $this->send($this->buyer, $this->seller, 'Private question');
        [$status, $body] = karavan_get_conversation($this->pdo, $this->outsider, $this->buyer, $this->listing);
        $this->assertSame(403, $status);
        $this->assertSame('This listing is not associated with either participant.', $body['error']);
    }

    /** @dataProvider invalidMessages */
    public function testRejectsEmptyOrTooLongMessagesWithoutSaving($message): void
    {
        [$status, $body] = karavan_send_message($this->pdo, $this->buyer, [
            'receiver_id' => $this->seller, 'listing_id' => $this->listing, 'message' => $message,
        ]);
        $this->assertSame(400, $status);
        $this->assertSame('Messages must contain 1–5000 characters.', $body['error']);
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM messages')->fetchColumn());
    }

    public static function invalidMessages(): array
    {
        return [
            'empty' => [''], 'whitespace' => ["   \n\t "], 'too long' => [str_repeat('a', 5001)],
            'missing' => [null], 'not text' => [['hi']],
        ];
    }

    public function testAcceptsExactly5000Characters(): void
    {
        $this->assertSame(201, $this->send($this->buyer, $this->seller, str_repeat('é', 5000))[0]);
    }

    public function testValidatesRecipientAndListing(): void
    {
        $cases = [
            [['receiver_id' => $this->buyer, 'listing_id' => $this->listing], 400, 'A valid recipient is required.'],
            [['receiver_id' => 'abc', 'listing_id' => $this->listing], 400, 'A valid recipient is required.'],
            [['receiver_id' => $this->seller, 'listing_id' => 0], 400, 'A valid listing ID is required.'],
            [['receiver_id' => 99999, 'listing_id' => $this->listing], 404, 'Recipient not found.'],
            [['receiver_id' => $this->seller, 'listing_id' => 99999], 404, 'Listing not found.'],
            [['receiver_id' => $this->outsider, 'listing_id' => $this->listing], 403, 'This listing is not associated with either participant.'],
        ];
        foreach ($cases as [$input, $status, $error]) {
            $response = karavan_send_message($this->pdo, $this->buyer, $input + ['message' => 'Hello']);
            $this->assertSame([$status, ['success' => false, 'error' => $error]], $response, json_encode($input));
        }
        $this->assertSame(400, karavan_send_message($this->pdo, $this->buyer, 'not json')[0]);
    }

    public function testSellerCanOnlyReplyToBuyersWhoWroteFirst(): void
    {
        [$status, $body] = $this->send($this->seller, $this->buyer, 'Want my lamp?');
        $this->assertSame(403, $status);
        $this->assertSame('You can only reply to buyers who messaged you about this listing.', $body['error']);
    }

    public function testNonMembersCannotMessageAboutCommunityListings(): void
    {
        TestDatabase::addRequest($this->pdo, ['business_name' => 'Keller Apartments', 'status' => 'approved']);
        $keller = TestDatabase::addListing($this->pdo, $this->seller, ['community' => 'Keller Apartments']);
        [$status, $body] = $this->send($this->buyer, $this->seller, 'Hi', $keller);
        $this->assertSame(403, $status);
        $this->assertSame('This item is only available to members of its community.', $body['error']);
    }

    public function testRequiresLogin(): void
    {
        $this->assertSame(401, karavan_send_message($this->pdo, null, [])[0]);
        $this->assertSame(401, karavan_get_conversation($this->pdo, null, $this->seller, $this->listing)[0]);
        $this->assertSame(401, karavan_list_conversations($this->pdo, null)[0]);
    }
}
