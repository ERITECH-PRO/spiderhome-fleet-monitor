<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cahier des charges §7.1 : « Enregistrer l'emplacement lisible,
 * l'installateur, la date, le firmware initial et la garantie. »
 *
 * `firmware initial` n'est pas dupliqué : `devices.firmware` est déjà mis à
 * jour en continu par la synchronisation ; le firmware au moment de la pose
 * est conservé une fois pour toutes dans `initial_firmware`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            if (! Schema::hasColumn('devices', 'installed_at')) {
                $table->date('installed_at')->nullable()->after('label');
            }
            if (! Schema::hasColumn('devices', 'installer_name')) {
                $table->string('installer_name', 191)->nullable()->after('installed_at');
            }
            if (! Schema::hasColumn('devices', 'initial_firmware')) {
                $table->string('initial_firmware', 64)->nullable()->after('installer_name');
            }
            if (! Schema::hasColumn('devices', 'warranty_until')) {
                $table->date('warranty_until')->nullable()->after('initial_firmware');
            }
        });
    }

    public function down(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->dropColumn(['installed_at', 'installer_name', 'initial_firmware', 'warranty_until']);
        });
    }
};
