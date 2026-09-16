<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Suppression du module « avis de mise à jour / consentement OTA simulé ».
 *
 * Il s'agissait d'une maquette de stage : aucun firmware n'était réellement
 * téléchargé et le consentement n'avait aucune valeur juridique. Exposer un
 * tel écran en production induirait les opérateurs en erreur.
 * L'OTA réelle reste à implémenter côté firmware (interdite sur ESP-07).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('update_notices');
    }

    public function down(): void
    {
        // Volontairement vide : la table maquette n'est pas restaurée.
    }
};
