#!/bin/bash
set -e

cd /var/www/html

echo "[spiderhome] Démarrage du conteneur ($1)"

# ── Attente de MySQL ─────────────────────────────────────────────────────────
if [ -n "$DB_HOST" ]; then
    echo "[spiderhome] Attente de MySQL sur ${DB_HOST}:${DB_PORT:-3306}…"
    for i in $(seq 1 30); do
        if mariadb-admin ping -h "$DB_HOST" -P "${DB_PORT:-3306}" \
             -u "$DB_USERNAME" -p"$DB_PASSWORD" --silent >/dev/null 2>&1; then
            echo "[spiderhome] MySQL joignable."
            break
        fi
        if [ "$i" = "30" ]; then
            echo "[spiderhome] MySQL injoignable après 60s — le conteneur démarre quand même."
        fi
        sleep 2
    done
fi

# ── Clé applicative ──────────────────────────────────────────────────────────
if [ -z "$APP_KEY" ]; then
    echo "[spiderhome] ATTENTION : APP_KEY vide. Générer une clé avec :"
    echo "             docker compose run --rm api php artisan key:generate --show"
fi

# ── Migrations et caches : uniquement sur le conteneur API ───────────────────
# Le scheduler partage la même image et ne doit pas rejouer les migrations.
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "[spiderhome] Migrations…"
    php artisan migrate --force --no-interaction || \
        echo "[spiderhome] Migrations en échec — vérifier les accès MySQL."

    if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
        echo "[spiderhome] Compte administrateur…"
        php artisan db:seed --force --no-interaction || true
    fi

    echo "[spiderhome] Première synchronisation du parc…"
    php artisan spiderhome:sync --quiet-log || true
fi

php artisan config:cache  >/dev/null 2>&1 || true
php artisan route:cache   >/dev/null 2>&1 || true
php artisan event:cache   >/dev/null 2>&1 || true

chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

exec "$@"
