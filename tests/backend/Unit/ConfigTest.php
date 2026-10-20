<?php
namespace Karavan\Tests\Unit;

use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 3) . '/backend/includes/config.php';

// Configuration is cached per request, so each precedence test starts a fresh process.
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class ConfigTest extends TestCase
{
    public function testStandardPasswordEnvironmentOverridesLegacyAlias(): void
    {
        putenv('KARAVAN_DB_PASS=standard-test-value');
        putenv('KARAVAN_DB_PASSWORD=legacy-test-value');
        $this->assertSame('standard-test-value', karavan_config()['db_pass']);
    }

    public function testLegacyPasswordEnvironmentRemainsSupported(): void
    {
        putenv('KARAVAN_DB_PASS');
        putenv('KARAVAN_DB_PASSWORD=legacy-test-value');
        $this->assertSame('legacy-test-value', karavan_config()['db_pass']);
    }

    public function testZeroIsNotMistakenForAnUnsetEnvironmentValue(): void
    {
        putenv('KARAVAN_DB_PASS=0');
        putenv('KARAVAN_DB_PASSWORD=legacy-test-value');
        $this->assertSame('0', karavan_config()['db_pass']);
    }
}
