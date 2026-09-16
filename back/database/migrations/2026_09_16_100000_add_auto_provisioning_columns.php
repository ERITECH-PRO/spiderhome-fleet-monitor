<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Colonnes nécessaires au provisionnement automatique du parc.
 *
 * Les modules SpiderHome déclarent eux-mêmes leur compte client (email),
 * leur serveur (supla_server) et leur firmware via la table legacy
 * `module_installs`. Le registre métier est donc alimenté par
 * `php artisan spiderhome:sync` et non par une saisie manuelle.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'auto_provisioned')) {
                $table->boolean('auto_provisioned')->default(false)->after('status');
            }
        });

        Schema::table('devices', function (Blueprint $table) {
            if (!Schema::hasColumn('devices', 'auto_provisioned')) {
                $table->boolean('auto_provisioned')->default(false)->after('status');
            }
            if (!Schema::hasColumn('devices', 'first_seen_at')) {
                $table->timestamp('first_seen_at')->nullable()->after('last_seen_at');
            }
            if (!Schema::hasColumn('devices', 'last_heap_kb')) {
                $table->decimal('last_heap_kb', 10, 2)->nullable()->after('first_seen_at');
            }
            if (!Schema::hasColumn('devices', 'last_frag_pct')) {
                $table->decimal('last_frag_pct', 5, 1)->nullable()->after('last_heap_kb');
            }
            if (!Schema::hasColumn('devices', 'last_uptime')) {
                $table->bigInteger('last_uptime')->nullable()->after('last_frag_pct');
            }
            if (!Schema::hasColumn('devices', 'last_status')) {
                $table->string('last_status', 32)->nullable()->after('last_uptime');
            }
        });

        Schema::table('sites', function (Blueprint $table) {
            if (!Schema::hasColumn('sites', 'auto_provisioned')) {
                $table->boolean('auto_provisioned')->default(false)->after('name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', fn (Blueprint $t) => $t->dropColumn('auto_provisioned'));
        Schema::table('sites', fn (Blueprint $t) => $t->dropColumn('auto_provisioned'));
        Schema::table('devices', function (Blueprint $t) {
            $t->dropColumn(['auto_provisioned', 'first_seen_at', 'last_heap_kb', 'last_frag_pct', 'last_uptime', 'last_status']);
        });
    }
};
