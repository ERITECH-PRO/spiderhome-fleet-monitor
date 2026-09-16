<?php

namespace App\Console\Commands;

use App\Services\FleetSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Synchronisation automatique du parc.
 *
 * Planifiée toutes les minutes (voir routes/console.php) : les modules
 * déclarés par le collecteur Express apparaissent seuls dans la plateforme.
 */
class SyncFleetCommand extends Command
{
    protected $signature = 'spiderhome:sync {--quiet-log : ne pas écrire dans le journal applicatif}';

    protected $description = 'Synchronise clients, sites, modules, états et alertes depuis les tables legacy (heap_logs / module_installs).';

    public function handle(FleetSyncService $sync): int
    {
        $started = microtime(true);

        try {
            $stats = $sync->run();
        } catch (\Throwable $e) {
            $this->error('Échec de la synchronisation : ' . $e->getMessage());
            Log::error('[spiderhome:sync] ' . $e->getMessage());

            return self::FAILURE;
        }

        $duration = round(microtime(true) - $started, 2);

        $this->table(
            ['Compteur', 'Valeur'],
            collect($stats)->map(fn ($v, $k) => [$k, $v])->values()->all()
        );
        $this->info("Synchronisation terminée en {$duration}s.");

        if (! $this->option('quiet-log')) {
            Log::info('[spiderhome:sync]', $stats + ['duration_s' => $duration]);
        }

        return self::SUCCESS;
    }
}
