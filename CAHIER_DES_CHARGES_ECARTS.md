# Écart cahier des charges ↔ code livré

Le `Cahier_des_charges_SpiderHome_Fleet_Manager.docx` décrit une plateforme
NestJS + React + Flutter + MQTT + Redis + MinIO, avec OTA firmware complète,
app mobile technicien, et une équipe de 2 personnes sur 30 jours. Ce n'est
techniquement pas ce qui existe dans le code (Laravel + Angular, lecture des
tables legacy `heap_logs`/`module_installs`) — et une réécriture complète
dans cette autre stack est hors de portée de cette session.

Ce document liste ce qui a été ajouté pour combler les écarts **réalistes
dans l'architecture actuelle**, et ce qui reste **structurellement absent**
(nécessite un chantier séparé).

---

## Ajouté dans cette session

### 1. Contrôle d'accès par rôle et isolation client — REC-02, §4
**Le plus grave des écarts : n'importe quel compte connecté pouvait lire et
modifier les données de n'importe quel client.** Aucune route ne vérifiait
de rôle, aucun modèle ne filtrait par client.

- 5 rôles du cahier : `admin`, `support`, `technician`, `quality`, `client`
  (`App\Models\User::ROLES`)
- Isolation automatique : `App\Models\Concerns\CustomerScoped`, un global
  scope Eloquent appliqué sur `Customer`, `Site`, `Device`, `ServiceRequest`,
  `Alert`, `DeviceEvent` — un compte client ne voit jamais une ligne qui
  n'est pas la sienne, sans que chaque contrôleur ait à y penser
- Un technicien ne voit que les demandes SAV qui lui sont assignées
- Écritures (créer/modifier/supprimer clients, sites, modules, modèles)
  réservées à `admin`/`support` via le middleware `role:...`
- `GET /api/fleet/heap-history?device=...` corrigé spécifiquement : c'était
  la seule route qui interrogeait la base legacy par simple chaîne de
  caractères, en contournant le scope Eloquent — un client pouvait y lire
  la courbe mémoire de n'importe quel module en devinant son numéro de
  série
- Les adaptateurs bas niveau (`/api/heap-logs/*`, `/api/module-installs/*`,
  `/api/logs`, `/api/chart`, `/api/installations`) sont désormais réservés
  aux rôles internes : ils interrogent la base legacy par clé brute, sans
  notion de client, donc jamais accessibles à un compte `client`

### 2. Gestion des comptes utilisateurs
Inexistante avant (aucune route). Ajouté `UserController` (admin uniquement) :
créer/modifier/supprimer un compte, avec forçage `customer_id` obligatoire
pour tout compte de rôle `client`.

### 3. Journal d'audit — REC-11, §10
Inexistant avant. Ajouté :
- table `audit_logs`, volontairement sans route de modification/suppression
  (immuable)
- tracé : connexions (réussies et échouées), déconnexions, création/
  modification/suppression de clients/sites/modules/modèles/comptes,
  acquittement/résolution/réouverture d'alerte
- lecture via `GET /api/audit-logs` (admin/support/quality)

### 4. Catalogue d'événements complet — §7.3
Avant : 5 types gérés (`BOOT`, `WATCHDOG_RESET`, `LOW_HEAP`, `WIFI_LOST`,
`SUPLA_OFFLINE`, `UPDATE_REQUIRED`). Le cahier en définit 12, avec une
gravité par défaut et une action attendue précises pour chacun.

Ajouté dans `EventNormalizerService` : `BROWNOUT`, `HIGH_FRAGMENTATION`,
`WIFI_FLAPPING` (remplace `WIFI_LOST`), `LITTLEFS_ERROR`, `UPDATE_FAILED`,
`ROLLBACK`, `MOTOR_SAFETY_EVENT`, `RESTART_REQUESTED` — gravités et
libellés repris mot pour mot de la table du cahier.

### 5. Score de santé explicable 0-100 — §7.2
Avant : 3 paliers catégoriels (sain / surveillance / critique), déjà
explicables mais pas chiffrés. Ajouté `HealthRuleEngine::scoreDevice()` :
score par déductions à partir de 100 (mémoire, connectivité, événements
critiques des dernières 24h par type, alertes ouvertes), avec le détail de
chaque déduction (`score_breakdown`) affiché sur la fiche module.

### 6. QR code de fiche module — §7/§8
Code mort trouvé : la route n'était jamais enregistrée et la classe
`QrCodeService` référencée n'existait pas — un appel aurait provoqué une
erreur fatale. Route enregistrée (`GET /api/devices/{id}/qr`), service
implémenté avec `chillerlan/php-qrcode`.

⚠️ **Cette dernière brique n'a pas pu être testée par exécution dans cet
environnement** (pas de PHP/Docker disponibles ici). À vérifier après
déploiement : `curl .../api/devices/1/qr` doit renvoyer un SVG valide et
scannable.

---

## Structurellement absent — nécessite un chantier séparé

Rien ci-dessous n'a été ajouté : ce sont des sous-systèmes entiers, pas des
correctifs.

| Élément du cahier | Pourquoi c'est hors de portée ici |
|---|---|
| Stack NestJS + React + Flutter | Réécriture complète, pas une évolution du code actuel |
| MQTT, Redis/BullMQ, MinIO | Infrastructure absente de la stack Docker actuelle |
| OTA firmware (catalogue, campagnes, consentement, rollback réel) | Sous-système entier ; le cahier précise lui-même qu'ESP-07 ne fait pas d'OTA |
| Application mobile technicien (scan QR, intervention hors-ligne) | Développement Flutter séparé |
| MFA administrateurs | Authentification actuelle : Sanctum + mot de passe seul |
| Renommage des statuts SAV (« reçue », « rendez-vous proposé »…) | Cosmétique, pas fait pour ne pas complexifier un changement déjà large ; les statuts actuels (`open`/`in_progress`/`resolved`/`closed`) restent fonctionnels |
| Export fiche parc client (PDF/CSV) sans secrets | Pas encore fait — ajout simple si prioritaire |
| Interface d'administration des rôles/audit côté Angular | Le backend existe (§1-3 ci-dessus) ; pas d'écran Angular dédié encore construit |

Si vous voulez avancer sur l'un de ces points, dites lequel en priorité —
plusieurs (export CSV, écran d'audit Angular) sont largement plus rapides
que d'autres (MFA, OTA).
