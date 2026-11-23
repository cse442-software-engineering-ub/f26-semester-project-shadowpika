<?php
namespace Karavan\Tests\Unit;
use Karavan\Tests\Support\TestDatabase;
use PHPUnit\Framework\TestCase;
require_once dirname(__DIR__,3).'/backend/listing/lib/listing_images.php';

final class ListingImagesTest extends TestCase
{
    private function input(): array
    {
        return ['title'=>'Book','category'=>'Textbooks','condition'=>'Good','price'=>'25','community'=>'Karavan','meeting_location_id'=>1,'description'=>'A book','image_urls'=>['listing/api/image.php?file='.str_repeat('a',32).'.png','listing/api/image.php?file='.str_repeat('b',32).'.png']];
    }
    public function testOrderedArrayAndLegacySingleImageValidation():void
    {
        $input=$this->input();$result=validate_create_listing($input);
        self::assertSame([],$result['errors']);self::assertSame($input['image_urls'],$result['data']['image_urls']);
        self::assertSame($input['image_urls'][0],$result['data']['image_url']);
        $legacy=$input;unset($legacy['image_urls']);$legacy['image_url']=$input['image_urls'][0];
        self::assertSame([$legacy['image_url']],validate_create_listing($legacy)['data']['image_urls']);
    }
    public function testInvalidArraysAndConflictingCoverAreRejected():void
    {
        foreach([[],['bad'],['https://example.com/image.jpg'],[[]],'not-an-array',array_fill(0,6,'x')] as $urls){
            $input=$this->input();$input['image_urls']=$urls;self::assertArrayHasKey('image_urls',validate_create_listing($input)['errors']);
        }
        $input=$this->input();$input['image_urls'][]=$input['image_urls'][0];
        self::assertArrayHasKey('image_urls',validate_create_listing($input)['errors']);
        $input=$this->input();$input['image_url']=$input['image_urls'][1];
        self::assertArrayHasKey('image_urls',validate_create_listing($input)['errors']);
    }
    public function testReadOrderLegacyFallbackAndCascade():void
    {
        $pdo=TestDatabase::create();$owner=TestDatabase::addUser($pdo,'seller');$id=TestDatabase::addListing($pdo,$owner,['image_url'=>'front.jpg']);
        self::assertSame(['front.jpg'],listing_images_pdo($pdo,$id,'front.jpg'));
        $pdo->prepare('INSERT INTO listing_images VALUES(?,1,?),(?,0,?)')->execute([$id,'back.jpg',$id,'front.jpg']);
        self::assertSame(['front.jpg','back.jpg'],listing_images_pdo($pdo,$id,'front.jpg'));
        $pdo->exec('DELETE FROM listings');self::assertSame(0,(int)$pdo->query('SELECT COUNT(*) FROM listing_images')->fetchColumn());
        self::assertSame([],listing_gallery_urls([],null));
    }
    public function testOrdinaryEditPreservesGalleryAndRejectsCoverReplacement():void
    {
        $pdo=TestDatabase::create();$owner=TestDatabase::addUser($pdo,'seller');$id=TestDatabase::addListing($pdo,$owner,['image_url'=>'front.jpg']);
        $pdo->prepare('INSERT INTO listing_images VALUES(?,0,?),(?,1,?)')->execute([$id,'front.jpg',$id,'back.jpg']);
        $edit=['action'=>'save_changes','listing_id'=>$id,'name'=>'Edited book','price'=>'25','category'=>'Textbooks','condition'=>'Good','description'=>'Updated','meeting_location'=>'Capen Hall · Main entrance','image_url'=>'front.jpg'];
        self::assertSame(200,update_my_listing($pdo,$owner,$edit)[0]);
        self::assertSame(['front.jpg','back.jpg'],listing_images_pdo($pdo,$id,'front.jpg'));
        $edit['image_url']='different.jpg';self::assertSame(422,update_my_listing($pdo,$owner,$edit)[0]);
        self::assertSame('front.jpg',$pdo->query('SELECT image_url FROM listings')->fetchColumn());
    }
}
