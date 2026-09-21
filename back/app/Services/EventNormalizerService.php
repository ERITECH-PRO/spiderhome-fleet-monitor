<?php

namespace App\Services;

/**
 * Catalogue d'événements — cahier des charges §7.3 « Événements et incidents ».
 *
 * « Les événements utilisent un code normalisé, pas uniquement du texte
 *   libre. » Ce service fait le pont entre le texte libre que le firmware
 * écrit réellement dans heap_logs (colonnes event/status/level) et ce
 * catalogue normalisé, avec la gravité par défaut donnée par le cahier.
 */
class EventNormalizerService
{
    // ── Types canoniques — table exacte du cahier des charges §7.3 ──────────
    public const TYPE_BOOT               = 'BOOT';
    public const TYPE_RESTART_REQUESTED  = 'RESTART_REQUESTED';
    public const TYPE_WATCHDOG_RESET     = 'WATCHDOG_RESET';
    public const TYPE_BROWNOUT           = 'BROWNOUT';
    public const TYPE_LOW_HEAP           = 'LOW_HEAP';
    public const TYPE_HIGH_FRAGMENTATION = 'HIGH_FRAGMENTATION';
    public const TYPE_WIFI_FLAPPING      = 'WIFI_FLAPPING';
    public const TYPE_SUPLA_OFFLINE      = 'SUPLA_OFFLINE';
    public const TYPE_LITTLEFS_ERROR     = 'LITTLEFS_ERROR';
    public const TYPE_UPDATE_FAILED      = 'UPDATE_FAILED';
    public const TYPE_ROLLBACK           = 'ROLLBACK';
    public const TYPE_MOTOR_SAFETY_EVENT = 'MOTOR_SAFETY_EVENT';
    public const TYPE_UPDATE_REQUIRED    = 'UPDATE_REQUIRED'; // hors cahier, conservé (usage existant côté n8n)

    /** Libellés lisibles affichés dans l'interface. */
    public const CANONICAL_TYPES = [
        self::TYPE_BOOT               => 'BOOT (Démarrage)',
        self::TYPE_RESTART_REQUESTED  => 'RESTART_REQUESTED (Redémarrage demandé)',
        self::TYPE_WATCHDOG_RESET     => 'WATCHDOG_RESET (Chien de garde)',
        self::TYPE_BROWNOUT           => 'BROWNOUT (Sous-tension)',
        self::TYPE_LOW_HEAP           => 'LOW_HEAP (Mémoire faible)',
        self::TYPE_HIGH_FRAGMENTATION => 'HIGH_FRAGMENTATION (Fragmentation mémoire)',
        self::TYPE_WIFI_FLAPPING      => 'WIFI_FLAPPING (Wi-Fi instable)',
        self::TYPE_SUPLA_OFFLINE      => 'SUPLA_OFFLINE (Serveur SUPLA)',
        self::TYPE_LITTLEFS_ERROR     => 'LITTLEFS_ERROR (Système de fichiers)',
        self::TYPE_UPDATE_FAILED      => 'UPDATE_FAILED (Échec de mise à jour)',
        self::TYPE_ROLLBACK           => 'ROLLBACK (Retour arrière firmware)',
        self::TYPE_MOTOR_SAFETY_EVENT => 'MOTOR_SAFETY_EVENT (Sécurité moteur)',
        self::TYPE_UPDATE_REQUIRED    => 'UPDATE_REQUIRED (Mise à jour recommandée)',
    ];

    /**
     * Gravité PAR DÉFAUT de chaque type — table exacte du cahier des
     * charges §7.3. Sert de repli quand la ligne source n'indique pas
     * explicitement de niveau (status/level) : c'est le status/level
     * explicite qui garde toujours la priorité (voir normalizeSeverity).
     */
    public const DEFAULT_SEVERITY = [
        self::TYPE_BOOT               => 'info',
        self::TYPE_RESTART_REQUESTED  => 'info',
        self::TYPE_WATCHDOG_RESET     => 'critical',
        self::TYPE_BROWNOUT           => 'critical',
        self::TYPE_LOW_HEAP           => 'warning',    // devient critical selon la valeur — voir normalizeSeverity
        self::TYPE_HIGH_FRAGMENTATION => 'warning',    // idem
        self::TYPE_WIFI_FLAPPING      => 'warning',
        self::TYPE_SUPLA_OFFLINE      => 'warning',
        self::TYPE_LITTLEFS_ERROR     => 'critical',
        self::TYPE_UPDATE_FAILED      => 'critical',
        self::TYPE_ROLLBACK           => 'critical',
        self::TYPE_MOTOR_SAFETY_EVENT => 'critical',   // priorité maximale (cahier §7.3)
        self::TYPE_UPDATE_REQUIRED    => 'info',
    ];

