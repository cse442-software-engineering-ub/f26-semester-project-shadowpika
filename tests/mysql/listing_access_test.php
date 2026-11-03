<?php
// #175: real HTTP + mysqli/PDO checks on an isolated loopback MySQL database.
// Build deploy/ first. No shared accounts, uploaded files or course databases used.
declare(strict_types=1);
require_once dirname(__DIR__).'/backend/Support/Fixtures.php';
use Karavan\Tests\Support\Fixtures;
$dsn=getenv('KARAVAN_LISTING_TEST_DSN') ?: '';
if(!preg_match('/^mysql:host=127\.0\.0\.1;port=(\d+)$/',$dsn,$match))throw new RuntimeException('Set a disposable loopback KARAVAN_LISTING_TEST_DSN without a database name.');
$root=dirname(__DIR__,2);$docRoot=$root.'/deploy';
$admin=new PDO($dsn,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$suffix=bin2hex(random_bytes(8));$db='listing_access_test_'.$suffix;$dbUser='listing_'.$suffix;$dbPass=bin2hex(random_bytes(16));
$work=Fixtures::tempDir('karavan_listing_access_');mkdir($work.'/sessions');
$image=bin2hex(random_bytes(16)).'.png';$imagePath=$docRoot.'/listing/uploads/'.$image;
$server=null;$checks=0;$failures=[];
function checkAccess(bool $ok,string $message):void{global $checks,$failures;++$checks;if(!$ok)$failures[]=$message;echo ($ok?'PASS ':'FAIL ').$message.PHP_EOL;}
try{
 $admin->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
 $admin->exec("CREATE USER '$dbUser'@'127.0.0.1' IDENTIFIED BY '$dbPass'");
 $admin->exec("GRANT ALL ON `$db`.* TO '$dbUser'@'127.0.0.1'");
 $pdo=new PDO($dsn.';dbname='.$db,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $pdo->exec("CREATE TABLE users (id INT PRIMARY KEY,username VARCHAR(100),email VARCHAR(100),password_hash VARCHAR(255),role VARCHAR(20)) ENGINE=InnoDB;
 CREATE TABLE admin_requests (id INT PRIMARY KEY,business_name VARCHAR(255),status VARCHAR(20),user_id INT NULL) ENGINE=InnoDB;
 CREATE TABLE community_members (user_id INT,community_id INT,shopping INT,PRIMARY KEY(user_id,community_id)) ENGINE=InnoDB;
 CREATE TABLE community_join_requests (user_id INT,community_id INT,status VARCHAR(20)) ENGINE=InnoDB;
 CREATE TABLE auth_tokens (id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,selector VARCHAR(24),token_hash VARCHAR(64),expires_at DATETIME) ENGINE=InnoDB;
 CREATE TABLE approved_locations (id INT PRIMARY KEY,label VARCHAR(100),community VARCHAR(255),lat DECIMAL(9,6),lng DECIMAL(9,6)) ENGINE=InnoDB;
 CREATE TABLE listings (listing_id INT AUTO_INCREMENT PRIMARY KEY,owner_id INT DEFAULT 1,name VARCHAR(255),category VARCHAR(100),`condition` VARCHAR(50),price DECIMAL(10,2),related_course VARCHAR(100),community VARCHAR(255),meeting_location VARCHAR(255),meeting_location_id INT,description TEXT,image_url VARCHAR(255),status VARCHAR(20),created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
 INSERT INTO users VALUES (1,'local.member','member@example.test','local-only','user'),(2,'local.outsider','outsider@example.test','local-only','user'),(3,'local.partner','partner@example.test','local-only','admin');
 INSERT INTO admin_requests VALUES (5001,'Karavan','approved',NULL),(5002,'Keller Properties LLC','approved',3),(5003,'Pending Community','pending',NULL),(5004,'keller properties llc','approved',NULL);
 INSERT INTO approved_locations VALUES (1,'Baldy 19','Karavan',43.000410,-78.787090),(2,'Bill','Keller Properties LLC',43.000881,-78.787572),(3,'Pending point','Pending Community',43.0,-78.0),(4,'Alias office','keller properties llc',43.0,-78.0);");
 file_put_contents($imagePath,Fixtures::pngBytes());
 $socket=stream_socket_server('tcp://127.0.0.1:0',$errno,$errstr);$address=stream_socket_get_name($socket,false);fclose($socket);$port=(int)substr(strrchr($address,':'),1);
 $env=array_merge(getenv(),['KARAVAN_DB_DSN'=>$dsn.';dbname='.$db,'KARAVAN_DB_HOST'=>'127.0.0.1:'.$match[1],'KARAVAN_DB_NAME'=>$db,'KARAVAN_DB_USER'=>$dbUser,'KARAVAN_DB_PASS'=>$dbPass]);
 $server=proc_open([PHP_BINARY,'-d','session.save_path='.$work.'/sessions','-S','127.0.0.1:'.$port,'-t',$docRoot],[1=>['file',$work.'/server.log','a'],2=>['file',$work.'/server.log','a']],$pipes,$docRoot,$env);
 for($i=0;$i<50;$i++){if($s=@fsockopen('127.0.0.1',$port)){fclose($s);break;}usleep(100000);}
 $sessions=[];foreach([1,2,3,99999] as $id){$sessions[$id]=bin2hex(random_bytes(16));file_put_contents($work.'/sessions/sess_'.$sessions[$id],"user_id|i:$id;");}
 $base=['title'=>'Local access test','category'=>'Other','condition'=>'Good','price'=>'12.00','community'=>'Karavan','meeting_location_id'=>1,'meeting_location'=>'Forged label','description'=>'Local isolated listing test.','image_url'=>'/listing/api/image.php?file='.$image,'owner_id'=>99999];
 $request=function(array|string $body,?int $user=null,string $method='POST',?string $remember=null)use($port,$sessions):array{
  $cookies=[];if($user!==null)$cookies[]='PHPSESSID='.$sessions[$user];if($remember!==null)$cookies[]='karavan_remember='.$remember;
  $curl=curl_init('http://127.0.0.1:'.$port.'/listing/api/create_listing.php');
  curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Cookie: '.implode('; ',$cookies)],CURLOPT_TIMEOUT=>10]);
  if($method==='POST')curl_setopt($curl,CURLOPT_POSTFIELDS,is_array($body)?json_encode($body):$body);
  $raw=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);
  return [$status,json_decode((string)$raw,true)];
 };
 $count=fn()=>(int)$pdo->query('SELECT COUNT(*) FROM listings')->fetchColumn();
 $reject=function(array|string $body,?int $user,int $expected,string $label,?string $remember=null)use($request,$count){$before=$count();[$code,$json]=$request($body,$user,'POST',$remember);checkAccess($code===$expected && ($json['success']??null)===false,"$label: HTTP $expected (received $code)");checkAccess($count()===$before,"$label: no listing inserted");if(in_array($expected,[401,403],true))checkAccess(($json['error']??null)===($expected===401?'You must be logged in.':'You must join this community before creating a listing.'),"$label: documented access error");};
 $reject($base,null,401,'anonymous valid payload');
 $reject('{}',null,401,'anonymous invalid payload still requires authentication');
 $reject($base,99999,401,'deleted/nonexistent session user');
 $reject(array_replace($base,['community'=>'Keller Properties LLC','meeting_location_id'=>2]),2,403,'nonmember of approved Keller');
 $pdo->exec("INSERT INTO community_join_requests VALUES (2,5002,'pending')");
 $reject(array_replace($base,['community'=>'Keller Properties LLC','meeting_location_id'=>2]),2,403,'pending join is not membership');
 [$code,$json]=$request($base,1);checkAccess($code===201 && ($json['listing']['owner_id']??null)===1,'automatic campus member may publish; client owner ignored');
 checkAccess(($json['listing']['meeting_location']??null)==='Baldy 19','trusted location label retained');
 $pdo->exec('INSERT INTO community_members VALUES (1,5002,0)');
 [$code,$json]=$request(array_replace($base,['community'=>'Keller Properties LLC','meeting_location_id'=>2]),1);checkAccess($code===201 && ($json['listing']['owner_id']??null)===1,'joined member may publish with shopping disabled');
 [$code]=$request(array_replace($base,['community'=>'Keller Properties LLC','meeting_location_id'=>2]),3);checkAccess($code===201,'approved community administrator may publish without explicit membership');
 [$code]=$request(array_replace($base,['community'=>'keller properties llc','meeting_location_id'=>4]),1);checkAccess($code===201,'membership covers approved duplicate-name community aliases');
 $reject(array_replace($base,['community'=>'Keller Properties LLC','meeting_location_id'=>1]),1,422,'location from another community');
 $reject(array_replace($base,['community'=>'Pending Community','meeting_location_id'=>3]),1,422,'unapproved community');
 [$code]=$request('{"title":',1);checkAccess($code===400,'authenticated malformed JSON remains HTTP 400');
 [$code]=$request([],null,'GET');checkAccess($code===405,'unsupported method remains HTTP 405');
 $selector=bin2hex(random_bytes(12));$validator=bin2hex(random_bytes(32));$token=$selector.':'.$validator;
 $stmt=$pdo->prepare('INSERT INTO auth_tokens (user_id,selector,token_hash,expires_at) VALUES (2,?,?,?)');$stmt->execute([$selector,hash('sha256',$validator),date('Y-m-d H:i:s',time()+3600)]);
 [$code,$json]=$request($base,null,'POST',$token);checkAccess($code===201 && ($json['listing']['owner_id']??null)===2,'valid remember-me token restores verified owner');
 $reject(array_replace($base,['community'=>'Keller Properties LLC','meeting_location_id'=>2]),null,403,'remembered nonmember is still rejected',$token);
 $pdo->exec("UPDATE auth_tokens SET expires_at='2000-01-01' WHERE user_id=2");$reject($base,null,401,'expired remember token',$token);
}finally{
 if(is_resource($server)){proc_terminate($server);proc_close($server);}
 if(is_file($imagePath))unlink($imagePath);
 unset($stmt,$pdo);$admin->exec("DROP DATABASE IF EXISTS `$db`");$admin->exec("DROP USER IF EXISTS '$dbUser'@'127.0.0.1'");
 if(dirname(realpath($work))!==realpath(sys_get_temp_dir())||!preg_match('/^karavan_listing_access_[a-f0-9]{12}$/',basename($work)))throw new RuntimeException('Unexpected test cleanup target');
 Fixtures::removeDir($work);
}
echo "$checks checks; ".count($failures)." failed.\n";
exit($failures?1:0);
