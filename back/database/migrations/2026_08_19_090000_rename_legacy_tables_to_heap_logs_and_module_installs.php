<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * ⚠️  NON-RÉGRESSION — tables legacy `heap_logs` et `module_installs`.
 *
 * Ces deux tables sont alimentées en production par le collecteur Express
 * (server.js, port 3006) et par le workflow n8n. Elles ne doivent JAMAIS être
 * créées, renommées, modifiées ou supprimées par une migration Laravel.
 *
 * La version précédente de cette migration exécutait un RENAME TABLE et un
 * DROP TABLE, et son down() supprimait les deux tables : un simple
 * `migrate:rollback` ou `migrate:fresh` détruisait toute la télémétrie client.
 * Elle est neutralisée ici : la migration se contente de vérifier la présence
 * des tables et laisse un avertissement si elles sont absentes.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['heap_logs', 'module_installs'] as $table) {
            if (! Schema::connection(config('database.heap_connection', 'heap_monitoring'))->hasTable($table)) {
                echo "[spiderhome] AVERTISSEMENT : table legacy `{$table}` introuvable. "
                   . "Le collecteur Express doit la créer avant utilisation de la plateforme.\n";
            }
        }
    }

    public function down(): void
    {
        // Volontairement vide : ne jamais supprimer les tables legacy.
    }
};
