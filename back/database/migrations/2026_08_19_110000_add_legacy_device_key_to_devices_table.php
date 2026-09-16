<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ajoute legacy_device_key (nullable, unique) sur devices
     * et rend la colonne mac nullable pour compatibilité legacy.
     */
    public function up(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            if (! Schema::hasColumn('devices', 'legacy_device_key')) {
                $table->string('legacy_device_key')->nullable()->unique()->after('serial_number');
            }
            // Rendre mac nullable (les modules legacy peuvent ne pas avoir de MAC connue)
            $table->string('mac')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            if (Schema::hasColumn('devices', 'legacy_device_key')) {
                $table->dropUnique(['legacy_device_key']);
                $table->dropColumn('legacy_device_key');
            }
            $table->string('mac')->nullable(false)->change();
        });
    }
};
