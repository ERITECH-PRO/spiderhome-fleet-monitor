<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\Site;
use App\Models\Customer;
use App\Models\DeviceModel;
use App\Services\EventNormalizerService;

class EventNormalizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_event_normalizer_service_type_and_severity(): void
    {
        $this->assertEquals('WATCHDOG_RESET', EventNormalizerService::normalizeType('wdt_reset'));
        $this->assertEquals('LOW_HEAP', EventNormalizerService::normalizeType('heap_warning'));
        $this->assertEquals('WIFI_LOST', EventNormalizerService::normalizeType('wifi_disconnect'));
        $this->assertEquals('SUPLA_OFFLINE', EventNormalizerService::normalizeType('supla_down'));
        $this->assertEquals('BOOT', EventNormalizerService::normalizeType('boot_system'));
        $this->assertEquals('UPDATE_REQUIRED', EventNormalizerService::normalizeType('ota_update'));

        $this->assertEquals('critical', EventNormalizerService::normalizeSeverity('critique'));
        $this->assertEquals('warning', EventNormalizerService::normalizeSeverity('warn'));
        $this->assertEquals('info', EventNormalizerService::normalizeSeverity('notice'));

        // Heap < 10 KB forces critical severity for LOW_HEAP
        $this->assertEquals('critical', EventNormalizerService::normalizeSeverity('warning', 'LOW_HEAP', 8.4));
        $this->assertEquals('warning', EventNormalizerService::normalizeSeverity('warning', 'LOW_HEAP', 14.5));
    }

    public function test_artisan_events_normalize_command(): void
    {
        $customer = Customer::create(['name' => 'Test Customer', 'email' => 'test@customer.com']);
        $site = Site::create(['name' => 'Test Site', 'customer_id' => $customer->id]);
        $model = DeviceModel::create(['name' => 'Test Model', 'mcu' => 'ESP8266']);

        $device = Device::create([
            'serial_number' => 'SPDR-TEST-01',
            'mac' => '11:22:33:44:55:66',
            'site_id' => $site->id,
            'model_id' => $model->id,
            'status' => 'online'
        ]);

        DeviceEvent::create([
            'device_id' => $device->id,
            'type' => 'wdt_reset',
            'severity' => 'critique',
            'value' => 'WDT timeout',
            'message' => 'Watchdog triggered',
            'occurred_at' => now()
        ]);

        DeviceEvent::create([
            'device_id' => $device->id,
            'type' => 'heap_drop',
            'severity' => 'warn',
            'value' => 'FreeHeap: 7.5 KB',
            'message' => '',
            'occurred_at' => now()
        ]);

        $this->artisan('events:normalize')
            ->assertExitCode(0);

        $event1 = DeviceEvent::where('device_id', $device->id)->first();
        $this->assertEquals('WATCHDOG_RESET', $event1->type);
        $this->assertEquals('critical', $event1->severity);

        $event2 = DeviceEvent::where('device_id', $device->id)->orderByDesc('id')->first();
        $this->assertEquals('LOW_HEAP', $event2->type);
        $this->assertEquals('critical', $event2->severity);
        $this->assertStringContainsString('Heap critique', $event2->message);
    }
}
