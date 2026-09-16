<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeder de production.
 *
 * Aucune donnée de démonstration : le parc (clients, sites, modules) est
 * alimenté automatiquement par « php artisan spiderhome:sync » à partir des
 * tables legacy alimentées par les modules eux-mêmes.
 *
 * Ce seeder crée uniquement le compte administrateur initial, à partir des
 * variables d'environnement ADMIN_EMAIL / ADMIN_PASSWORD.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $email    = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (! $email || ! $password) {
            $this->command->warn('ADMIN_EMAIL / ADMIN_PASSWORD absents du .env — aucun compte créé.');

            return;
        }

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name'     => env('ADMIN_NAME', 'Administrateur'),
                'password' => Hash::make($password),
                'role'     => 'admin',
            ]
        );

        $this->command->info("Compte administrateur prêt : {$user->email}");
    }
}
