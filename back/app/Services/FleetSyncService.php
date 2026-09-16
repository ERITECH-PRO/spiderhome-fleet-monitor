<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\Customer;
use App\Models\Device;
use App\Models\DeviceModel;
use App\Models\Site;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * FleetSyncService
 * ────────────────────────────────────────────────────────────────────────────
 * Alimente le registre métier (customers / sites / device_models / devices)
 * à partir des tables legacy écrites par le collecteur Express :
 *
 *   module_installs  → identité du module + compte client (email) + serveur
 *   heap_logs        → télémétrie : heap, fragmentation, uptime, statut
 *
 * C'est le cœur du fonctionnement « automatique » de la plateforme :
 * un module configuré via son point d'accès (192.168.4.1) envoie son e-mail
 * et son adresse serveur, puis apparaît seul dans l'interface. Aucune saisie
 * manuelle n'est requise.
 *
 * ⚠️  Lecture seule sur les tables legacy : ce service n'y écrit jamais.
 */
class FleetSyncService
{
    private string $legacy;

    public function __construct()
    {
        $this->legacy = config('database.heap_connection', 'heap_monitoring');
    }

    /**
     * Exécute une passe complète de synchronisation.
     *
     * @return array<string,int> compteurs pour le log / la commande artisan
     */
    public function run(): array
    {
        $stats = [
            'customers_created' => 0,
            'sites_created'     => 0,
            'models_created'    => 0,
            'devices_created'   => 0,
            'devices_updated'   => 0,
            'alerts_opened'     => 0,
            'alerts_resolved'   => 0,
        ];

        $this->syncInstalls($stats);
        $this->syncTelemetry($stats);

        return $stats;
    }

