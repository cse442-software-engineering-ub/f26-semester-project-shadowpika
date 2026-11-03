<?php
// SQL reproducibility tests, strictly on a disposable loopback MySQL server.
declare(strict_types=1);
$dsn=getenv('KARAVAN_FIXTURE_TEST_DSN')?:'';
if(!preg_match('/^mysql:host=127\.0\.0\.1;port=\d+$/',$dsn))throw new RuntimeException('Set a disposable loopback KARAVAN_FIXTURE_TEST_DSN (no database name).');
$options=[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC];
$admin=new PDO($dsn,'root','',$options);
$sql=file_get_contents(dirname(__DIR__,2).'/database/seeds/sprint3_task_fixtures.sql');
$checks=0;
function seedCheck(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);++$checks;echo "PASS $message\n";}
function runTaskSeed(PDO $pdo,string $sql):array{
 $statement=$pdo->query($sql);$sets=[];
 try{do{if($statement->columnCount())$sets[]=$statement->fetchAll();}while($statement->nextRowset());}finally{$statement->closeCursor();}
 foreach($sets as $set)foreach($set as $row)if(isset($row['fixture_result']))return [$row['fixture_result'],$sets];
 throw new RuntimeException('Missing fixture result');
}
function seedSnapshot(PDO $pdo):array{
 $out=[];$pdo->exec('SET SESSION information_schema_stats_expiry=0');
 foreach($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t){$out[$t]=[$pdo->query("SELECT * FROM `$t`")->fetchAll(),$pdo->query("SHOW TABLE STATUS LIKE '$t'")->fetch()['Auto_increment']];}
 return $out;
}
function seedSchema(PDO $pdo):void{
 $pdo->exec("CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY,email TEXT,role VARCHAR(20) DEFAULT 'user') ENGINE=InnoDB;
 CREATE TABLE admin_requests (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,full_name VARCHAR(255),business_name VARCHAR(255),email VARCHAR(255) UNIQUE,phone VARCHAR(32),password_hash VARCHAR(255),proof_file_name VARCHAR(255),proof_original_name VARCHAR(255),proof_mime_type VARCHAR(100),status VARCHAR(20),user_id INT,reviewed_at DATETIME) ENGINE=InnoDB;
 CREATE TABLE approved_locations (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,label VARCHAR(100),community VARCHAR(255) COLLATE utf8mb4_bin,lat DECIMAL(9,6),lng DECIMAL(9,6),created_by INT,FOREIGN KEY(created_by) REFERENCES users(id)) ENGINE=InnoDB;
 CREATE TABLE listings (listing_id INT AUTO_INCREMENT PRIMARY KEY,owner_id INT DEFAULT 1,name VARCHAR(255),price DECIMAL(10,2),`condition` VARCHAR(50),category VARCHAR(100),community VARCHAR(255) COLLATE utf8mb4_bin,meeting_location VARCHAR(150),meeting_location_id INT UNSIGNED,description TEXT,image_url VARCHAR(255),status VARCHAR(20),updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(owner_id) REFERENCES users(id),FOREIGN KEY(meeting_location_id) REFERENCES approved_locations(id)) ENGINE=InnoDB;
 CREATE TABLE meeting_requests (request_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,buyer_id INT,listing_id INT,meeting_date DATE,meeting_time TIME,location_id INT UNSIGNED,location_label VARCHAR(100),status VARCHAR(40),checked_in_at DATETIME(6) NULL,seller_checked_in_at DATETIME(6) NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(buyer_id) REFERENCES users(id),FOREIGN KEY(listing_id) REFERENCES listings(listing_id),FOREIGN KEY(location_id) REFERENCES approved_locations(id)) ENGINE=InnoDB;
 CREATE TABLE community_members (user_id INT,community_id INT UNSIGNED,shopping INT DEFAULT 1,PRIMARY KEY(user_id,community_id),FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(community_id) REFERENCES admin_requests(id)) ENGINE=InnoDB;
 CREATE TABLE community_join_requests (user_id INT,community_id INT UNSIGNED) ENGINE=InnoDB;
 INSERT INTO users (id,email) VALUES (71,'jia.buyer@test.com'),(85,'jia.seller@test.com'),(92,'jia.outsider@test.com'),(111,'unrelated@example.test');
 INSERT INTO listings (owner_id,name,price,`condition`,category,community,status,description,image_url) VALUES (111,'Study Lamp',99,'Fair','Other','Unrelated','active','preserve unrelated owner','/old/image.jpg');");
}
$scenarios=['fresh','missing_account','duplicate_email','wrong_role','pending_community','point_conflict','duplicate_point','missing_id_conflict','buyer_joined_keller','schema_incomplete','existing_preservation','used_arrival','used_sold','changed_approval','extra_request','duplicate_title','edited_location'];
foreach($scenarios as $scenario){
 $db='sprint3_seed_test_'.bin2hex(random_bytes(8));$admin->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
 try{
  $pdo=new PDO($dsn.';dbname='.$db,'root','',$options);seedSchema($pdo);
  if($scenario==='missing_account')$pdo->exec('DELETE FROM users WHERE id=92');
  if($scenario==='duplicate_email')$pdo->exec("INSERT INTO users(email) VALUES ('jia.buyer@test.com')");
  if($scenario==='wrong_role')$pdo->exec("UPDATE users SET role='moderator' WHERE id=92");
  if($scenario==='pending_community')$pdo->exec("INSERT INTO admin_requests(business_name,email,status) VALUES ('Keller Properties LLC','pending@example.test','pending')");
  if($scenario==='point_conflict')$pdo->exec("INSERT INTO approved_locations(label,community,lat,lng) VALUES ('Baldy 19','Karavan',44,-79)");
  if($scenario==='duplicate_point')$pdo->exec("INSERT INTO approved_locations(label,community,lat,lng) VALUES ('Baldy 19','Karavan',43.000410,-78.787090),('Baldy 19','Karavan',43.000410,-78.787090)");
  if($scenario==='missing_id_conflict')$pdo->exec("INSERT INTO listings(listing_id,owner_id,name,price,`condition`,category,community,status) VALUES(2147483647,111,'Existing high ID',1,'Good','Other','Karavan','active')");
  if($scenario==='buyer_joined_keller'){
   $pdo->exec("INSERT INTO admin_requests(id,business_name,email,status) VALUES (5002,'Keller Properties LLC','joined@example.test','approved')");
   $pdo->exec('INSERT INTO community_members VALUES(71,5002,0)');
  }
  if($scenario==='schema_incomplete')$pdo->exec('ALTER TABLE meeting_requests DROP COLUMN seller_checked_in_at');
  $mutations=['existing_preservation','used_arrival','used_sold','changed_approval','extra_request','duplicate_title','edited_location'];
  if(in_array($scenario,$mutations,true)){
   [$ready]=runTaskSeed($pdo,$sql);seedCheck(str_starts_with($ready,'PASS:'),"$scenario baseline created");
   if($scenario==='existing_preservation')$pdo->exec("UPDATE listings SET image_url='/user-upload/keep.jpg',description='User-provided purpose',meeting_location=IF(name='Mini Fridge','Keller HQ',meeting_location),meeting_location_id=IF(name='Mini Fridge',NULL,meeting_location_id) WHERE owner_id=85 OR owner_id IS NULL");
   if($scenario==='used_arrival')$pdo->exec("UPDATE meeting_requests SET checked_in_at='2026-11-06 17:01:00.123456',seller_checked_in_at='2026-11-06 17:02:00.654321' WHERE listing_id=(SELECT listing_id FROM listings WHERE owner_id=85 AND name='Study Lamp')");
   if($scenario==='used_sold')$pdo->exec("UPDATE listings SET status='sold' WHERE owner_id=85 AND name='Study Lamp'");
   if($scenario==='changed_approval')$pdo->exec("UPDATE meeting_requests SET status='approved' WHERE listing_id=(SELECT listing_id FROM listings WHERE name='Notebook Set')");
   if($scenario==='extra_request')$pdo->exec('INSERT INTO meeting_requests (buyer_id,listing_id,meeting_date,meeting_time,location_id,location_label,status) SELECT buyer_id,listing_id,meeting_date,meeting_time,location_id,location_label,status FROM meeting_requests ORDER BY request_id LIMIT 1');
   if($scenario==='duplicate_title')$pdo->exec("INSERT INTO listings (owner_id,name,price,`condition`,category,community,status) VALUES(85,'Study Lamp',12,'Good','Dorm Living','Karavan','active')");
   if($scenario==='edited_location')$pdo->exec("UPDATE listings SET meeting_location='Baldy 19',meeting_location_id=(SELECT id FROM approved_locations WHERE label='Baldy 19') WHERE name='Black Desk Lamp'");
  }
  $before=seedSnapshot($pdo);[$result,$sets]=runTaskSeed($pdo,$sql);$after=seedSnapshot($pdo);
  $success=in_array($scenario,['fresh','existing_preservation'],true);
  seedCheck(str_starts_with($result,$success?'PASS:':'BLOCKED'),"$scenario expected result: $result");
  if($scenario!=='fresh')seedCheck($before===$after,"$scenario preserves every application row and next-ID counter");
  else{
   seedCheck((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn()===4,'seed does not create accounts');
   seedCheck((int)$pdo->query('SELECT COUNT(*) FROM listings')->fetchColumn()===12,'11 fixtures plus unrelated existing item');
   seedCheck((int)$pdo->query('SELECT COUNT(*) FROM meeting_requests')->fetchColumn()===7,'seven independent meetings');
   seedCheck((int)$pdo->query('SELECT COUNT(*) FROM community_members')->fetchColumn()===0,'seed does not change memberships');
   seedCheck((int)$pdo->query('SELECT COUNT(*) FROM listings WHERE owner_id=85')->fetchColumn()===10,'dedicated listings use resolved seller ID 85, not live ID 223');
   seedCheck((int)$pdo->query('SELECT COUNT(*) FROM meeting_requests WHERE buyer_id=71')->fetchColumn()===7,'meetings use resolved buyer ID 71, not live ID 222');
   foreach($before as $table=>$data)foreach($data[0] as $row)seedCheck(in_array($row,$after[$table][0],true),"fresh preserves original $table row");
   require_once dirname(__DIR__,2).'/backend/includes/meeting_checkin.php';
   $atNoon=new DateTimeImmutable('2026-11-06T17:00:00Z');
   foreach($pdo->query('SELECT r.request_id,l.name FROM meeting_requests r JOIN listings l ON l.listing_id=r.listing_id')->fetchAll() as $r){
    [$code,$body]=karavan_get_meeting_checkin($pdo,71,(int)$r['request_id'],$atNoon);
    $expected=$r['name']==='Backpack'?'not_open':($r['name']==='Notebook Set'?'not_approved':'open');
    seedCheck($code===200 && $body['meeting']['checkin_state']===$expected && $body['meeting']['buyer_checked_in_at']===null && $body['meeting']['seller_checked_in_at']===null,'application check-in contract: '.$r['name']);
   }
  }
  $saved=seedSnapshot($pdo);runTaskSeed($pdo,$sql);seedCheck(seedSnapshot($pdo)===$saved,"$scenario repeat is unchanged");
 }finally{if(isset($pdo))$pdo->exec('ROLLBACK');unset($pdo);$admin->exec("DROP DATABASE `$db`");}
}
echo "PASS $checks checks across ".count($scenarios)." scenarios.\n";
