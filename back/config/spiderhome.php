<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Seuils de santé
    |--------------------------------------------------------------------------
    | Repris de la logique du collecteur Express (server.js) afin que la
    | plateforme et le dashboard legacy affichent exactement le même verdict.
    | Valeurs en octets de heap disponible.
    */

    'heap_critical_bytes' => (int) env('SPIDERHOME_HEAP_CRITICAL', 6000),
    'heap_warning_bytes'  => (int) env('SPIDERHOME_HEAP_WARNING', 8000),

    /*
    | Fragmentation (%) au-delà de laquelle un avertissement est levé.
    */
    'frag_warning_pct' => (int) env('SPIDERHOME_FRAG_WARNING', 60),

    /*
    |--------------------------------------------------------------------------
    | Détection hors ligne
    |--------------------------------------------------------------------------
    | Un module est considéré hors ligne s'il n'a envoyé aucune mesure
    | depuis ce délai (en minutes).
    */

    'offline_after_minutes' => (int) env('SPIDERHOME_OFFLINE_MINUTES', 30),

    /*
    |--------------------------------------------------------------------------
    | Synchronisation automatique du parc
    |--------------------------------------------------------------------------
    | Le registre métier (clients, sites, modules) est déduit des tables
    | legacy alimentées par les modules eux-mêmes. Aucune saisie manuelle
    | n'est nécessaire pour qu'un nouveau module apparaisse.
    */

    'sync' => [
        // Créer automatiquement un client à partir de l'e-mail déclaré par le module.
        'auto_create_customers' => (bool) env('SPIDERHOME_AUTO_CUSTOMERS', true),

        // Nom du site créé par défaut pour un client auto-provisionné.
        'default_site_name' => env('SPIDERHOME_DEFAULT_SITE', 'Site principal'),

        // Client de rattachement des modules dont l'e-mail est inconnu.
        'unassigned_customer_name' => 'Modules non rattachés',

        // Nombre de lignes heap_logs analysées par passe (0 = pas de limite).
        'telemetry_lookback_hours' => (int) env('SPIDERHOME_LOOKBACK_HOURS', 72),
    ],

    /*
    |--------------------------------------------------------------------------
    | Jeton d'ingestion
    |--------------------------------------------------------------------------
    | Protège POST /api/ingest/status (bloc « Statut » remonté par les modules).
    | Vide = endpoint désactivé. Ne jamais laisser vide en production si les
    | modules doivent publier directement vers la plateforme.
    */

    'ingest_token' => env('SPIDERHOME_INGEST_TOKEN', ''),

    /*
    |--------------------------------------------------------------------------
    | Confidentialité
    |--------------------------------------------------------------------------
    | Masquage des e-mails et MAC dans les réponses de l'adaptateur legacy
    | (/api/module-installs, /api/installations).
    */

    'mask_sensitive_legacy_fields' => (bool) env('SPIDERHOME_MASK_LEGACY', false),

];
