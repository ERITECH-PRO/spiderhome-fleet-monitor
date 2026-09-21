<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Isolation client automatique — cahier des charges REC-02 :
 * « Aucun compte client ne lit ni ne modifie une ressource d'un autre client. »
 *
 * Chaque modèle qui utilise ce trait doit implémenter
 * `scopeForCustomer(Builder $query, int $customerId)`, qui sait comment
 * remonter jusqu'au client (directement ou via une relation).
 *
 * Le scope est ajouté automatiquement à TOUTES les requêtes Eloquent sur
 * le modèle dès qu'un utilisateur de rôle « client » est authentifié —
 * aucune modification de contrôleur n'est nécessaire, et aucun contrôleur
 * ne peut l'oublier. Sans utilisateur authentifié (CLI, jobs planifiés,
 * synchronisation), le scope ne s'applique pas.
 */
trait CustomerScoped
{
    protected static function bootCustomerScoped(): void
    {
        static::addGlobalScope('customer-isolation', function (Builder $builder) {
            if (! auth()->check()) {
                return; // contexte CLI / job planifié : jamais restreint
            }

            /** @var User $user */
            $user = auth()->user();

            if ($user->role !== User::ROLE_CLIENT) {
                return; // rôles internes : accès complet
            }

            if (! $user->customer_id) {
                // Compte client mal configuré : ne renvoyer aucune ligne
                // plutôt que de fuiter les données d'un autre client.
                $builder->whereRaw('1 = 0');

                return;
            }

            $builder->forCustomer($user->customer_id);
        });
    }
}
