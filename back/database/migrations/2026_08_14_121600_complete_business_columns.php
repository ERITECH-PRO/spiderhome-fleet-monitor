<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Complète les tables métier existantes avec les colonnes manquantes.
     */
    public function up(): void
    {
        // ── customers ────────────────────────────────────────────────────────
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'address'))  $table->text('address')->nullable()->after('email');
            if (!Schema::hasColumn('customers', 'city'))     $table->string('city')->nullable()->after('address');
            if (!Schema::hasColumn('customers', 'country'))  $table->string('country', 3)->nullable()->after('city');
            if (!Schema::hasColumn('customers', 'siret'))    $table->string('siret', 20)->nullable()->after('country');
        });

        // ── sites ─────────────────────────────────────────────────────────────
        Schema::table('sites', function (Blueprint $table) {
            if (!Schema::hasColumn('sites', 'contact_name'))  $table->string('contact_name')->nullable()->after('address');
            if (!Schema::hasColumn('sites', 'contact_phone')) $table->string('contact_phone')->nullable()->after('contact_name');
            if (!Schema::hasColumn('sites', 'lat'))           $table->decimal('lat', 10, 7)->nullable()->after('contact_phone');
            if (!Schema::hasColumn('sites', 'lng'))           $table->decimal('lng', 10, 7)->nullable()->after('lat');
        });

        // ── device_models ────────────────────────────────────────────────────
        Schema::table('device_models', function (Blueprint $table) {
            if (!Schema::hasColumn('device_models', 'manufacturer'))   $table->string('manufacturer')->nullable()->after('id');
            if (!Schema::hasColumn('device_models', 'min_firmware'))   $table->string('min_firmware')->nullable()->after('manufacturer');
            if (!Schema::hasColumn('device_models', 'description'))    $table->text('description')->nullable()->after('min_firmware');
        });

        // ── devices ───────────────────────────────────────────────────────────
        Schema::table('devices', function (Blueprint $table) {
            if (!Schema::hasColumn('devices', 'label'))       $table->string('label')->nullable()->after('serial_number');
            if (!Schema::hasColumn('devices', 'ip_address'))  $table->string('ip_address')->nullable()->after('label');
            if (!Schema::hasColumn('devices', 'supla_server')) $table->string('supla_server')->nullable()->after('ip_address');
        });

        // ── service_requests ─────────────────────────────────────────────────
        Schema::table('service_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('service_requests', 'assigned_to'))  $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete()->after('device_id');
            if (!Schema::hasColumn('service_requests', 'title'))        $table->string('title')->nullable()->after('assigned_to');
            if (!Schema::hasColumn('service_requests', 'resolved_at'))  $table->timestamp('resolved_at')->nullable()->after('desired_at');
        });

        // ── update_notices ───────────────────────────────────────────────────
        if (Schema::hasTable('update_notices')) {
        Schema::table('update_notices', function (Blueprint $table) {
            if (!Schema::hasColumn('update_notices', 'scheduled_at'))  $table->timestamp('scheduled_at')->nullable()->after('consent_status');
            if (!Schema::hasColumn('update_notices', 'deployed_at'))   $table->timestamp('deployed_at')->nullable()->after('scheduled_at');
            if (!Schema::hasColumn('update_notices', 'notes'))         $table->text('notes')->nullable()->after('deployed_at');
        });
        }

        // ── users ─────────────────────────────────────────────────────────────
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'customer_id'))  $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete()->after('role');
            if (!Schema::hasColumn('users', 'phone'))        $table->string('phone')->nullable()->after('customer_id');
        });
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('customers',        fn($t) => $t->dropColumn(['address','city','country','siret']));
        Schema::table('sites',            fn($t) => $t->dropColumn(['contact_name','contact_phone','lat','lng']));
        Schema::table('device_models',    fn($t) => $t->dropColumn(['manufacturer','min_firmware','description']));
        Schema::table('devices',          fn($t) => $t->dropColumn(['label','ip_address','supla_server']));
        Schema::table('service_requests', fn($t) => $t->dropColumn(['assigned_to','title','resolved_at']));
        Schema::table('users',            fn($t) => $t->dropColumn(['customer_id','phone']));
    }


};
