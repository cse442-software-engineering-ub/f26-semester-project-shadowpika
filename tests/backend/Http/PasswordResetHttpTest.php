<?php
namespace Karavan\Tests\Http;

use Karavan\Tests\Support\Fixtures;
use Karavan\Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

final class PasswordResetHttpTest extends TestCase
{
    private static $server;
    private static string $work;
    private static string $url;
    private PDO $pdo;
    public static function setUpBeforeClass(): void
    {
        self::$work = Fixtures::tempDir('karavan_reset_http_'); mkdir(self::$work.'/sessions');
        $socket=stream_socket_server('tcp://127.0.0.1:0'); $address=stream_socket_get_name($socket,false); fclose($socket);
        self::$url='http://'.$address;
        $env=array_merge(getenv(),['KARAVAN_DB_DSN'=>'sqlite:'.self::$work.'/test.sqlite']);
        $null=PHP_OS_FAMILY==='Windows'?'NUL':'/dev/null';
        self::$server=proc_open([PHP_BINARY,'-d','session.save_path='.self::$work.'/sessions','-S',$address,'-t',dirname(__DIR__,3).'/deploy'],[1=>['file',$null,'w'],2=>['file',$null,'w']],$pipes,null,$env);
        for($i=0;$i<50;$i++){if(@fsockopen('127.0.0.1',(int)substr($address,strrpos($address,':')+1)))return;usleep(100000);}
        self::fail('Reset HTTP test server did not start');
    }
    public static function tearDownAfterClass(): void
    {
        if(is_resource(self::$server)){proc_terminate(self::$server);proc_close(self::$server);}
        Fixtures::removeDir(self::$work);
    }
    private function fresh(): void
    {
        @unlink(self::$work.'/test.sqlite');
        foreach(glob(self::$work.'/*.cookies') as $file) unlink($file);
        $this->pdo=TestDatabase::create('sqlite:'.self::$work.'/test.sqlite');
    }
    private function request(string $path,array|string $body=[],string $jar='a',string $method='POST'): array
    {
        $file=self::$work.'/'.$jar.'.cookies'; $ch=curl_init(self::$url.'/'.$path);
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_COOKIEFILE=>$file,CURLOPT_COOKIEJAR=>$file,CURLOPT_POSTFIELDS=>is_string($body)?$body:json_encode($body)]);
        $raw=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
        return [$status,json_decode((string)$raw,true)];
    }
    private function register(string $name='student'): string
    {
        $email=$name.'@example.com';
        [$status,$body]=$this->request('register.php',['username'=>$name,'email'=>$email,'password'=>'Before123!','security_question'=>0,'security_answer'=>'MiLo']);
        self::assertSame(200,$status);self::assertTrue($body['success']);return $email;
    }
    public function testCompleteFlowUsesCookiesAndVerifiesActualLogin(): void
    {
        $this->fresh();$email=$this->register();
        [$status,$body]=$this->request('forgot_password.php',['email'=>$email]);
        self::assertSame([200,['success'=>true,'question_id'=>0,'question'=>'What was the name of your first pet?']],[$status,$body]);
        self::assertSame(403,$this->request('verify_security_answer.php',['answer'=>'wrong'])[0]);
        self::assertSame(200,$this->request('verify_security_answer.php',['answer'=>' mILO '])[0]);
        self::assertSame(200,$this->request('reset_password.php',['password'=>'After123!'])[0]);
        self::assertFalse($this->request('login.php',['email'=>$email,'password'=>'Before123!'])[1]['success']);
        self::assertTrue($this->request('login.php',['email'=>$email,'password'=>'After123!'])[1]['success']);
        self::assertSame(410,$this->request('reset_password.php',['password'=>'Another123!'])[0]);
        $stored=$this->pdo->query('SELECT security_a1_hash FROM users')->fetchColumn();
        self::assertTrue(security_answer_matches('milo',$stored));
    }
    public function testCrossSessionAndAccountIdsCannotAuthorizeReset(): void
    {
        $this->fresh();$a=$this->register('alice');$b=$this->register('bob');
        $this->request('forgot_password.php',['email'=>$a]);$this->request('verify_security_answer.php',['answer'=>'milo']);
        self::assertSame(410,$this->request('reset_password.php',['password'=>'Bad'],'b')[0]);
        self::assertSame(400,$this->request('reset_password.php',['password'=>'Bad','user_id'=>2])[0]);
        $this->request('forgot_password.php',['email'=>$b]);
        self::assertSame(410,$this->request('reset_password.php',['password'=>'Bad'])[0]);
        foreach([$a,$b] as $email)self::assertTrue($this->request('login.php',['email'=>$email,'password'=>'Before123!'])[1]['success']);
    }
    public function testRegistrationRejectsMissingAnswerAndInvalidTypes(): void
    {
        $this->fresh();
        foreach([null,'   ',[],str_repeat('a',101)] as $answer){
            [$status,$body]=$this->request('register.php',['username'=>'bad','email'=>'bad@example.com','password'=>'P','security_question'=>0,'security_answer'=>$answer]);
            self::assertSame(400,$status);self::assertFalse($body['success']);
        }
        self::assertSame(0,(int)$this->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
    }
    public function testUnknownLegacyAmbiguousMalformedAndWrongMethods(): void
    {
        $this->fresh();
        self::assertSame(422,$this->request('forgot_password.php',['email'=>'missing@example.com'])[0]);
        TestDatabase::addUser($this->pdo,'legacy','user','legacy@example.com');
        self::assertSame(422,$this->request('forgot_password.php',['email'=>'legacy@example.com'])[0]);
        TestDatabase::addUser($this->pdo,'duplicate','user','legacy@example.com');
        self::assertSame(409,$this->request('forgot_password.php',['email'=>'legacy@example.com'])[0]);
        foreach(['forgot_password.php','verify_security_answer.php','reset_password.php'] as $path){
            self::assertSame(405,$this->request($path,[],'a','GET')[0]);
            self::assertSame(400,$this->request($path,'{broken')[0]);
            self::assertSame(400,$this->request($path,'[]')[0]);
        }
    }
}
