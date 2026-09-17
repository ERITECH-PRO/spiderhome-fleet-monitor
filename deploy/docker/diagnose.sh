#!/bin/bash
###############################################################################
# SpiderHome Fleet Monitor — diagnostic « dashboard vide »
#
# Usage : ./deploy/docker/diagnose.sh
# À lancer depuis la racine du projet (où se trouve docker-compose.yml).
###############################################################################
set -e

echo "── 1. Conteneurs ───────────────────────────────────────────────────────"
docker compose ps

echo
echo "── 2. Tables legacy (heap_logs / module_installs) — doivent être > 0 ──"
docker compose exec -T api php artisan tinker --execute="
echo 'heap_logs        : ' . \DB::connection('heap_monitoring')->table('heap_logs')->count() . PHP_EOL;
echo 'module_installs  : ' . \DB::connection('heap_monitoring')->table('module_installs')->count() . PHP_EOL;
echo 'dernier relevé   : ' . (\DB::connection('heap_monitoring')->table('heap_logs')->max('timestamp') ?? 'AUCUN') . PHP_EOL;
"

echo
echo "── 3. Registre métier — doit contenir vos modules ─────────────────────"
docker compose exec -T api php artisan tinker --execute="
echo 'customers : ' . \App\Models\Customer::count() . PHP_EOL;
echo 'devices   : ' . \App\Models\Device::count() . PHP_EOL;
echo 'device_events : ' . \App\Models\DeviceEvent::count() . PHP_EOL;
\App\Models\Device::limit(5)->get(['serial_number','legacy_device_key','status','last_seen_at'])
    ->each(fn(\$d) => print_r(\$d->toArray()));
"

echo
echo "── 4. Correspondance des clés (device dans heap_logs vs devices) ──────"
docker compose exec -T api php artisan tinker --execute="
\$legacyKeys = \DB::connection('heap_monitoring')->table('heap_logs')->distinct()->pluck('device');
\$knownKeys  = \App\Models\Device::pluck('legacy_device_key')->merge(\App\Models\Device::pluck('serial_number'))->unique();
\$orphans = \$legacyKeys->diff(\$knownKeys);
echo 'Clés heap_logs sans module correspondant : ' . \$orphans->count() . '/' . \$legacyKeys->count() . PHP_EOL;
if (\$orphans->count() > 0) { echo 'Exemples : ' . \$orphans->take(5)->implode(', ') . PHP_EOL; }
"

echo
echo "── 5. Exécution manuelle de la synchronisation ─────────────────────────"
docker compose exec -T api php artisan spiderhome:sync

echo
echo "── 6. Scheduler — doit tourner en continu ──────────────────────────────"
docker compose logs --tail=20 scheduler

echo
echo "── 7. API réelle vue par le frontend ───────────────────────────────────"
echo "Se connecter dans l'app, ouvrir les outils réseau du navigateur et vérifier :"
echo "  GET /api/fleet/overview   → 'devices' doit être non vide"
echo "  GET /api/fleet/heap-history?device=<serial_number réel> → 'points' non vide"
