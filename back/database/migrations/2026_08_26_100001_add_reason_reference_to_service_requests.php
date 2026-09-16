<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * J8 — Ajoute les colonnes manquantes sur service_requests :
     *   - reason   : motif de l'intervention (courte description de la cause)
     *   - reference : numéro de référence lisible (ex: SAV-2026-0042)
     */
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('service_requests', 'reason')) {
                $table->string('reason')->nullable()->after('title');
            }
            if (!Schema::hasColumn('service_requests', 'reference')) {
                $table->string('reference', 30)->nullable()->unique()->after('id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            if (Schema::hasColumn('service_requests', 'reference')) {
                $table->dropUnique(['reference']);
                $table->dropColumn('reference');
            }
            if (Schema::hasColumn('service_requests', 'reason')) {
                $table->dropColumn('reason');
            }
        });
    }
};
