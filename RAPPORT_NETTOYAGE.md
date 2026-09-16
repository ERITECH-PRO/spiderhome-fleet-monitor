# Rapport de nettoyage — version stagiaire → version déployable

Document de transfert. Il récapitule ce qui a été supprimé, corrigé et ajouté
pour passer du prototype de stage à une plateforme exploitable en production,
et pourquoi.

---

## 1. Rappel du besoin

La plateforme supervise le **parc installé**. Elle ne pilote rien.

Le module en mode configuration ouvre un point d'accès ; le client se connecte
sur `http://192.168.4.1` et saisit son WiFi, **l'e-mail de son compte** et
**l'adresse du serveur** domotique (`cloud.spiderhome.org`, `svr124.supla.org`,
etc.). Le module se déclare ensuite tout seul.

Les deux tables existantes portent exactement cette information :

| Table | Rôle | Colonnes clés |
|---|---|---|
| `module_installs` | identité du module | `device`, `device_name`, `firmware`, `mac`, `supla_server`, `email` |
| `heap_logs` | télémétrie | `heap`, `heap_effective`, `max_block`, `frag_pct`, `uptime`, `event`, `status` |

**Conséquence d'architecture :** le client et le module ne doivent pas être
saisis à la main. C'est le point central que le prototype de stage avait manqué
— il proposait des CRUD manuels et les données réelles n'entraient jamais dans
le registre métier.

---

## 2. Corrections bloquantes

### 2.1 Écriture de fausses données dans la table de production

`FleetDashboardController::heapHistory()` insérait environ 240 lignes de
télémétrie générée aléatoirement **directement dans `heap_logs`** quand un
module n'avait pas d'historique. En production, cela aurait fabriqué de
l'historique inventé sur des cartes clientes.

→ Bloc supprimé. Sans relevé, la réponse est simplement vide.

### 2.2 Migration destructrice

`2026_08_19_090000_rename_legacy_tables…` exécutait un `RENAME TABLE`, un
`DROP TABLE IF EXISTS module_installs`, et son `down()` supprimait **les deux
tables legacy**. Un `migrate:rollback` ou `migrate:fresh` détruisait toute la
télémétrie client.

→ Migration neutralisée : elle se contente désormais de vérifier la présence
des tables. Aucune migration Laravel ne touche plus au legacy.

### 2.3 API ouverte

Étaient accessibles **sans authentification** : `/api/logs`, `/api/chart`,
`/api/stats`, `/api/installations`, `/api/heap-logs/*`, `/api/module-installs/*`,
`/api/devices/{id}/health`. `/api/installations` expose e-mails clients, MAC et
serveur SUPLA.

→ Tout est passé derrière `auth:sanctum`. Seuls restent publics : `login`,
le parcours mot de passe oublié (limités à 10 requêtes/minute) et `/api/health`.

### 2.4 Fuite d'informations par la sonde de santé

`/api/health` renvoyait le message d'exception SQL brut (hôte, base, parfois
identifiants) sur un endpoint public.

→ Réécrite : deux booléens, aucun détail. Les erreurs partent dans les logs.

### 2.5 Ingestion inutilisable

`IngestController` refusait tout module absent de la table `devices`
(`DEVICE_NOT_FOUND`) et attendait un format que le firmware n'envoie pas.
Aucune carte réelle n'aurait été acceptée.

→ Remplacé par un provisionnement automatique (§3) et un endpoint
`POST /api/ingest/status` protégé par jeton (§4).

### 2.6 Configuration base de données incohérente

Trois connexions se recouvraient (`mysql`, `mysql_legacy`, `heap_monitoring`),
cette dernière pointant par défaut sur une base `SpiderHome` inexistante.
Défaut global : `sqlite`.

→ Deux connexions : `mysql` (métier) et `heap_monitoring` (legacy, lecture
seule), avec `DB_HEAP_*` documenté et repli propre.

### 2.7 CORS ouvert

`allowed_origins => ['*']`.

→ Restreint à `FRONTEND_URL` (+ `localhost:4200` en local).

---

## 3. Provisionnement automatique — l'ajout principal

Nouveau service `App\Services\FleetSyncService` + commande
`php artisan spiderhome:sync`, planifiée **toutes les minutes**.

À chaque passage :

1. lit la dernière ligne de `module_installs` par module ;
2. crée / retrouve le **client** à partir de l'e-mail déclaré, avec son
   `server_address` ; les modules sans e-mail vont dans « Modules non rattachés » ;
3. crée un **site** par défaut, un **modèle** déduit de `device_name` ;
4. crée / met à jour la fiche **module** (`legacy_device_key`, MAC, firmware,
   serveur) ;
5. lit le dernier relevé `heap_logs` par module : heap, fragmentation, uptime,
   statut, dernière vue ;
6. calcule l'état `online` / `offline` / `alert` ;
7. ouvre et **referme** les alertes (`offline`, `heap_low`).

Les seuils reprennent **exactement** ceux de `server.js` : heap < 6 000 octets =
CRITICAL, ≤ 8 000 octets = WARNING. Le dashboard legacy et la nouvelle
plateforme donnent donc le même verdict. Ils sont paramétrables
(`config/spiderhome.php`, variables `SPIDERHOME_*`).

Un module réaffecté manuellement à un site par un opérateur n'est jamais
déplacé par la synchronisation (`auto_provisioned = false`).

---

