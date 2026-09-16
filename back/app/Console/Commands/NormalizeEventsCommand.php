<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\DeviceEvent;
use App\Services\EventNormalizerService;

class NormalizeEventsCommand extends Command
{
    /**
     * Le nom et la signature de la commande Artisan.
     *
     * @var string
     */
    protected $signature = 'events:normalize {--force : Exécuter sans confirmation}';

    /**
     * La description de la commande.
     *
     * @var string
     */
    protected $description = 'Normalise les types, gravités et messages de tous les événements de la table device_events.';

    /**
     * Exécute la commande console.
     */
    public function handle(): int
    {
        $this->info('Début de la normalisation des événements de la flotte...');

        $events = DeviceEvent::all();
        $totalCount = $events->count();

        if ($totalCount === 0) {
            $this->info('Aucun événement à normaliser dans device_events.');
            return self::SUCCESS;
        }

        $updatedCount = 0;

        $this->output->progressStart($totalCount);

        foreach ($events as $event) {
            $normalized = EventNormalizerService::normalizeEvent([
                'type'        => $event->type,
                'severity'    => $event->severity,
                'message'     => $event->message,
                'value'       => $event->value,
                'occurred_at' => $event->occurred_at,
            ]);

            $needsUpdate = ($event->type !== $normalized['type']) ||
                           ($event->severity !== $normalized['severity']) ||
                           ($event->message !== $normalized['message']);

            if ($needsUpdate) {
                $event->update([
                    'type'     => $normalized['type'],
                    'severity' => $normalized['severity'],
                    'message'  => $normalized['message'],
                ]);
                $updatedCount++;
            }

            $this->output->progressAdvance();
        }

        $this->output->progressFinish();

        $this->info("Normalisation terminée avec succès !");
        $this->line("<comment>{$updatedCount}</comment> sur <comment>{$totalCount}</comment> événements ont été mis à jour avec les formats canoniques J7.");

        return self::SUCCESS;
    }
}