    /** Action attendue affichée dans l'interface — texte du cahier §7.3. */
    public const EXPECTED_ACTION = [
        self::TYPE_BOOT               => 'Tracer version et cause.',
        self::TYPE_RESTART_REQUESTED  => 'Tracer version et cause.',
        self::TYPE_WATCHDOG_RESET     => 'Incident si répétition ou seuil atteint.',
        self::TYPE_BROWNOUT           => 'Recommander contrôle alimentation.',
        self::TYPE_LOW_HEAP           => 'Analyser tendance et firmware.',
        self::TYPE_HIGH_FRAGMENTATION => 'Analyser tendance et firmware.',
        self::TYPE_WIFI_FLAPPING      => 'Contrôler réseau et fréquence.',
        self::TYPE_SUPLA_OFFLINE      => 'Contrôler réseau et fréquence.',
        self::TYPE_LITTLEFS_ERROR     => 'Incident et intervention recommandée.',
        self::TYPE_UPDATE_FAILED      => 'Arrêter campagne et ouvrir incident.',
        self::TYPE_ROLLBACK           => 'Arrêter campagne et ouvrir incident.',
        self::TYPE_MOTOR_SAFETY_EVENT => 'Priorité maximale et diagnostic terrain.',
        self::TYPE_UPDATE_REQUIRED    => 'Planifier la mise à jour.',
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
        $cleaned = str_replace([' ', '-'], '_', $cleaned);

        if (array_key_exists($cleaned, self::CANONICAL_TYPES)) {
            return $cleaned;
        }

        // Mappings des formats legacy et synonymes courants
        return match (true) {
            str_contains($cleaned, 'MOTOR') || str_contains($cleaned, 'SAFETY') => self::TYPE_MOTOR_SAFETY_EVENT,
            str_contains($cleaned, 'ROLLBACK') => self::TYPE_ROLLBACK,
            str_contains($cleaned, 'UPDATE_FAIL') || str_contains($cleaned, 'OTA_FAIL') => self::TYPE_UPDATE_FAILED,
            str_contains($cleaned, 'LITTLEFS') || str_contains($cleaned, 'FS_ERROR') || str_contains($cleaned, 'SPIFFS') => self::TYPE_LITTLEFS_ERROR,
            str_contains($cleaned, 'BROWNOUT') || str_contains($cleaned, 'UNDERVOLT') || str_contains($cleaned, 'BOD') => self::TYPE_BROWNOUT,
            str_contains($cleaned, 'FRAG') => self::TYPE_HIGH_FRAGMENTATION,
            str_contains($cleaned, 'WDT') || str_contains($cleaned, 'WATCHDOG') || str_contains($cleaned, 'REBOOT_WDT') => self::TYPE_WATCHDOG_RESET,
            str_contains($cleaned, 'RESTART_REQ') => self::TYPE_RESTART_REQUESTED,
            str_contains($cleaned, 'BOOT') || str_contains($cleaned, 'START') || str_contains($cleaned, 'INIT') => self::TYPE_BOOT,
            str_contains($cleaned, 'HEAP') || str_contains($cleaned, 'MEMORY') || str_contains($cleaned, 'MEM_LOW') || str_contains($cleaned, 'RAM') => self::TYPE_LOW_HEAP,
            str_contains($cleaned, 'FLAP') => self::TYPE_WIFI_FLAPPING,
            str_contains($cleaned, 'WIFI') || str_contains($cleaned, 'DISCONNECT') || str_contains($cleaned, 'NETWORK_LOST') => self::TYPE_WIFI_FLAPPING,
            str_contains($cleaned, 'SUPLA') || str_contains($cleaned, 'CLOUD_LOST') => self::TYPE_SUPLA_OFFLINE,
            str_contains($cleaned, 'OFFLINE') => self::TYPE_SUPLA_OFFLINE,
            str_contains($cleaned, 'UPDATE') || str_contains($cleaned, 'FIRMWARE') || str_contains($cleaned, 'OTA') => self::TYPE_UPDATE_REQUIRED,
            default => self::TYPE_BOOT,
        };
    }

