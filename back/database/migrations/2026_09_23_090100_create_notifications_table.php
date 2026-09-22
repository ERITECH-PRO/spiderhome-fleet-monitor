<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Notifications in-app — cahier §7.4 : « Une notification est envoyée à
 * chaque changement significatif. »
 *
 * Volontairement simple (table + polling) : pas d'e-mail/push, l'infra
 * (BREVO_API_KEY) n'est câblée que pour l'OTP mot de passe oublié.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 64);
            $table->string('title', 191);
            $table->string('message', 500)->nullable();
            $table->string('link', 255)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
