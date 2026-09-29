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

### 7. Regroupement d'incidents — §7.3
Avant : seuls 2 types d'événements sur les 12 du catalogue (`heap_low`,
`offline`) ouvraient une alerte groupée. Les 10 autres — dont
`MOTOR_SAFETY_EVENT`, explicitement « priorité maximale » au cahier — ne
déclenchaient rien de visible, seulement une ligne dans `device_events`.

Ajouté : `FleetSyncService::upsertIncident()` généralise le regroupement à
tous les types notables (warning/critical). Chaque incident conserve
désormais première/dernière occurrence, compteur, priorité, diagnostic et
propriétaire (colonnes ajoutées sur `alerts`), comme demandé au cahier.
Nouveaux endpoints `PATCH /alerts/{id}/assign` et `/diagnostic`. Nouvel
écran Angular **Incidents** (`/incidents`, rôles internes) : file
priorisée, filtres priorité/gravité/non-assigné, assignation, diagnostic.

### 8. Fiche parc client et export — §7.1
Champs ajoutés sur `devices` : `installed_at` (pose physique, distinct du
premier contact réseau automatique), `installer_name`, `initial_firmware`,
`warranty_until` — visibles et modifiables depuis la fiche module et
exposés dans la fiche diagnostic.

Export CSV `GET /customers/{id}/export` : « fiche parc client sans exposer
les secrets techniques » — MAC, clé legacy et serveur SUPLA volontairement
exclus. Bouton d'export sur l'écran Clients.

### 9. Demandes d'intervention (SAV) — §7.4
Champs manquants ajoutés : `category` (catégorie de problème, 7 valeurs),
pièce jointe photo/vidéo facultative (15 Mo max), notes internes
distinctes des échanges visibles par le client (`is_internal`), sélecteur
de technicien dans l'écran (le champ `assigned_to` existait déjà en base
mais rien ne permettait de le renseigner).

Notifications in-app : table `notifications` + polling 60s côté Angular
(cloche dans la navbar). Le client et le technicien assigné sont notifiés
à chaque changement de statut ou d'assignation ; l'équipe support/admin
est notifiée à la création d'une demande. Pas d'e-mail ni de push — seule
l'infra OTP (Brevo) existe, et elle n'est câblée qu'au mot de passe oublié.

Bug de conception trouvé en cours de route : la relation Eloquent
`assignedTo()` écrasait la colonne brute `assigned_to` dans le JSON
(collision de clé), ce qui aurait rendu le sélecteur technicien inutilisable
dès sa mise en service. Corrigé avant de construire l'écran qui en dépend.

### 10. MFA administrateurs — §10
Aucune double authentification n'existait. Ajouté : TOTP (RFC 6238) en PHP
pur — aucune nouvelle dépendance Composer, contrairement au QR code plus tôt
dans cette session. Compatible Google Authenticator, 1Password, Authy.

- Secret et codes de récupération chiffrés en base (cast `encrypted`, clé
  APP_KEY) — jamais en clair
- Connexion en deux temps : mot de passe correct + 2FA activée → jeton de
  défi temporaire (5 min), puis `/login/2fa` avec le code à 6 chiffres ou
  un code de récupération à usage unique
- Écran **Mon compte** (`/profile`) : activation avec QR à scanner, 8 codes
  de récupération affichés une seule fois, désactivation avec mot de passe

Ouvert à tout rôle plutôt que forcé pour admin uniquement : forcer
l'activation dès le tout premier login créerait un risque de blocage
(impossible de configurer la 2FA sans être déjà connecté). Fortement
recommandé pour les comptes admin en production — voir DEPLOIEMENT.md.

### 11. Fraîcheur des données et hachage des mots de passe — §10 / §11
Deux écarts numériques trouvés en relisant les exigences non fonctionnelles :

- **Fraîcheur** : le cahier cible un état visible sous 30 s après réception ;
  la synchronisation tournait toutes les 60 s (`Schedule::everyMinute()`,
  la granularité minimale de cron). Le conteneur `scheduler` appelle
  désormais `spiderhome:sync` toutes les 20 s directement (sans passer par
  `schedule:run`, qui reste utilisé pour un déploiement non-Docker — un
  service systemd équivalent est documenté dans `DEPLOIEMENT.md` pour ce cas,
  puisque le cron classique ne descend pas sous la minute).
- **Hachage** : le cahier demande explicitement Argon2id ; aucun
  `config/hashing.php` n'existait, Laravel utilisait donc bcrypt par défaut.
  Ajouté avec les paramètres recommandés OWASP. Les mots de passe déjà en
  base ne sont pas affectés — chaque hash porte son algorithme dans son
  préfixe, donc la vérification des anciens mots de passe bcrypt continue
  de fonctionner ; seuls les nouveaux (création de compte, réinitialisation)
  utilisent Argon2id.

Vérifié en même temps et déjà couvert sans modification : le rate limiting
global existe via le middleware `api` de Laravel 11 (60 req/min par défaut),
en plus du throttle renforcé (10/min) déjà en place sur login/OTP.

### 12. Spécification OpenAPI — §9
Un fichier `docs/api/openapi.yaml` existait déjà (écrit par le stagiaire)
mais datait d'avant toutes les évolutions de cette session : il référençait
encore l'ancien module OTA supprimé (`/update-notices/.../consent`),
des valeurs d'énumération fausses par rapport au code réel (priorités SAV
`medium` au lieu de `normal`, type d'événement `WIFI_LOST` renommé depuis
en `WIFI_FLAPPING`), et ne mentionnait ni les rôles ni l'isolation client.

