<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RBAC — cahier des charges §4 « Utilisateurs et droits ».
 *
 * Un compte de rôle « client » (App\Models\User::ROLE_CLIENT) doit être
 * rattaché à un client précis : c'est cette colonne qui alimente
 * l'isolation automatique (App\Models\Concerns\CustomerScoped).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'customer_id')) {
                $table->foreignId('customer_id')->nullable()->after('id')
                    ->constrained('customers')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_id');
        });
    }
};
