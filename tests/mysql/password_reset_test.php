<?php
// Run only against disposable loopback MySQL, never Aptitude/Cattle.
require_once dirname(__DIR__,2).'/backend/includes/password_reset.php';
$dsn=getenv('KARAVAN_RESET_TEST_DSN')?:'';
if(!preg_match('/\Amysql:host=127\.0\.0\.1;port=\d+\z/',$dsn))throw new RuntimeException('Provide a loopback-only KARAVAN_RESET_TEST_DSN.');
$admin=new PDO($dsn,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db='reset_'.bin2hex(random_bytes(6));$checks=0;
function reset_check(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);$checks++;echo "PASS $label\n";}
try{
 $admin->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4");
 $pdo=new PDO($dsn.';dbname='.$db,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $pdo->exec('CREATE TABLE users(id INT PRIMARY KEY,username VARCHAR(100),email VARCHAR(100),password_hash VARCHAR(255),security_q2_index INT NULL,security_a2_hash VARCHAR(255) NULL) ENGINE=InnoDB; CREATE TABLE auth_tokens(id INT PRIMARY KEY,user_id INT) ENGINE=InnoDB');
 $pdo->prepare('INSERT INTO users VALUES (1,?,?,?,2,?)')->execute(['legacy','legacy@example.com',password_hash('Before123!',PASSWORD_BCRYPT),'keep-second-answer']);
 $before=$pdo->query('SELECT * FROM users')->fetch(PDO::FETCH_ASSOC);
 $migration=file_get_contents(dirname(__DIR__,2).'/database/migrations/015_security_question_reset.sql');
 $pdo->exec($migration);$pdo->exec($migration);
 $after=$pdo->query('SELECT * FROM users')->fetch(PDO::FETCH_ASSOC);
 foreach($before as $key=>$value)reset_check($after[$key]===$value,'migration preserves '.$key);
 reset_check($after['security_q1_index']===null&&$after['security_a1_hash']===null,'rerunnable migration leaves legacy question empty');
 $state=[];reset_check(begin_password_reset($pdo,$state,['email'=>'legacy@example.com'],1000)[0]===422,'legacy cannot reset');
 $pdo->prepare('UPDATE users SET security_q1_index=0,security_a1_hash=? WHERE id=1')->execute([security_answer_hash('milo')]);
 reset_check(begin_password_reset($pdo,$state,['email'=>'legacy@example.com'],1000)[0]===200,'MySQL lookup');
 reset_check(verify_reset_answer($pdo,$state,['answer'=>'MiLO'],1001)[0]===200,'MySQL case insensitive answer');
 $stale=$state;reset_check(finish_password_reset($pdo,$state,['password'=>'After123!'],1002)[0]===200,'MySQL transactional reset');
 reset_check(finish_password_reset($pdo,$stale,['password'=>'Wrong123!'],1003)[0]===410,'MySQL stale concurrent grant rejected');
 reset_check(password_verify('After123!',$pdo->query('SELECT password_hash FROM users')->fetchColumn()),'password persisted');
 $stored=$pdo->query('SELECT security_a1_hash FROM users')->fetchColumn();$pdo->exec($migration);
 reset_check($pdo->query('SELECT security_a1_hash FROM users')->fetchColumn()===$stored,'migration preserves configured answer hash');
 reset_check(security_answer_matches('milo',password_hash('milo',PASSWORD_BCRYPT)),'existing direct answer hashes remain supported');
 echo "All $checks MySQL password-reset checks passed.\n";
}finally{$pdo=null;$admin->exec("DROP DATABASE IF EXISTS `$db`");}
