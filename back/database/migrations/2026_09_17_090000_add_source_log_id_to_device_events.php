<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permet d'importer les événements depuis `heap_logs` (legacy) de façon
 * idempotente : chaque ligne heap_logs notable n'est importée qu'une fois.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('device_events', function (Blueprint $table) {
            if (! Schema::hasColumn('device_events', 'source_log_id')) {
                $table->unsignedBigInteger('source_log_id')->nullable()->unique()->after('device_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('device_events', function (Blueprint $table) {
            $table->dropUnique(['source_log_id']);
            $table->dropColumn('source_log_id');
        });
    }
};
