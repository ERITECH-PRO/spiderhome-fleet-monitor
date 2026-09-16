<?php

namespace App\Services;

use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\Alert;
use App\Models\HeapLog;
use Carbon\Carbon;

class HealthRuleEngine
{
    public const HEALTH_SAIN         = 'sain';
    public const HEALTH_SURVEILLANCE = 'surveillance';
    public const HEALTH_CRITIQUE     = 'critique';

    public const THRESHOLD_SAIN_MIN         = 20.0;
    public const THRESHOLD_SURVEILLANCE_MIN = 10.0;

    /**
     * Évalue l'état de santé complet d'un module et fournit une justification explicite.
     *
     * @param Device $device
     * @param float|null $latestHeapKb
     * @param array $options ['recent_events' => [...], 'active_alerts' => [...]]
     * @return array ['health' => string, 'health_reason' => string, 'heap_zone' => string]
     */
    public static function evaluateDevice(Device $device, ?float $latestHeapKb = null, array $options = []): array
    {
        $fifteenMinutesAgo = Carbon::now()->subMinutes(15);
        $twentyFourHoursAgo = Carbon::now()->subHours(24);

        // 1. Contrôle statut module décommissionné
        if ($device->status === 'retired') {
            return [
                'health'        => self::HEALTH_SAIN,
                'health_reason' => 'Module décommissionné (hors service)',
                'heap_zone'     => 'sain',
            ];
        }

        // 2. Contrôle mémoire Heap critique (< 10 KB)
        if ($latestHeapKb !== null && $latestHeapKb < self::THRESHOLD_SURVEILLANCE_MIN) {
            return [
                'health'        => self::HEALTH_CRITIQUE,
                'health_reason' => "Heap critique : {$latestHeapKb} KB (< 10 KB). Risque de crash WDT.",
                'heap_zone'     => self::HEALTH_CRITIQUE,
            ];
        }

        // 3. Contrôle hors-ligne / événement récents critiques (< 15 min)
        $hasRecentCriticalEvent = false;
        if (isset($options['recent_offline_device_ids'])) {
            $hasRecentCriticalEvent = in_array($device->id, $options['recent_offline_device_ids'], true);
        } else {
            $hasRecentCriticalEvent = DeviceEvent::where('device_id', $device->id)
                ->whereIn('type', [EventNormalizerService::TYPE_SUPLA_OFFLINE, EventNormalizerService::TYPE_WATCHDOG_RESET])
                ->where('occurred_at', '>=', $fifteenMinutesAgo)
                ->exists();
        }

        $isLastSeenStale = $device->last_seen_at && $device->last_seen_at->lt($fifteenMinutesAgo);

        if ($device->status === 'offline' || $hasRecentCriticalEvent || $isLastSeenStale) {
            $reason = match (true) {
                $hasRecentCriticalEvent => 'Déconnexion SUPLA Cloud ou reboot Watchdog détecté (< 15 min)',
                $isLastSeenStale        => 'Signal perdu : aucun contact depuis plus de 15 minutes',
                default                 => 'Module actuellement marqué hors ligne',
            };

            return [
                'health'        => self::HEALTH_CRITIQUE,
                'health_reason' => $reason,
                'heap_zone'     => ($latestHeapKb !== null && $latestHeapKb < 10) ? 'critique' : 'surveillance',
            ];
        }

        // 4. Contrôle zone de surveillance Heap (10 - 20 KB)
        $hasLowHeapWarning = ($latestHeapKb !== null && $latestHeapKb >= self::THRESHOLD_SURVEILLANCE_MIN && $latestHeapKb < self::THRESHOLD_SAIN_MIN);

        // 5. Contrôle alertes récentes actives (< 24h)
        $hasRecentActiveAlert = false;
        if (isset($options['active_alert_device_ids'])) {
            $hasRecentActiveAlert = in_array($device->id, $options['active_alert_device_ids'], true);
        } else {
            $hasRecentActiveAlert = Alert::where('device_id', $device->id)
                ->where('status', 'open')
                ->where('created_at', '>=', $twentyFourHoursAgo)
                ->exists();
        }

        if ($hasLowHeapWarning || $hasRecentActiveAlert || $device->status === 'alert') {
            $reason = match (true) {
                $hasLowHeapWarning    => "Heap sous surveillance : {$latestHeapKb} KB (seuil 10-20 KB)",
                $hasRecentActiveAlert => 'Alerte active non résolue détectée (< 24h)',
                default               => 'Module placé sous surveillance (statut alerte)',
            };

            return [
                'health'        => self::HEALTH_SURVEILLANCE,
                'health_reason' => $reason,
                'heap_zone'     => self::HEALTH_SURVEILLANCE,
            ];
        }

        // 6. État Sain par défaut
        $heapStr = $latestHeapKb !== null ? "Heap: {$latestHeapKb} KB" : "Nominal (> 20 KB)";
        return [
            'health'        => self::HEALTH_SAIN,
            'health_reason' => "Fonctionnement optimal ({$heapStr})",
            'heap_zone'     => self::HEALTH_SAIN,
        ];
    }
}
