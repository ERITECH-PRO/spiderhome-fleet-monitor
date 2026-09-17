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
echo "── 4. Correspondance des clés — modules ACTIFS uniquement ─────────────"
echo "    (au-delà de la fenêtre SPIDERHOME_LOOKBACK_HOURS, un module est"
echo "     considéré éteint/retiré et n'est plus auto-provisionné : normal.)"
docker compose exec -T api php artisan tinker --execute="
\$lookback = (int) config('spiderhome.sync.telemetry_lookback_hours', 72);
\$activeKeys = \DB::connection('heap_monitoring')->table('heap_logs')
    ->where('timestamp', '>=', now()->subHours(\$lookback))
    ->distinct()->pluck('device');
\$knownKeys = \App\Models\Device::pluck('legacy_device_key')->merge(\App\Models\Device::pluck('serial_number'))->unique();
\$orphans = \$activeKeys->diff(\$knownKeys);
echo 'Modules actifs (< ' . \$lookback . 'h) sans fiche : ' . \$orphans->count() . '/' . \$activeKeys->count() . PHP_EOL;
if (\$orphans->count() > 0) { echo 'Exemples : ' . \$orphans->take(5)->implode(', ') . PHP_EOL; echo '→ lancer : php artisan spiderhome:sync' . PHP_EOL; }
\$staleTotal = \DB::connection('heap_monitoring')->table('heap_logs')->distinct()->count('device');
echo '(pour référence, ' . (\$staleTotal - \$activeKeys->count()) . ' clés supplémentaires existent dans l\'historique complet mais sont inactives depuis plus de ' . \$lookback . 'h — ignorées volontairement)' . PHP_EOL;
"

echo
echo "── 5. Exécution manuelle de la synchronisation ─────────────────────────"
docker compose exec -T api php artisan spiderhome:sync

echo
echo "── 6. Scheduler — doit tourner en continu ──────────────────────────────"
docker compose logs --tail=20 scheduler

echo
echo "── 7. Clé applicative (APP_KEY) ────────────────────────────────────────"
docker compose exec -T api php artisan tinker --execute="echo config('app.key') ? 'APP_KEY définie.' : 'APP_KEY VIDE — voir §Installation de DOCKER.md.';" 2>/dev/null

echo
echo "── 8. Chaîne web → api en conditions réelles ───────────────────────────"
docker compose exec -T web sh -c "wget -qO- http://localhost/api/health || echo 'ÉCHEC proxy web → api'"

echo
echo "── 9. API vue depuis l'extérieur ───────────────────────────────────────"
curl -s http://localhost:8089/api/health || echo "ÉCHEC — le port 8089 répond-il ?"
echo
echo "Se connecter ensuite dans l'app, ouvrir les outils réseau du navigateur et vérifier :"
echo "  GET /api/fleet/overview   → 'devices' doit être non vide"
echo "  GET /api/fleet/heap-history?device=<serial_number réel> → 'points' non vide"
