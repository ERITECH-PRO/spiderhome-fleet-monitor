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
     * @return array ['health' => string, 'health_reason' => string, 'heap_zone' => string,
     *                'health_score' => int (0-100), 'score_breakdown' => array]
     */
    public static function evaluateDevice(Device $device, ?float $latestHeapKb = null, array $options = []): array
    {
        $zone = self::resolveZone($device, $latestHeapKb, $options);

        return $zone + self::scoreDevice($device, $latestHeapKb, $options, $zone['health']);
    }

    /**
     * Logique catégorielle d'origine (sain / surveillance / critique),
     * inchangée — voir evaluateDevice() pour la composition avec le score.
     */
    private static function resolveZone(Device $device, ?float $latestHeapKb, array $options): array
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

    /**
     * Score de santé explicable, 0 à 100 — cahier des charges §7.2 :
     * « Calculer un score de santé de 0 à 100 accompagné des raisons et
     *   seuils appliqués. »
     *
     * Système de déductions à partir de 100 points, plafonné à 0. Chaque
     * déduction est nommée dans `score_breakdown` pour que l'interface
     * puisse afficher exactement pourquoi le score n'est pas 100 — jamais
     * une boîte noire.
     */
    private static function scoreDevice(Device $device, ?float $latestHeapKb, array $options, string $zone): array
    {
        if ($device->status === 'retired') {
            return ['health_score' => null, 'score_breakdown' => []];
        }

        $score = 100;
        $breakdown = [];

        $deduct = function (int $points, string $reason) use (&$score, &$breakdown) {
            $score -= $points;
            $breakdown[] = ['points' => -$points, 'reason' => $reason];
        };

        // Mémoire disponible
        if ($latestHeapKb !== null) {
            if ($latestHeapKb < self::THRESHOLD_SURVEILLANCE_MIN) {
                $deduct(50, 'Heap critique : ' . $latestHeapKb . ' KB (< ' . self::THRESHOLD_SURVEILLANCE_MIN . ' KB)');
            } elseif ($latestHeapKb < self::THRESHOLD_SAIN_MIN) {
                $deduct(20, 'Heap sous surveillance : ' . $latestHeapKb . ' KB (< ' . self::THRESHOLD_SAIN_MIN . ' KB)');
            }
        }

        $fifteenMinutesAgo = Carbon::now()->subMinutes(15);
        $twentyFourHoursAgo = Carbon::now()->subHours(24);

        // Connectivité
        $isLastSeenStale = $device->last_seen_at && $device->last_seen_at->lt($fifteenMinutesAgo);
        if ($device->status === 'offline' || $isLastSeenStale) {
            $deduct(40, 'Module hors ligne : aucun contact depuis plus de 15 minutes');
        }

        // Événements critiques récents (24h), par type — cahier §7.3
        $recentCritical = DeviceEvent::where('device_id', $device->id)
            ->where('occurred_at', '>=', $twentyFourHoursAgo)
            ->where('severity', 'critical')
            ->selectRaw('type, COUNT(*) as n')
            ->groupBy('type')
            ->pluck('n', 'type');

        foreach ($recentCritical as $type => $count) {
            $penalty = match ($type) {
                EventNormalizerService::TYPE_MOTOR_SAFETY_EVENT => 40, // priorité maximale (cahier §7.3)
                EventNormalizerService::TYPE_WATCHDOG_RESET,
                EventNormalizerService::TYPE_BROWNOUT,
                EventNormalizerService::TYPE_LITTLEFS_ERROR,
                EventNormalizerService::TYPE_UPDATE_FAILED,
                EventNormalizerService::TYPE_ROLLBACK => 25,
                default => 10,
            };
            $label = EventNormalizerService::CANONICAL_TYPES[$type] ?? $type;
            $deduct(
                min($penalty * $count, $penalty * 2), // plafonné à 2x le poids unitaire, même si répété plus souvent
                "{$count}× {$label} (critique) sur 24h"
            );
        }

        // Alerte(s) ouverte(s)
        $openAlerts = Alert::where('device_id', $device->id)
            ->where('status', 'open')
            ->where('created_at', '>=', $twentyFourHoursAgo)
            ->count();
        if ($openAlerts > 0) {
            $deduct(15, "{$openAlerts} alerte(s) ouverte(s) sur les dernières 24h");
        }

        $score = max(0, min(100, $score));

        return [
            'health_score'    => $score,
            'score_breakdown' => $breakdown,
        ];
    }
}
