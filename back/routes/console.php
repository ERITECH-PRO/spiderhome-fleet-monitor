<?php

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Tâches planifiées
|--------------------------------------------------------------------------
| Nécessite une entrée cron sur le serveur :
|   * * * * * cd /opt/PROJET/spiderhome-fleet-monitor/back && php artisan schedule:run >> /dev/null 2>&1
*/

// Provisionnement automatique du parc + calcul des états et alertes.
Schedule::command('spiderhome:sync --quiet-log')
    ->everyMinute()
    ->withoutOverlapping(5)
    ->runInBackground();
