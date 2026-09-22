<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Regroupement d'incidents — cahier des charges §7.3 :
 * « Les répétitions similaires sont regroupées dans un seul incident actif.
 *   Chaque incident conserve première/dernière occurrence, compteur,
 *   priorité, diagnostic, propriétaire et statut. »
 *
 * Ajouts purement additifs sur `alerts` : le statut à 3 valeurs existant
 * (open/acknowledged/resolved), déjà câblé de bout en bout (routes,
 * contrôleur, interface), n'est pas renommé pour ne pas casser l'existant.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('alerts', function (Blueprint $table) {
            if (! Schema::hasColumn('alerts', 'first_occurred_at')) {
                $table->timestamp('first_occurred_at')->nullable()->after('device_id');
            }
            if (! Schema::hasColumn('alerts', 'last_occurred_at')) {
                $table->timestamp('last_occurred_at')->nullable()->after('first_occurred_at');
            }
            if (! Schema::hasColumn('alerts', 'occurrences')) {
                $table->unsignedInteger('occurrences')->default(1)->after('last_occurred_at');
            }
            if (! Schema::hasColumn('alerts', 'priority')) {
                // low | normal | high | critical — cahier §7.3 : MOTOR_SAFETY_EVENT = priorité maximale
                $table->string('priority', 16)->default('normal')->after('severity');
            }
            if (! Schema::hasColumn('alerts', 'diagnostic')) {
                $table->text('diagnostic')->nullable()->after('message');
            }
            if (! Schema::hasColumn('alerts', 'owner_id')) {
                $table->foreignId('owner_id')->nullable()->after('acknowledged_by')
                    ->constrained('users')->nullOnDelete();
            }

            $table->index('priority');
        });
    }

    public function down(): void
    {
        Schema::table('alerts', function (Blueprint $table) {
            $table->dropColumn(['first_occurred_at', 'last_occurred_at', 'occurrences', 'priority', 'diagnostic']);
            $table->dropConstrainedForeignId('owner_id');
        });
    }
};