    /**
     * Normalise la gravité (severity) vers 'info', 'warning', 'critical', ou 'error'.
     *
     * Priorité : 1) le status/level explicite de la ligne source,
     * 2) une règle contextuelle sur la valeur (heap/fragmentation),
     * 3) la gravité par défaut du type (table du cahier §7.3).
     */
    public static function normalizeSeverity(?string $rawSeverity, string $canonicalType = '', $value = null): string
    {
        $sev = strtolower(trim($rawSeverity ?? ''));

        // Règles contextuelles : LOW_HEAP et HIGH_FRAGMENTATION basculent en
        // critique selon la valeur, quel que soit le status déclaré par la ligne.
        if ($canonicalType === self::TYPE_LOW_HEAP && $value !== null) {
            $heapKb = self::extractHeapKb($value);
            if ($heapKb !== null) {
                return ($heapKb < 10.0) ? 'critical' : 'warning';
            }
        }
        if ($canonicalType === self::TYPE_HIGH_FRAGMENTATION && $value !== null && is_numeric($value)) {
            return ((float) $value >= 80.0) ? 'critical' : 'warning';
        }

        // Status/level explicite de la ligne
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

        // Repli : gravité par défaut du type, telle que définie au cahier §7.3
        return self::DEFAULT_SEVERITY[$canonicalType] ?? 'info';
    }

    /**
     * Action attendue pour ce type — affichée dans l'interface (cahier §7.3).
     */
    public static function expectedAction(string $canonicalType): string
    {
        return self::EXPECTED_ACTION[$canonicalType] ?? 'Analyser l\'événement.';
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
            self::TYPE_BOOT               => 'Démarrage normal du système et initialisation des services.',
            self::TYPE_RESTART_REQUESTED  => 'Redémarrage demandé par le module.',
            self::TYPE_WATCHDOG_RESET     => 'Redémarrage d\'urgence déclenché par le chien de garde (WDT).',
            self::TYPE_BROWNOUT           => 'Sous-tension détectée — vérifier l\'alimentation du module.',
            self::TYPE_LOW_HEAP           => $heapKb !== null
                ? ($heapKb < 10.0 ? "Niveau de mémoire Heap critique : {$heapKb} KB (< 10 KB)." : "Mémoire Heap sous surveillance : {$heapKb} KB.")
                : 'Baisse importante de mémoire Heap disponible.',
            self::TYPE_HIGH_FRAGMENTATION => 'Fragmentation mémoire élevée détectée.',
            self::TYPE_WIFI_FLAPPING      => 'Instabilité Wi-Fi : reconnexions répétées.',
            self::TYPE_SUPLA_OFFLINE      => 'Interruption de la connexion avec le serveur SUPLA Cloud.',
            self::TYPE_LITTLEFS_ERROR     => 'Erreur du système de fichiers local (LittleFS).',
            self::TYPE_UPDATE_FAILED      => 'Échec de la mise à jour firmware.',
            self::TYPE_ROLLBACK           => 'Retour arrière automatique vers le firmware précédent.',
            self::TYPE_MOTOR_SAFETY_EVENT => 'Événement de sécurité moteur — diagnostic terrain requis.',
            self::TYPE_UPDATE_REQUIRED    => 'Une mise à jour firmware recommandée est disponible pour ce module.',
            default                       => 'Événement système enregistré.',
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
            $json = json_decode($value, true);
            if (is_array($json) && isset($json['heap_kb'])) {
                return (float) $json['heap_kb'];
            }

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