Réécrit intégralement : 40 chemins documentés (authentification, MFA,
registre métier, incidents, SAV, administration, notifications, tableau de
bord), schémas de données alignés sur les modèles Eloquent réels, note
d'isolation par rôle sur chaque groupe. Validé — YAML syntaxiquement
correct, toutes les références `$ref` résolues (vérifié par script, pas
seulement relu à l'œil).

Le préfixe `/api/v1` cité dans la même exigence du cahier n'a délibérément
pas été adopté (voir la table ci-dessous) : la spec documente les chemins
réels de production (`/api/...`).

**Trouvé en cours de route, non corrigé** : `docs/tests/test-plan.md` et
`docs/postman/SpiderHome.postman_collection.json` datent eux aussi d'avant
cette session (mêmes énumérations obsolètes, plus une adresse e-mail
personnelle du stagiaire utilisée comme identifiant de test dans les deux
fichiers). Les réécrire proprement demanderait de pouvoir exécuter les
tests pour les valider, ce qui n'est pas possible ici — signalé plutôt que
silencieusement laissé tel quel. Postman peut de toute façon importer
`docs/api/openapi.yaml` directement pour régénérer une collection à jour.

### 13. Scan de QR pour rattacher un module — §7.1
« Scanner un QR code pour rattacher une carte au client et au site » —
jusqu'ici seule la génération du QR existait, pas le scan. Ajouté un
composant `QrScannerComponent` basé sur l'API navigateur native
`BarcodeDetector` (Chrome/Edge/Opera) — **aucune dépendance npm ajoutée**,
même prudence que pour le TOTP après les deux dépendances Composer
problématiques plus tôt dans cette session.

Flux : bouton « Scanner un module » (Modules, admin/support) → caméra →
décodage du JSON déjà encodé par `DeviceController::qr()` (`spdr` = numéro
de série) → recherche côté API → ouverture directe de la fiche d'édition
pour réaffectation au bon site.

**Limite honnête, non contournable sans dépendance externe** : `Barcode-
Detector` n'est pas supporté par Firefox ni Safari à ce jour — message
clair affiché sur ces navigateurs plutôt qu'un échec silencieux, avec
repli vers la recherche manuelle déjà existante. Nécessite aussi HTTPS (ou
localhost), comme tout accès caméra navigateur.

### 14. Droit à l'effacement RGPD — §10
« Minimisation, durée de conservation, export et suppression des données
personnelles » : l'export existait (§8), pas la suppression. Ajouté
`POST /customers/{id}/anonymize` (admin uniquement, confirmation explicite
requise, tracé dans le journal d'audit) : efface nom, e-mail, téléphone,
adresse, ville, SIRET et notes, **sans supprimer** la ligne, les sites, les
modules ni l'historique technique. Choix de conception délibéré : le droit
à l'effacement vise la personne, pas la destruction d'un historique de
maintenance légitime — et un vrai `DELETE` en cascade aurait cassé
l'intégrité de la télémétrie que l'architecture veille précisément à ne
jamais toucher.

**Limite connue** : ne touche pas aux comptes utilisateur de rôle « client »
rattachés à ce client — à supprimer séparément via `DELETE /users/{id}`. Je
n'ai pas voulu modifier silencieusement des comptes d'authentification sans
mécanisme de désactivation clair dans le modèle actuel.

---

## Structurellement absent — nécessite un chantier séparé

Rien ci-dessous n'a été ajouté : ce sont des sous-systèmes entiers, pas des
correctifs.

| Élément du cahier | Pourquoi c'est hors de portée ici |
|---|---|
| Stack NestJS + React + Flutter | Réécriture complète, pas une évolution du code actuel |
| MQTT, Redis/BullMQ, MinIO | Infrastructure absente de la stack Docker actuelle |
| OTA firmware (catalogue, campagnes, consentement, rollback réel) | Sous-système entier ; le cahier précise lui-même qu'ESP-07 ne fait pas d'OTA |
| Application mobile technicien (intervention hors-ligne) | Développement Flutter séparé ; le scan QR lui-même est fait — §13 ci-dessus (web, pas encore mobile natif) |
| MFA imposée obligatoirement pour le rôle admin | Disponible et fonctionnelle pour tous les rôles (§10 ci-dessus), mais pas forcée techniquement à l'activation d'un compte admin |
| Notifications par e-mail / push (SAV) | Seules les notifications in-app existent ; infra Brevo réservée à l'OTP mot de passe oublié |
| Renommage des statuts SAV (« reçue », « rendez-vous proposé »…) | Cosmétique ; les statuts actuels (`open`/`in_progress`/`resolved`/`closed`) restent fonctionnels |
| Disponibilités du client sous forme de plages horaires | `desired_at` (une date unique) existe déjà ; un vrai calendrier de disponibilités n'a pas été ajouté |
| « Compte rendu » d'intervention comme champ formel distinct | Couvert de façon informelle : le commentaire déjà associé à un changement de statut (ex. passage à « résolu ») joue ce rôle, sans champ dédié ni caractère obligatoire |
| Versionnement `/api/v1` | Risque de casser le frontend déjà déployé sans pouvoir tester le changement dans cet environnement ; non tenté (OpenAPI lui-même est fait, §12 ci-dessus) |
| `docs/tests/test-plan.md` et la collection Postman à jour | Datent d'avant cette session ; à régénérer depuis `docs/api/openapi.yaml` ou en repassant les 18 scénarios de recette manuellement |

Si vous voulez avancer sur l'un de ces points, dites lequel en priorité.

