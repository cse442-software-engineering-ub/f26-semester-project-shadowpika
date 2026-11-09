<?php
declare(strict_types=1);
// Real HTTP against PDO + mysqli, disposable loopback MySQL only.
require_once dirname(__DIR__).'/backend/Support/Fixtures.php';
use Karavan\Tests\Support\Fixtures;
$dsn=getenv('KARAVAN_IMAGE_TEST_DSN')?:'';
if(!preg_match('/\Amysql:host=127\.0\.0\.1;port=(\d+)\z/',$dsn,$matches))throw new RuntimeException('Set loopback-only KARAVAN_IMAGE_TEST_DSN without a database.');
$root=dirname(__DIR__,2);$docRoot=$root.'/deploy';
$admin=new PDO($dsn,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$suffix=bin2hex(random_bytes(6));$db='gallery_'.$suffix;$user=$db;$password=bin2hex(random_bytes(16));
$work=Fixtures::tempDir('karavan_gallery_');mkdir($work.'/sessions');
$server=null;$uploaded=[];$checks=0;$pdo=null;
function gallery_check(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);$checks++;echo "PASS $label\n";}
try{
 $admin->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4; CREATE USER '$user'@'127.0.0.1' IDENTIFIED BY '$password'; GRANT ALL ON `$db`.* TO '$user'@'127.0.0.1'");
 $pdo=new PDO($dsn.';dbname='.$db,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $pdo->exec("CREATE TABLE users(id INT PRIMARY KEY,username VARCHAR(100),email VARCHAR(100),password_hash VARCHAR(255),role VARCHAR(20)) ENGINE=InnoDB;
 CREATE TABLE admin_requests(id INT PRIMARY KEY,business_name VARCHAR(255),status VARCHAR(20),user_id INT NULL) ENGINE=InnoDB;
 CREATE TABLE community_members(user_id INT,community_id INT,shopping INT,PRIMARY KEY(user_id,community_id)) ENGINE=InnoDB;
 CREATE TABLE community_join_requests(user_id INT,community_id INT,status VARCHAR(20)) ENGINE=InnoDB;
 CREATE TABLE auth_tokens(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,selector VARCHAR(24),token_hash VARCHAR(64),expires_at DATETIME) ENGINE=InnoDB;
 CREATE TABLE approved_locations(id INT PRIMARY KEY,label VARCHAR(100),community VARCHAR(255),lat DECIMAL(9,6),lng DECIMAL(9,6)) ENGINE=InnoDB;
 CREATE TABLE listings(listing_id INT AUTO_INCREMENT PRIMARY KEY,owner_id INT,name VARCHAR(255),category VARCHAR(100),`condition` VARCHAR(50),price DECIMAL(10,2),related_course VARCHAR(100),community VARCHAR(255),meeting_location VARCHAR(255),meeting_location_id INT,description TEXT,image_url VARCHAR(255),status VARCHAR(20),created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
 CREATE TABLE meeting_requests(request_id INT PRIMARY KEY,listing_id INT,buyer_id INT,status VARCHAR(20),checked_in_at DATETIME,seller_checked_in_at DATETIME) ENGINE=InnoDB;
 INSERT INTO users VALUES(1,'seller','seller@example.test','local','user'),(2,'buyer','buyer@example.test','local','user');
 INSERT INTO admin_requests VALUES(5001,'Karavan','approved',NULL),(5002,'Keller Properties LLC','approved',NULL);
 INSERT INTO community_members VALUES(1,5002,1);
 INSERT INTO approved_locations VALUES(1,'Baldy 19','Karavan',43.0,-78.0),(2,'Keller Office','Keller Properties LLC',43.1,-78.1);
 INSERT INTO listings(owner_id,name,price,`condition`,category,community,description,image_url,status) VALUES(1,'Legacy',12,'Good','Other','Karavan','Old row','uploads/legacy.jpg','active'),(1,'No image',12,'Good','Other','Karavan','Old empty',NULL,'active');");
 $old=$pdo->query('SELECT * FROM listings ORDER BY listing_id')->fetchAll(PDO::FETCH_ASSOC);
 $migration=file_get_contents($root.'/database/migrations/016_listing_images.sql');$pdo->exec($migration);$pdo->exec($migration);
 gallery_check($old===$pdo->query('SELECT * FROM listings ORDER BY listing_id')->fetchAll(PDO::FETCH_ASSOC),'migration rerun preserves all legacy listing values');
 $socket=stream_socket_server('tcp://127.0.0.1:0');$address=stream_socket_get_name($socket,false);fclose($socket);$port=(int)substr(strrchr($address,':'),1);
 $env=array_merge(getenv(),['KARAVAN_DB_DSN'=>$dsn.';dbname='.$db,'KARAVAN_DB_HOST'=>'127.0.0.1:'.$matches[1],'KARAVAN_DB_NAME'=>$db,'KARAVAN_DB_USER'=>$user,'KARAVAN_DB_PASS'=>$password]);
 $server=proc_open([PHP_BINARY,'-d','session.save_path='.$work.'/sessions','-d','upload_max_filesize=8M','-d','post_max_size=12M','-S',$address,'-t',$docRoot],[1=>['file',$work.'/server.log','a'],2=>['file',$work.'/server.log','a']],$pipes,$docRoot,$env);
 for($i=0;$i<50;$i++){if($s=@fsockopen('127.0.0.1',$port)){fclose($s);break;}usleep(100000);}
 $sessions=[];foreach([1,2] as $id){$sessions[$id]=bin2hex(random_bytes(16));file_put_contents($work.'/sessions/sess_'.$sessions[$id],"user_id|i:$id;");}
 $request=function(string $path,$body=null,?int $as=1,string $method='POST',bool $multipart=false)use($port,$sessions):array{
  $headers=[];if(!$multipart)$headers[]='Content-Type: application/json';if($as!==null)$headers[]='Cookie: PHPSESSID='.$sessions[$as];
  $curl=curl_init('http://127.0.0.1:'.$port.'/'.$path);curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_TIMEOUT=>10]);
  if($body!==null)curl_setopt($curl,CURLOPT_POSTFIELDS,$multipart?$body:(is_string($body)?$body:json_encode($body)));
  $raw=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);return [$status,json_decode((string)$raw,true),$raw];
 };
 $urls=[];for($i=0;$i<5;$i++){
  $file=$work.'/photo'.$i.'.png';file_put_contents($file,Fixtures::pngBytes());
  [$status,$body]=$request('listing/api/upload_image.php',['image'=>new CURLFile($file,'image/png','photo'.$i.'.png')],1,'POST',true);
  gallery_check($status===201&&$body['success'],'real multipart upload '.$i);
  $urls[]=$body['image_url'];$uploaded[]=$body['image']['filename'];
 }
 $allUrls=$urls;$urls=array_slice($urls,0,3);
 foreach([['bad.txt','not an image',415],['empty.png','',400],['large.png',str_repeat('x',5*1024*1024+1),413]] as [$filename,$content,$expected]){
  $file=$work.'/'.$filename;file_put_contents($file,$content);[$status]=$request('listing/api/upload_image.php',['image'=>new CURLFile($file,'image/png',$filename)],1,'POST',true);
  gallery_check($status===$expected,'upload rejects '.$filename);
 }
 $base=['title'=>'Gallery book','category'=>'Textbooks','condition'=>'Good','price'=>'25.00','community'=>'Karavan','meeting_location_id'=>1,'description'=>'Three views','image_urls'=>$urls,'image_url'=>$urls[0]];
 [$status,$body]=$request('listing/api/create_listing.php',$base);$id=$body['listing']['listing_id']??0;
 gallery_check($status===201&&$id>0,'create gallery listing through real mysqli endpoint');
 gallery_check($body['listing']['image_urls']===$urls&&$body['listing']['image_url']===$urls[0],'creation returns ordered gallery and cover');
 foreach(['listing/api/get_listing.php','api/get_item_details.php'] as $endpoint){
  [$status,$body]=$request($endpoint.'?listing_id='.$id,null,2,'GET');gallery_check($status===200&&$body['listing']['image_urls']===$urls,'buyer reads ordered '.$endpoint);
  [$status,$body]=$request($endpoint.'?listing_id=1',null,2,'GET');gallery_check($status===200&&$body['listing']['image_urls']===['uploads/legacy.jpg'],'legacy fallback '.$endpoint);
  [$status,$body]=$request($endpoint.'?listing_id=2',null,2,'GET');gallery_check($status===200&&$body['listing']['image_urls']===[],'empty legacy fallback '.$endpoint);
 }
 $invalid=[[],array_fill(0,6,$urls[0]),[$urls[0],$urls[0]],'bad',[[]],['https://example.com/image.jpg'],['listing/api/image.php?file=../secret'],['listing/api/image.php?file='.str_repeat('f',32).'.png']];
 foreach($invalid as $n=>$array){
  $before=(int)$pdo->query('SELECT COUNT(*) FROM listings')->fetchColumn();$input=$base;$input['image_urls']=$array;
  [$status,$body]=$request('listing/api/create_listing.php',$input);gallery_check($status===422&&!$body['success'],'invalid gallery '.$n.' rejected');
  gallery_check($before===(int)$pdo->query('SELECT COUNT(*) FROM listings')->fetchColumn(),'invalid gallery '.$n.' inserts nothing');
 }
 $bad=$base;$bad['image_url']=$urls[1];gallery_check($request('listing/api/create_listing.php',$bad)[0]===422,'conflicting cover rejected');
 gallery_check($request('listing/api/create_listing.php',$base,null)[0]===401,'anonymous creation rejected');
 $private=$base;$private['community']='Keller Properties LLC';$private['meeting_location_id']=2;
 gallery_check($request('listing/api/create_listing.php',$private,2)[0]===403,'nonmember creation rejected');
 [$status,$body]=$request('listing/api/create_listing.php',$private);$privateId=$body['listing']['listing_id'];gallery_check($status===201,'seller creates joined-community gallery');
 foreach(['listing/api/get_listing.php','api/get_item_details.php'] as $endpoint)gallery_check($request($endpoint.'?listing_id='.$privateId,null,2,'GET')[0]===403,'nonmember read rejected '.$endpoint);
 $edit=['action'=>'save_changes','listing_id'=>$id,'name'=>'Gallery book','price'=>'25.00','category'=>'Textbooks','condition'=>'Good','meeting_location'=>'Baldy 19','description'=>'Edited description','image_url'=>$urls[0]];
 gallery_check($request('listing/api/update_listing.php',$edit)[0]===200,'ordinary edit succeeds');
 foreach(['listing/api/get_listing.php','api/get_item_details.php'] as $endpoint){[, $body]=$request($endpoint.'?listing_id='.$id,null,2,'GET');gallery_check($body['listing']['image_urls']===$urls&&$body['listing']['description']==='Edited description','ordinary edit preserves gallery '.$endpoint);}
 gallery_check($request('listing/api/update_listing.php',$edit,2)[0]===404,'nonowner edit rejected by existing not-found contract');
 $edit['image_url']=$urls[1];gallery_check($request('listing/api/update_listing.php',$edit)[0]===422,'old editor cannot replace gallery cover');
 [$status,$mine]=$request('listing/api/get_my_listings.php',null,1,'GET');gallery_check($status===200&&count($mine['results'])===4,'My Listings reads gallery data');
 $legacy=$base;unset($legacy['image_urls']);[$status,$body]=$request('listing/api/create_listing.php',$legacy);$singleId=$body['listing']['listing_id'];gallery_check($status===201&&$body['listing']['image_urls']===[$urls[0]],'legacy single-image create remains compatible');
 $edit['listing_id']=$singleId;$edit['image_url']=$urls[2];gallery_check($request('listing/api/update_listing.php',$edit)[0]===200,'single image editor remains usable');
 [, $body]=$request('api/get_item_details.php?listing_id='.$singleId,null,2,'GET');gallery_check($body['listing']['image_urls']===[$urls[2]],'single gallery row follows changed cover');
 $before=(int)$pdo->query('SELECT COUNT(*) FROM listings')->fetchColumn();$beforeImages=(int)$pdo->query('SELECT COUNT(*) FROM listing_images')->fetchColumn();
 $pdo->exec("CREATE TRIGGER fail_gallery BEFORE INSERT ON listing_images FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='forced gallery failure'");
 gallery_check($request('listing/api/create_listing.php',$base)[0]===500,'forced gallery write failure reported');
 gallery_check($before===(int)$pdo->query('SELECT COUNT(*) FROM listings')->fetchColumn()&&$beforeImages===(int)$pdo->query('SELECT COUNT(*) FROM listing_images')->fetchColumn(),'transaction rolls back listing and image rows');$pdo->exec('DROP TRIGGER fail_gallery');
 $snapshot=$pdo->query('SELECT * FROM listing_images ORDER BY listing_id,`position`')->fetchAll(PDO::FETCH_ASSOC);$pdo->exec($migration);
 gallery_check($snapshot===$pdo->query('SELECT * FROM listing_images ORDER BY listing_id,`position`')->fetchAll(PDO::FETCH_ASSOC),'migration rerun preserves configured image order');
 gallery_check($request('listing/api/update_listing.php',['action'=>'delete','listing_id'=>$id])[0]===200,'listing deletion succeeds');
 gallery_check((int)$pdo->query('SELECT COUNT(*) FROM listing_images WHERE listing_id='.(int)$id)->fetchColumn()===0,'listing deletion cascades gallery associations');
 gallery_check(is_file($docRoot.'/listing/uploads/'.$uploaded[0]),'deletion does not remove a file shared with another listing');
 $five=$base;$five['image_urls']=$allUrls;
 [$status,$body]=$request('listing/api/create_listing.php',$five);
 gallery_check($status===201&&$body['listing']['image_urls']===$allUrls,'exactly five images are accepted and retained');
 echo "All $checks MySQL/HTTP gallery checks passed.\n";
}finally{
 if(is_resource($server)){proc_terminate($server);proc_close($server);}
 foreach($uploaded as $filename)if(is_file($docRoot.'/listing/uploads/'.$filename))unlink($docRoot.'/listing/uploads/'.$filename);
 $pdo=null;$admin->exec("DROP DATABASE IF EXISTS `$db`; DROP USER IF EXISTS '$user'@'127.0.0.1'");Fixtures::removeDir($work);
}
