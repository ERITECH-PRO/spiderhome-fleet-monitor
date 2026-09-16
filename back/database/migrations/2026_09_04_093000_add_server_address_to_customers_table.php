<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'server_address')) {
                $table->string('server_address')->default('https://spiderhome.org/')->after('name');
            }
        });

        // Mise à jour de sécurité pour tous les enregistrements existants
        DB::table('customers')
            ->whereNull('server_address')
            ->orWhere('server_address', '')
            ->update(['server_address' => 'https://spiderhome.org/']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'server_address')) {
                $table->dropColumn('server_address');
            }
        });
    }
};
