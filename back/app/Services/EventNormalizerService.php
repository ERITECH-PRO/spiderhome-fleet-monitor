<?php

namespace App\Services;

class EventNormalizerService
{
    /**
     * Liste des types d'événements canoniques
     */
    public const TYPE_BOOT            = 'BOOT';
    public const TYPE_WATCHDOG_RESET  = 'WATCHDOG_RESET';
    public const TYPE_LOW_HEAP        = 'LOW_HEAP';
    public const TYPE_WIFI_LOST       = 'WIFI_LOST';
    public const TYPE_SUPLA_OFFLINE   = 'SUPLA_OFFLINE';
    public const TYPE_UPDATE_REQUIRED = 'UPDATE_REQUIRED';

    /**
     * Types supportés et leurs labels lisibles
     */
    public const CANONICAL_TYPES = [
        self::TYPE_BOOT            => 'BOOT (Démarrage)',
        self::TYPE_WATCHDOG_RESET  => 'WATCHDOG_RESET (Chien de garde)',
        self::TYPE_LOW_HEAP        => 'LOW_HEAP (Mémoire faible)',
        self::TYPE_WIFI_LOST       => 'WIFI_LOST (Wi-Fi)',
        self::TYPE_SUPLA_OFFLINE   => 'SUPLA_OFFLINE (Serveur SUPLA)',
        self::TYPE_UPDATE_REQUIRED => 'UPDATE_REQUIRED (Mise à jour)',
    ];

    /**
     * Normalise un type d'événement (brut ou legacy) vers un type canonique.
     */
    public static function normalizeType(?string $rawType): string
    {
        if (!$rawType) {
            return self::TYPE_BOOT;
        }

        $cleaned = strtoupper(trim($rawType));

        if (array_key_exists($cleaned, self::CANONICAL_TYPES)) {
            return $cleaned;
        }

        // Mappings des formats legacy et synonymes courants
        return match (true) {
            str_contains($cleaned, 'WDT') || str_contains($cleaned, 'WATCHDOG') || str_contains($cleaned, 'REBOOT_WDT') => self::TYPE_WATCHDOG_RESET,
            str_contains($cleaned, 'BOOT') || str_contains($cleaned, 'START') || str_contains($cleaned, 'INIT') => self::TYPE_BOOT,
            str_contains($cleaned, 'HEAP') || str_contains($cleaned, 'MEMORY') || str_contains($cleaned, 'MEM_LOW') || str_contains($cleaned, 'RAM') => self::TYPE_LOW_HEAP,
            str_contains($cleaned, 'WIFI') || str_contains($cleaned, 'DISCONNECT') || str_contains($cleaned, 'NETWORK_LOST') => self::TYPE_WIFI_LOST,
            str_contains($cleaned, 'SUPLA') || str_contains($cleaned, 'OFFLINE') || str_contains($cleaned, 'CLOUD_LOST') => self::TYPE_SUPLA_OFFLINE,
            str_contains($cleaned, 'UPDATE') || str_contains($cleaned, 'FIRMWARE') || str_contains($cleaned, 'OTA') => self::TYPE_UPDATE_REQUIRED,
            default => self::TYPE_BOOT,
        };
    }

    /**
     * Normalise la gravité (severity) vers 'info', 'warning', 'critical', ou 'error'.
     */
    public static function normalizeSeverity(?string $rawSeverity, string $canonicalType = '', $value = null): string
    {
        $sev = strtolower(trim($rawSeverity ?? ''));

        // Contextual override: LOW_HEAP with heap_kb < 10.0 KB must be critical
        if ($canonicalType === self::TYPE_LOW_HEAP && $value !== null) {
            $heapKb = self::extractHeapKb($value);
            if ($heapKb !== null) {
                return ($heapKb < 10.0) ? 'critical' : 'warning';
            }
        }

        // Direct mapping
        $mapped = match ($sev) {
            'critical', 'crit', 'critique', 'fatal', 'panic', 'danger' => 'critical',
            'warning', 'warn', 'vigilance', 'surveillance', 'attention' => 'warning',
            'error', 'err', 'erreur', 'failed', 'failure' => 'error',
            'info', 'informational', 'notice', 'ok', 'success' => 'info',
            default => null,
        };

        if ($mapped) {
            return $mapped;
        }

        // Fallback selon le type d'événement
        return match ($canonicalType) {
            self::TYPE_WATCHDOG_RESET, self::TYPE_SUPLA_OFFLINE => 'critical',
            self::TYPE_LOW_HEAP, self::TYPE_WIFI_LOST           => 'warning',
            self::TYPE_BOOT, self::TYPE_UPDATE_REQUIRED          => 'info',
            default                                              => 'info',
        };
    }

    /**
     * Génère un message clair si non fourni ou à reformater.
     */
    public static function normalizeMessage(string $canonicalType, ?string $message = null, $value = null): string
    {
        if ($message && strlen(trim($message)) > 3) {
            return trim($message);
        }

        $heapKb = self::extractHeapKb($value);

        return match ($canonicalType) {
            self::TYPE_BOOT            => 'Démarrage normal du système et initialisation des services.',
            self::TYPE_WATCHDOG_RESET  => 'Redémarrage d\'urgence déclenché par le chien de garde (WDT).',
            self::TYPE_LOW_HEAP        => $heapKb !== null
                ? ($heapKb < 10.0 ? "Niveau de mémoire Heap critique : {$heapKb} KB (< 10 KB)." : "Mémoire Heap sous surveillance : {$heapKb} KB (10-20 KB).")
                : 'Baisse importante de mémoire Heap disponible.',
            self::TYPE_WIFI_LOST       => 'Perte de signal Wi-Fi ou micro-déconnexion détectée.',
            self::TYPE_SUPLA_OFFLINE   => 'Interruption de la connexion avec le serveur SUPLA Cloud.',
            self::TYPE_UPDATE_REQUIRED => 'Une mise à jour firmware recommandée est disponible pour ce module.',
            default                    => 'Événement système enregistré.',
        };
    }

    /**
     * Extrait la valeur numérique de heap_kb depuis une chaîne ou un objet JSON/Array.
     */
    public static function extractHeapKb($value): ?float
    {
        if ($value === null) {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        if (is_array($value) && isset($value['heap_kb'])) {
            return (float) $value['heap_kb'];
        }

        if (is_string($value)) {
            // Tenter le décodage JSON
            $json = json_decode($value, true);
            if (is_array($json) && isset($json['heap_kb'])) {
                return (float) $json['heap_kb'];
            }

            // Extraction regex (ex: "FreeHeap: 8.5 KB" ou "heap_kb=14.2")
            if (preg_match('/(?:heap|freeheap)[^\d]*([\d\.]+)/i', $value, $matches)) {
                return (float) $matches[1];
            }
        }

        return null;
    }

    /**
     * Normalise complètement un tableau représentant un événement.
     */
    public static function normalizeEvent(array $eventData): array
    {
        $canonicalType = self::normalizeType($eventData['type'] ?? '');
        $canonicalSeverity = self::normalizeSeverity(
            $eventData['severity'] ?? null,
            $canonicalType,
            $eventData['value'] ?? null
        );
        $canonicalMessage = self::normalizeMessage(
            $canonicalType,
            $eventData['message'] ?? null,
            $eventData['value'] ?? null
        );

        return [
            'type'        => $canonicalType,
            'severity'    => $canonicalSeverity,
            'message'     => $canonicalMessage,
            'value'       => $eventData['value'] ?? null,
            'occurred_at' => $eventData['occurred_at'] ?? now(),
        ];
    }
}
