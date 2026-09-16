<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * J8 — Historique des changements de statut / priorité des demandes d'intervention.
     */
    public function up(): void
    {
        Schema::create('service_request_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_request_id')
                  ->constrained()
                  ->onDelete('cascade');
            $table->string('field');          // 'status' | 'priority' | 'assigned_to' | etc.
            $table->string('old_value')->nullable();
            $table->string('new_value')->nullable();
            $table->foreignId('changed_by')
                  ->nullable()
                  ->constrained('users')
                  ->nullOnDelete();
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_request_histories');
    }
};
