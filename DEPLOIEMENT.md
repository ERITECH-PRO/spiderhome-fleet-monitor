# Déploiement — SpiderHome Fleet Monitor

Plateforme de supervision du parc SpiderHome installé chez les clients.
Elle **n'est pas** le cloud domotique (`cloud.spiderhome.org` / `cloud.supla.org`) :
elle observe l'état technique des cartes et ne pilote aucun équipement.

---

## 1. Principe de fonctionnement

```
Module SpiderHome (ESP8266)
   │  mode configuration → point d'accès → http://192.168.4.1
   │     WiFi · e-mail du compte client · adresse serveur
   │
   ├──► collecteur Express (server.js, port 3006) ──► MySQL heap_monitoring
   │        POST /api/ingest          → heap_logs        (télémétrie)
   │        workflow n8n              → module_installs  (identité + e-mail + serveur)
   │
   └──► (optionnel) POST /api/ingest/status ──► Laravel
            bloc « Statut » : GUID, firmware, IP, MAC, RSSI, uptime…

Laravel  ── lecture seule ──► heap_logs / module_installs
         ── écriture ──────► customers, sites, devices, alerts, service_requests
         ── artisan spiderhome:sync (toutes les minutes)

Angular  ── API Laravel uniquement (jamais MySQL ni Express directement)
```

**Rien n'est saisi à la main.** Un module qui se déclare crée automatiquement
son client (via l'e-mail), son site, son modèle et sa fiche.

---

## 2. Prérequis serveur

| Composant | Version |
|---|---|
| PHP | 8.2+ avec `pdo_mysql`, `mbstring`, `openssl`, `curl`, `fileinfo` |
| Composer | 2.x |
| Node.js | 20+ (build Angular uniquement) |
| MySQL | 8.0 (base `heap_monitoring` existante) |
| Nginx | + php8.2-fpm |

---

## 3. Comptes MySQL

Deux comptes distincts, jamais `root` :

```sql
-- Compte applicatif : tables métier uniquement
CREATE USER 'spiderhome_app'@'localhost' IDENTIFIED BY '<mot_de_passe_fort>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON heap_monitoring.* TO 'spiderhome_app'@'localhost';

-- Compte lecture seule : tables legacy, garantie de non-régression
CREATE USER 'spiderhome_ro'@'localhost' IDENTIFIED BY '<mot_de_passe_fort>';
GRANT SELECT ON heap_monitoring.heap_logs       TO 'spiderhome_ro'@'localhost';
GRANT SELECT ON heap_monitoring.module_installs TO 'spiderhome_ro'@'localhost';

FLUSH PRIVILEGES;
```

Le compte `spiderhome_ro` rend toute écriture sur `heap_logs` et
`module_installs` **impossible au niveau du SGBD**, quelle que soit une erreur
de code future.

Index recommandés sur les tables legacy (améliore fortement la synchronisation) :

```sql
ALTER TABLE heap_logs        ADD INDEX idx_device_ts (device, timestamp);
ALTER TABLE module_installs  ADD INDEX idx_device    (device);
ALTER TABLE module_installs  ADD INDEX idx_email     (email);
```

---

## 4. Backend

```bash
cd /opt/PROJET/spiderhome-fleet-monitor/back

composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
# → renseigner DB_*, DB_HEAP_*, ADMIN_EMAIL, ADMIN_PASSWORD, SPIDERHOME_INGEST_TOKEN

php artisan migrate --force        # ne touche jamais heap_logs / module_installs
php artisan db:seed --force        # crée uniquement le compte administrateur
php artisan spiderhome:sync        # première synchronisation du parc

php artisan config:cache
php artisan route:cache

chown -R www-data:www-data storage bootstrap/cache
```

Après `db:seed`, **vider `ADMIN_PASSWORD` du `.env`** et changer le mot de passe
depuis l'interface.

### Tâche planifiée (obligatoire)

```bash
crontab -e -u www-data
```

```cron
* * * * * cd /opt/PROJET/spiderhome-fleet-monitor/back && php artisan schedule:run >> /dev/null 2>&1
```

C'est ce cron qui fait vivre la plateforme : détection des nouveaux modules,
mise à jour des états en ligne / hors ligne, ouverture et fermeture des alertes.

---

## 5. Frontend

```bash
cd /opt/PROJET/spiderhome-fleet-monitor/front
npm ci
npm run build          # configuration production par défaut
```

Le build est produit dans `dist/spiderhome-dashboard/browser`, servi par Nginx
(voir `deploy/nginx.conf.example`). `environment.prod.ts` pointe sur `/api`,
donc aucun CORS n'est nécessaire.

---

## 6. Collecteur Express (inchangé)

`server.js` et `public/index.html` restent **strictement identiques** à la
version en production. Ils continuent de tourner sous PM2 :

```bash
pm2 status heap-dashboard
```

Ne pas les modifier : les modules déjà installés pointent dessus. La nouvelle
plateforme lit la même base.

---

## 7. Remontée du bloc « Statut » (optionnel)

Pour afficher dans la fiche module les mêmes informations que le panneau
« Statut » de `cloud.spiderhome.org` (GUID, firmware, enregistrement, dernière
connexion, IP, MAC, RSSI, qualité Wi-Fi, uptime, connection uptime), le module
publie :

```http
POST /api/ingest/status
X-Ingest-Token: <SPIDERHOME_INGEST_TOKEN>
Content-Type: application/json

{
  "device": "Spider_S10_E8DA91",
  "device_name": "Spider_S10",
  "guid": "CFC6B450-6180-1DD9-B960-82FAC3BBF2F9",
  "firmware": "V1.1.0-lab",
  "mac": "68:FE:71:8C:D1:0C",
  "ip": "192.168.110.25",
  "wifi_rssi": -62,
  "wifi_quality": 76,
  "uptime": 589,
  "connection_uptime": 588,
  "registered_at": "2026-09-15T19:19:00Z",
  "last_connected_at": "2026-09-16T10:27:00Z",
  "connected": true,
  "email": "client@example.com",
  "server": "cloud.spiderhome.org"
}
```

Un module inconnu est créé automatiquement. L'endpoint est **désactivé** tant
que `SPIDERHOME_INGEST_TOKEN` est vide. Il n'écrit jamais dans les tables legacy.

> Côté firmware, c'est M. Eric qui décide de l'ajout de cet appel. Sans lui, la
> plateforme fonctionne déjà entièrement avec `heap_logs` et `module_installs`.

---

## 8. Sauvegarde

```bash
mysqldump --single-transaction --routines heap_monitoring \
  | gzip > /var/backups/heap_monitoring_$(date +%F).sql.gz
```

Tester une restauration sur un serveur de recette **avant** la mise en service.

---

## 9. Vérifications après déploiement

| Contrôle | Commande / action | Attendu |
|---|---|---|
| Sonde | `curl -s https://monitor.spiderhome.org/api/health` | `"status":"ok"` sur les deux bases |
| API protégée | `curl -i .../api/devices` sans jeton | `401` |
| Non-régression | `SELECT COUNT(*) FROM heap_logs;` avant / après une journée d'usage | seul le collecteur Express fait varier le compteur |
| Lecture seule | `INSERT` dans `heap_logs` avec `spiderhome_ro` | refus MySQL |
| Synchronisation | `php artisan spiderhome:sync` | compteurs non nuls au premier passage |
| Nouveau module | configurer une carte, attendre 2 min | apparaît seule dans « Modules » |