## 4. Bloc « Statut » repris du cloud

Le panneau affiché par `cloud.spiderhome.org` / `cloud.supla.org` (GUID,
firmware version, enregistré, dernière connexion, IP, MAC, Wi-Fi RSSI, signal
strength, uptime, connection uptime) est désormais modélisé :

- colonnes ajoutées sur `devices` : `guid`, `supla_connected`, `registered_at`,
  `last_connected_at`, `wifi_rssi`, `wifi_quality_pct`, `connection_uptime`
  (+ `ip_address`, `last_uptime` déjà présents) ;
- endpoint `POST /api/ingest/status`, protégé par `SPIDERHOME_INGEST_TOKEN`,
  désactivé tant que le jeton est vide, et qui n'écrit jamais dans le legacy ;
- exposé par `GET /api/devices/{id}/health` sous la clé `supla_status` ;
- affiché dans la fiche module (carte « Statut »).

Le GUID n'est **plus généré par la plateforme**. La version stage fabriquait des
GUID aléatoires et des IP `192.168.110.x` factices dans une migration : le GUID
est l'identité du module, il ne peut venir que du module.

> L'ajout de cet appel côté firmware relève de M. Eric. En attendant, la
> plateforme fonctionne complètement avec `heap_logs` et `module_installs`.

---

## 5. Supprimé

| Élément | Volume | Motif |
|---|---|---|
| Module « avis de mise à jour / consentement OTA » (front + back + tables + migrations) | ~1 900 lignes | Consentement **simulé**, aucun firmware téléchargé. En production, un écran de consentement sans valeur juridique ni effet réel induit opérateurs et clients en erreur. L'OTA réelle reste à faire côté firmware — et reste interdite sur ESP-07. |
| Seeders de démonstration (`FleetSeeder`, `AlertSeeder`, `UpdateNoticeSeeder`, `BusinessRegistrySeeder`) + factories | 1 319 lignes | Données fictives. Remplacés par un seeder créant uniquement le compte administrateur. |
| `back/scratch/` (10 scripts de diagnostic) | — | Scripts jetables, plusieurs avec identifiants en dur. |
| `seed.js`, `test_parcours_robuste.js`, dossier `api-backend/` orphelin | — | Résidus de développement. |
| Commande `fleet:refresh-dates` | — | Décalait les dates des données de démo pour qu'elles paraissent récentes. |
| Migration de faux GUID / fausses IP | — | Voir §4. |
| Modèles morts : `Technician`, `FirmwareVersion`, `Intervention`, `LegacyHeapLog`, `UpdateNotice` | — | Aucune référence dans le code. |
| Tables `technicians`, `firmware_versions`, `interventions` | — | Jamais utilisées ; `alerts` conservée. |
| Scaffolding Laravel inutilisé (`resources/js`, `resources/css`, `vite.config.js`, `back/package.json`, `welcome.blade.php`) | — | Le frontend est Angular. |
| Tests reposant sur les seeders de démo | 4 fichiers | Devenus faux après suppression des données fictives. |

---

## 6. Conservé et pourquoi

- **Collecteur Express (`server.js`, `public/index.html`) : inchangé.** Les
  modules déjà installés pointent dessus ; y toucher imposerait une mise à jour
  firmware sur tout le parc. Laravel lit la même base.
- **SAV / demandes d'intervention.** C'est le seul module à saisie manuelle,
  mais il figure au cahier des charges du Fleet Manager et fonctionne sur des
  données réelles. Il est isolé : suppression simple si vous préférez une
  plateforme strictement automatique (`ServiceRequest*`, `interventions.component`,
  routes `service-requests`).
- **Clients / sites / modèles en écriture.** Alimentés automatiquement, mais
  les écrans restent modifiables pour corriger un libellé ou un rattachement.
- **Réinitialisation de mot de passe par OTP (Brevo).** Fonctionnelle ;
  désactivée si `BREVO_API_KEY` est vide.
- **E-mails et MAC visibles** par défaut dans l'interface opérateur :
  chez vous l'e-mail *est* l'identité du client. Basculer
  `SPIDERHOME_MASK_LEGACY=true` pour masquer.

---

## 7. Points restant à trancher

1. **Ingestion.** Confirmez que les modules continuent d'appeler Express
   (recommandé, zéro changement firmware) — ou faut-il basculer vers
   `/api/ingest/status` ?
2. **SAV.** À garder ou à retirer ?
3. **Sites.** Un client = un site par défaut. Si un client possède plusieurs
   maisons, le rattachement se fait à la main ; sinon la notion peut être
   retirée entièrement.
4. **Rétention.** `heap_logs` grossit vite (plus de 61 000 lignes à ce jour).
   Prévoir une purge ou une agrégation au-delà de N jours.
5. **Migration des données.** Aucun `ALTER` n'est fait sur les tables legacy ;
   les index recommandés dans `DEPLOIEMENT.md` sont à ajouter manuellement.

---

## 8. Vérification de non-régression

Avant mise en service, prouver que le legacy est intact :

```sql
SELECT COUNT(*), MAX(id) FROM heap_logs;
SELECT COUNT(*), MAX(id) FROM module_installs;
```

Relancer après une journée d'exploitation : seuls les compteurs alimentés par
le collecteur Express doivent bouger. La plateforme utilise un compte MySQL
en lecture seule sur ces deux tables — la garantie est au niveau du SGBD, pas
seulement du code.
