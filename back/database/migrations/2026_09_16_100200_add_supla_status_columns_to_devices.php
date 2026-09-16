<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Colonnes reprises du panneau « Statut » affiché par cloud.spiderhome.org /
 * cloud.supla.org pour chaque module :
 *
 *   GUID · Firmware version · Enregistré · Dernière connexion · IP · MAC
 *   Wi-Fi RSSI · Wi-Fi signal strength · Uptime · Connection uptime
 *
 * Ces valeurs sont remontées par le module lui-même (voir
 * POST /api/ingest/status) et stockées sur la fiche du module.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            if (! Schema::hasColumn('devices', 'supla_connected')) {
                $table->boolean('supla_connected')->nullable()->after('supla_server');
            }
            if (! Schema::hasColumn('devices', 'registered_at')) {
                $table->timestamp('registered_at')->nullable()->after('supla_connected');
            }
            if (! Schema::hasColumn('devices', 'last_connected_at')) {
                $table->timestamp('last_connected_at')->nullable()->after('registered_at');
            }
            if (! Schema::hasColumn('devices', 'wifi_rssi')) {
                $table->integer('wifi_rssi')->nullable()->after('last_connected_at');
            }
            if (! Schema::hasColumn('devices', 'wifi_quality_pct')) {
                $table->unsignedTinyInteger('wifi_quality_pct')->nullable()->after('wifi_rssi');
            }
            if (! Schema::hasColumn('devices', 'connection_uptime')) {
                $table->bigInteger('connection_uptime')->nullable()->after('wifi_quality_pct');
            }
        });
    }

    public function down(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->dropColumn([
                'supla_connected', 'registered_at', 'last_connected_at',
                'wifi_rssi', 'wifi_quality_pct', 'connection_uptime',
            ]);
        });
    }
};
