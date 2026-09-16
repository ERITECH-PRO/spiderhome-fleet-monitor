<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Device;
use App\Models\Site;
use App\Models\Customer;
use App\Models\DeviceModel;
use App\Services\HealthRuleEngine;

class HealthRulesTest extends TestCase
{
    use RefreshDatabase;

    private Device $device;

    protected function setUp(): void
    {
        parent::setUp();

        $customer = Customer::create(['name' => 'Acme Test', 'email' => 'acme@test.com']);
        $site = Site::create(['name' => 'Site Acme', 'customer_id' => $customer->id]);
        $model = DeviceModel::create(['name' => 'Node Model', 'mcu' => 'ESP8266']);

        $this->device = Device::create([
            'serial_number' => 'SPDR-HEALTH-01',
            'mac' => 'AA:BB:CC:DD:EE:FF',
            'site_id' => $site->id,
            'model_id' => $model->id,
            'status' => 'online',
            'last_seen_at' => now(),
        ]);
    }

    public function test_health_evaluation_sain(): void
    {
        $eval = HealthRuleEngine::evaluateDevice($this->device, 25.4);
        $this->assertEquals(HealthRuleEngine::HEALTH_SAIN, $eval['health']);
        $this->assertStringContainsString('optimal', strtolower($eval['health_reason']));
    }

    public function test_health_evaluation_surveillance(): void
    {
        $eval = HealthRuleEngine::evaluateDevice($this->device, 14.8);
        $this->assertEquals(HealthRuleEngine::HEALTH_SURVEILLANCE, $eval['health']);
        $this->assertStringContainsString('14.8 kb', strtolower($eval['health_reason']));
    }

    public function test_health_evaluation_critique_low_heap(): void
    {
        $eval = HealthRuleEngine::evaluateDevice($this->device, 8.2);
        $this->assertEquals(HealthRuleEngine::HEALTH_CRITIQUE, $eval['health']);
        $this->assertStringContainsString('< 10 kb', strtolower($eval['health_reason']));
    }

    public function test_health_evaluation_critique_offline_status(): void
    {
        $this->device->update(['status' => 'offline']);
        $eval = HealthRuleEngine::evaluateDevice($this->device, 24.0);
        $this->assertEquals(HealthRuleEngine::HEALTH_CRITIQUE, $eval['health']);
    }
}
