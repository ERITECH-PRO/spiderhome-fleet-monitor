# Déploiement Docker — SpiderHome Fleet Monitor

## Stack

| Service | Rôle | Port hôte |
|---|---|---|
| `web` | Nginx : frontend Angular + proxy FastCGI vers l'API | **8089** |
| `api` | PHP-FPM 8.2 / Laravel — migrations au premier démarrage | interne |
| `scheduler` | `artisan schedule:run` toutes les minutes → `spiderhome:sync` | interne |

MySQL **n'est pas** dans la stack : la base `heap_monitoring` vit déjà dans
votre conteneur `mysql_central` (port hôte 3307).

### Choix du port 8089

Ports déjà occupés sur le VPS : 80, 81, 443, 3000, 3001, 3003, 3005, 3010,
3012, 3101, 3102, 3103, 3307, 4321, 5000, 5174, 5176, 5678, 5679, 8082, 8083,
8084, 8085, 8087, 8088, 9000, 9002, 9010, 9011, 9443 — plus 3006 hors Docker
pour le collecteur Express.

**8089 est libre.** Pour en changer, modifier une seule ligne dans
`docker-compose.yml` (`ports: - "8089:80"`).

Ensuite, dans **nginx-proxy-manager** (déjà en place sur 80/443) :
`monitor.spiderhome.org` → `http://<ip_hôte>:8089`, avec certificat Let's Encrypt.

---

## Installation

```bash
cd /opt/PROJET
# déposer le projet dans /opt/PROJET/spiderhome-fleet-monitor
cd spiderhome-fleet-monitor

cp .env.docker.example .env.docker
nano .env.docker          # mots de passe MySQL, ADMIN_*, SPIDERHOME_INGEST_TOKEN
```

Générer la clé applicative :

```bash
docker compose --env-file .env.docker build api
docker compose --env-file .env.docker run --rm api php artisan key:generate --show
# copier la valeur base64:… dans APP_KEY de .env.docker
```

Démarrer :

```bash
docker compose --env-file .env.docker up -d --build
docker compose logs -f api
```

Le conteneur `api` exécute au démarrage : attente de MySQL → `migrate --force`
→ création du compte administrateur (si `ADMIN_*` renseignés) → première
synchronisation du parc.

**Après le premier démarrage, vider `ADMIN_PASSWORD` de `.env.docker`** et
changer le mot de passe depuis l'interface.

---

## Comptes MySQL à créer

Depuis phpMyAdmin (port 8083) ou en ligne de commande :

```sql
-- Compte applicatif : tables métier
CREATE USER 'spiderhome_app'@'%' IDENTIFIED BY '<mot_de_passe>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON heap_monitoring.* TO 'spiderhome_app'@'%';

-- Compte lecture seule : garantie de non-régression sur le legacy
CREATE USER 'spiderhome_ro'@'%' IDENTIFIED BY '<mot_de_passe>';
GRANT SELECT ON heap_monitoring.heap_logs       TO 'spiderhome_ro'@'%';
GRANT SELECT ON heap_monitoring.module_installs TO 'spiderhome_ro'@'%';

FLUSH PRIVILEGES;
```

`'%'` est nécessaire car les conteneurs se connectent depuis le réseau Docker,
pas depuis `localhost`. Le port 3307 de `mysql_central` étant publié sur
`0.0.0.0`, restreignez-le au pare-feu si la machine est exposée sur Internet :

```bash
ufw allow from 172.16.0.0/12 to any port 3307 proto tcp
ufw deny 3307/tcp
```

---

## Exploitation

```bash
# Synchronisation manuelle
docker compose exec api php artisan spiderhome:sync

# Logs du scheduler
docker compose logs -f scheduler

# Console Laravel
docker compose exec api php artisan tinker

# Vérifier l'état
curl -s http://localhost:8089/api/health

# Mise à jour du code
git pull && docker compose --env-file .env.docker up -d --build

# Vider les caches après un changement de .env.docker
docker compose restart api scheduler
```

---

## Le collecteur Express reste hors Docker

`server.js` (port 3006, PM2) continue de tourner tel quel. Les modules
installés pointent dessus : y toucher imposerait une mise à jour firmware sur
tout le parc. Les conteneurs lisent simplement la même base MySQL.

Si vous souhaitez le conteneuriser plus tard, il devra garder **exactement** le
port 3006 et les mêmes variables `DB_*` qu'aujourd'hui.

---

## Vérifications après démarrage

| Contrôle | Commande | Attendu |
|---|---|---|
| Conteneurs | `docker compose ps` | trois services `Up` |
| Sonde | `curl -s localhost:8089/api/health` | `"status":"ok"` sur les deux bases |
| API protégée | `curl -i localhost:8089/api/devices` | `401` |
| Front | ouvrir `http://<ip>:8089` | écran de connexion |
| Synchronisation | `docker compose exec api php artisan spiderhome:sync` | compteurs non nuls |
| Non-régression | `SELECT COUNT(*) FROM heap_logs;` avant / après 24 h | seul Express fait varier le compteur |