    /**
     * Crée à la volée un module (et son client / site / modèle) à partir d'une
     * déclaration directe du module. Utilisé par POST /api/ingest/status.
     */
    public function provisionDevice(string $key, ?string $deviceName = null, ?string $email = null, ?string $server = null): Device
    {
        $stats = [
            'customers_created' => 0,
            'sites_created'     => 0,
            'models_created'    => 0,
        ];

        $customer = $this->resolveCustomer($email, $server, $stats);
        $site     = $this->resolveSite($customer, $stats);
        $model    = $this->resolveModel($deviceName ?: $this->guessModelName($key), $stats);

        return Device::create([
            'legacy_device_key' => $key,
            'serial_number'     => $key,
            'site_id'           => $site->id,
            'model_id'          => $model->id,
            'label'             => $deviceName ?: $key,
            'supla_server'      => $server ?: null,
            'status'            => 'online',
            'auto_provisioned'  => true,
            'first_seen_at'     => now(),
        ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 1. Identité : module_installs → customers / sites / models / devices
    // ────────────────────────────────────────────────────────────────────────

    private function syncInstalls(array &$stats): void
    {
        // Dernière déclaration d'installation connue pour chaque module.
        $installs = DB::connection($this->legacy)
            ->table('module_installs as mi')
            ->select('mi.device', 'mi.device_name', 'mi.firmware', 'mi.mac', 'mi.supla_server', 'mi.email', 'mi.timestamp')
            ->whereIn('mi.id', function ($q) {
                $q->selectRaw('MAX(id)')->from('module_installs')->groupBy('device');
            })
            ->get();

        foreach ($installs as $install) {
            $key = trim((string) $install->device);
            if ($key === '') {
                continue;
            }

            $customer = $this->resolveCustomer($install->email, $install->supla_server, $stats);
            $site     = $this->resolveSite($customer, $stats);
            $model    = $this->resolveModel($install->device_name ?: $this->guessModelName($key), $stats);

            $device = Device::where('legacy_device_key', $key)
                ->orWhere('serial_number', $key)
                ->first();

            $payload = [
                'legacy_device_key' => $key,
                'serial_number'     => $key,
                'model_id'          => $model->id,
                'mac'               => $install->mac ?: null,
                'firmware'          => $install->firmware ?: null,
                'supla_server'      => $install->supla_server ?: null,
            ];

            if (! $device) {
                $device = new Device($payload + [
                    'site_id'          => $site->id,
                    'label'            => $install->device_name ?: $key,
                    'status'           => 'offline',
                    'auto_provisioned' => true,
                    'first_seen_at'    => $install->timestamp ?: now(),
                ]);
                $device->save();
                $stats['devices_created']++;
                continue;
            }

            // Un module déjà rattaché manuellement à un site n'est pas déplacé :
            // l'opérateur reste maître de l'affectation.
            if ($device->auto_provisioned && $device->site?->customer_id !== $customer->id) {
                $payload['site_id'] = $site->id;
            }

            $device->fill($payload);
            if ($device->isDirty()) {
                $device->save();
                $stats['devices_updated']++;
            }
        }
    }

    private function resolveCustomer(?string $email, ?string $server, array &$stats): Customer
    {
        $email = trim((string) $email);

        if ($email === '' || ! config('spiderhome.sync.auto_create_customers')) {
            return $this->unassignedCustomer($stats);
        }

        $customer = Customer::withTrashed()->where('email', $email)->first();

        if (! $customer) {
            $customer = Customer::create([
                'name'             => Str::before($email, '@') ?: $email,
                'email'            => $email,
                'server_address'   => $server ?: null,
                'status'           => 'active',
                'auto_provisioned' => true,
                'notes'            => 'Client créé automatiquement depuis la déclaration du module.',
            ]);
            $stats['customers_created']++;

            return $customer;
        }

        // Mise à jour de l'adresse serveur si le module en déclare une nouvelle.
        if ($server && $customer->server_address !== $server && $customer->auto_provisioned) {
            $customer->update(['server_address' => $server]);
        }

        return $customer;
    }

    private function unassignedCustomer(array &$stats): Customer
    {
        $name = config('spiderhome.sync.unassigned_customer_name');

        $customer = Customer::where('name', $name)->first();

        if (! $customer) {
            $customer = Customer::create([
                'name'             => $name,
                'status'           => 'active',
                'auto_provisioned' => true,
                'notes'            => "Modules dont l'e-mail du compte client n'a pas encore été déclaré.",
            ]);
            $stats['customers_created']++;
        }

        return $customer;
    }

    private function resolveSite(Customer $customer, array &$stats): Site
    {
        $site = Site::where('customer_id', $customer->id)->orderBy('id')->first();

        if (! $site) {
            $site = Site::create([
                'customer_id'      => $customer->id,
                'name'             => config('spiderhome.sync.default_site_name'),
                'auto_provisioned' => true,
            ]);
            $stats['sites_created']++;
        }

        return $site;
    }

    private function resolveModel(string $name, array &$stats): DeviceModel
    {
        $name = trim($name) ?: 'Inconnu';

        $model = DeviceModel::where('name', $name)->first();

        if (! $model) {
            $model = DeviceModel::create([
                'name'         => $name,
                'mcu'          => 'ESP8266',
                'ota_capable'  => false, // aucune OTA tant que la matrice n'est pas validée par Eric
                'manufacturer' => 'SpiderHome',
            ]);
            $stats['models_created']++;
        }

        return $model;
    }

    /** Déduit un nom de modèle depuis la clé « Spider_S10_E8DA91 ». */
    private function guessModelName(string $key): string
    {
        return preg_replace('/_[0-9A-F]{6}$/i', '', $key) ?: $key;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. Télémétrie : heap_logs → état courant + alertes
    // ────────────────────────────────────────────────────────────────────────

    private function syncTelemetry(array &$stats): void
    {
        $lookback = (int) config('spiderhome.sync.telemetry_lookback_hours', 72);

        $sub = DB::connection($this->legacy)
            ->table('heap_logs')
            ->selectRaw('MAX(id) as id')
            ->groupBy('device');

        if ($lookback > 0) {
            $sub->where('timestamp', '>=', now()->subHours($lookback));
        }

        $latest = DB::connection($this->legacy)
            ->table('heap_logs')
            ->whereIn('id', $sub)
            ->get()
            ->keyBy(fn ($row) => (string) $row->device);

        $offlineAfter = (int) config('spiderhome.offline_after_minutes', 30);

        Device::with('site')->chunkById(200, function ($devices) use ($latest, $offlineAfter, &$stats) {
            foreach ($devices as $device) {
                $row = $latest[$device->legacy_device_key] ?? $latest[$device->serial_number] ?? null;

                if (! $row) {
                    // Aucune mesure récente : le module est hors ligne.
                    if ($device->status !== 'retired' && $device->status !== 'offline') {
                        $device->update(['status' => 'offline']);
                        $stats['devices_updated']++;
                    }
                    $this->handleOfflineAlert($device, $stats);
                    continue;
                }

                $seenAt   = $this->rowTimestamp($row);
                $heapB    = $this->heapBytes($row);
                $severity = $this->severityFor($row, $heapB);

                $isOnline = $seenAt && $seenAt->gt(now()->subMinutes($offlineAfter));
                $status   = $device->status === 'retired'
                    ? 'retired'
                    : (! $isOnline ? 'offline' : ($severity === 'critical' ? 'alert' : 'online'));

                $device->fill([
                    'status'        => $status,
                    'last_seen_at'  => $seenAt,
                    'last_heap_kb'  => $heapB !== null ? round($heapB / 1024, 2) : null,
                    'last_frag_pct' => $row->frag_pct ?? $row->frag ?? null,
                    'last_uptime'   => $row->uptime ?? null,
                    'last_status'   => $this->normalizeStatus($row, $severity),
                ]);

                if ($device->first_seen_at === null) {
                    $device->first_seen_at = $seenAt;
                }

                if ($device->isDirty()) {
                    $device->save();
                    $stats['devices_updated']++;
                }

                $this->reconcileHealthAlert($device, $severity, $heapB, $stats);
                if ($isOnline) {
                    $this->resolveAlerts($device, 'offline', $stats);
                } else {
                    $this->handleOfflineAlert($device, $stats);
                }
            }
        });
    }

    private function rowTimestamp(object $row): ?Carbon
    {
        $raw = $row->timestamp ?? $row->created_at ?? null;

        return $raw ? Carbon::parse($raw) : null;
    }

    /** Heap disponible en octets, quelle que soit la variante de colonne. */
    private function heapBytes(object $row): ?float
    {
        foreach (['heap_effective', 'heap'] as $col) {
            if (isset($row->$col) && is_numeric($row->$col)) {
                return (float) $row->$col;
            }
        }

        if (isset($row->heap_kb) && is_numeric($row->heap_kb)) {
            return ((float) $row->heap_kb) * 1024;
        }

        return null;
    }

    /** Applique les mêmes règles que le collecteur Express. */
    private function severityFor(object $row, ?float $heapBytes): string
    {
        $raw = strtoupper(trim((string) ($row->status ?? $row->level ?? '')));

        if (in_array($raw, ['CRITICAL', 'CRIT', 'FATAL'], true)) {
            return 'critical';
        }
        if (in_array($raw, ['WARNING', 'WARN'], true)) {
            return 'warning';
        }

        if ($heapBytes !== null) {
            if ($heapBytes < config('spiderhome.heap_critical_bytes')) {
                return 'critical';
            }
            if ($heapBytes <= config('spiderhome.heap_warning_bytes')) {
                return 'warning';
            }
        }

        $frag = $row->frag_pct ?? $row->frag ?? null;
        if (is_numeric($frag) && $frag >= config('spiderhome.frag_warning_pct')) {
            return 'warning';
        }

        return 'info';
    }

    private function normalizeStatus(object $row, string $severity): string
    {
        return match ($severity) {
            'critical' => 'CRITICAL',
            'warning'  => 'WARNING',
            default    => 'OK',
        };
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. Alertes
    // ────────────────────────────────────────────────────────────────────────

    private function reconcileHealthAlert(Device $device, string $severity, ?float $heapBytes, array &$stats): void
    {
        if ($severity === 'info') {
            $this->resolveAlerts($device, 'heap_low', $stats);

            return;
        }

        $open = Alert::where('device_id', $device->id)
            ->where('type', 'heap_low')
            ->whereIn('status', ['open', 'acknowledged'])
            ->first();

        $message = $heapBytes !== null
            ? sprintf('Heap disponible %s octets (%s ko).', (int) $heapBytes, round($heapBytes / 1024, 2))
            : 'Mémoire disponible sous le seuil configuré.';

        if ($open) {
            if ($open->severity !== $severity) {
                $open->update(['severity' => $severity, 'message' => $message]);
            }

            return;
        }

        Alert::create([
            'device_id' => $device->id,
            'type'      => 'heap_low',
            'severity'  => $severity,
            'message'   => $message,
            'status'    => 'open',
        ]);
        $stats['alerts_opened']++;
    }

    private function handleOfflineAlert(Device $device, array &$stats): void
    {
        if ($device->status === 'retired') {
            return;
        }

        $exists = Alert::where('device_id', $device->id)
            ->where('type', 'offline')
            ->whereIn('status', ['open', 'acknowledged'])
            ->exists();

        if ($exists) {
            return;
        }

        Alert::create([
            'device_id' => $device->id,
            'type'      => 'offline',
            'severity'  => 'warning',
            'message'   => sprintf(
                'Aucune télémétrie depuis plus de %d minutes.',
                (int) config('spiderhome.offline_after_minutes')
            ),
            'status'    => 'open',
        ]);
        $stats['alerts_opened']++;
    }

    private function resolveAlerts(Device $device, string $type, array &$stats): void
    {
        $count = Alert::where('device_id', $device->id)
            ->where('type', $type)
            ->whereIn('status', ['open', 'acknowledged'])
            ->update(['status' => 'resolved', 'resolved_at' => now()]);

        $stats['alerts_resolved'] += $count;
    }
}
