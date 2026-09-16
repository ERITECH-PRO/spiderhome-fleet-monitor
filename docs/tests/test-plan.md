# Plan de Tests Globaux & Grille de Recette — J11

**Projet** : SpiderHome Fleet Manager (Prototype de supervision de la flotte IoT)  
**Portée** : Validation fonctionnelle, API, Sécurité, Responsive (360px+), Coexistence  
**Date** : 31 Août 2026  

---

## 📋 Grille Récapitulative des Tests (T01 à T18)

| ID | Domaine / Scénario | Description du Test & Critère de Recette | Méthode & Condition d'Entrée | Résultat Attendu |
|---|---|---|---|---|
| **T01** | **Authentification** | Connexion utilisateur valide | `POST /api/login` avec identifiants valides (`ramif792@gmail.com` / `password`) | Jeton Bearer reçu (HTTP 200), stockage local et accès autorisé au Dashboard. |
| **T02** | **Authentification** | Gestion des erreurs de connexion | Saisie d'email invalide, mot de passe incorrect ou champs vides | Blocage avec message d'erreur clair (HTTP 401 / 422), aucun jeton émis. |
| **T03** | **Authentification** | Protection des routes métiers | Accès direct aux URL `/dashboard`, `/customers`, `/devices` sans jeton | Redirection automatique vers `/login` (HTTP 401), écrans métiers inaccessibles. |
| **T04** | **Clients** | Création d'un client fictif complet | `POST /api/customers` avec nom, email, téléphone unique, SIRET et ville | Client créé avec succès (HTTP 201), affiché dans le tableau. Validation doublons active. |
| **T05** | **Clients** | Modification des informations client | `PUT /api/customers/{id}` (mise à jour du téléphone ou du statut) | Données enregistrées (HTTP 200), passage "ancienne donnée" ➔ "nouvelle donnée". |
| **T06** | **Clients** | Recherche et filtrage textuel | Saisie dans la barre de recherche par nom ou email | Résultats filtrés dynamiquement (HTTP 200). Réinitialisation propre au reset. |
| **T07** | **Sites** | Création et géolocalisation de site | `POST /api/sites` avec adresse, timezone et contact | Site enregistré (HTTP 201) et correctement rattaché à son client parent. |
| **T08** | **Sites** | Association Client ➔ Site | `GET /api/sites?customer_id={id}` | Liste des sites rattachés au client spécifié (HTTP 200). |
| **T09** | **Modules IoT** | **Contrainte d'unicité du numéro de série (SN)** | Création d'un 2ème module avec le même numéro de série (ex: `SN-001`) | **Création refusée (HTTP 422)** avec le message : *"The serial_number has already been taken."* |
| **T10** | **Événements** | Injection des 6 types d'événements minimum | Validation des types : `BOOT`, `WATCHDOG_RESET`, `LOW_HEAP`, `WIFI_LOST`, `SUPLA_OFFLINE`, `UPDATE_REQUIRED` | Événements enregistrés (HTTP 201 / 200) avec date, gravité, module et valeur technique. |
| **T11** | **Événements** | Filtrage par type et gravité | `GET /api/device-events?type=LOW_HEAP` | Événements filtrés dynamiquement et affichés dans la chronologie. |
| **T12** | **Santé Modules** | Évaluation automatique de l'état de santé | Vérification des seuils télémétriques (`Sain`, `Surveillance`, `Critique`) | Diagnostic unifié (HTTP 200) conforme aux règles documentées (`healthy`, `warning`, `critical`). |
| **T13** | **Interventions SAV** | Création d'un ticket de maintenance | `POST /api/service-requests` (rattachement client, site, device, motif, priorité) | Ticket généré avec référence unique (HTTP 201). |
| **T14** | **Interventions SAV** | Workflow des 5 statuts & Timeline | Parcours : `Nouvelle (open)` ➔ `En analyse / Planifiée (in_progress)` ➔ `Terminée (resolved)` / `Annulée` | Transitions enregistrées (HTTP 200) avec notes d'historique dans la timeline. |
| **T15** | **Mises à Jour** | Simulation du consentement client | `PATCH /api/update-notices/{id}/consent` (Consentement `granted` ou `refused`) | Consentement enregistré (HTTP 200). **Aucune connexion réseau réelle vers le module IoT**. |
| **T16** | **API & Statuts** | Gestion rigoureuse des codes d'erreur HTTP | Vérification des codes : 200, 201, 400, 401, 403, 404, 422, 500 | Réponses JSON structurées sans fuite de stacktrace ou d'information sensible. |
| **T17** | **UI / Responsive** | Robustesse d'affichage multi-résolution | Tests sur écrans : 360px, 375px, 390px, 412px, 768px, 1024px, 1280px, 1440px | Aucun scroll horizontal, modales et tableaux lisibles et adaptatifs dès 360px. |
| **T18** | **Coexistence & Git** | Intégrité production & hygiène du code | Adaptateur en lecture seule vers `heap_logs` et `module_installs`, absence de secrets dans Git | Base de données de production intacte, fichier `.gitignore` propre sans clés API. |

---

## 🛠️ Matrice de Couverture des Endpoints API

- `POST /api/login` (Auth Sanctum)
- `POST /api/logout` (Destruction session)
- `GET  /api/me` (Profil connecté)
- `GET/POST/PUT/DELETE /api/customers` (CRUD Clients)
- `GET/POST/PUT/DELETE /api/sites` (CRUD Sites)
- `GET/POST/PUT/DELETE /api/device-models` (Catalogue Modèles)
- `GET/POST/PUT/DELETE /api/devices` (Parc Modules IoT)
- `GET /api/devices/{id}/health` (Fiche diagnostic santé)
- `GET/POST /api/device-events` (Journal des événements télémétriques)
- `GET/POST/PUT/PATCH/DELETE /api/service-requests` (Workflow SAV)
- `PATCH /api/service-requests/{id}/status` (Transitions de statut SAV)
- `GET /api/service-requests/{id}/histories` (Timeline SAV)
- `GET/POST/DELETE /api/update-notices` (Campagnes firmware)
- `PATCH /api/update-notices/{id}/consent` (Consentements)
- `GET /api/fleet/overview` (Synthese KPi flotte)
- `GET /api/fleet/events` (Journal filtrable flotte)
- `GET /api/fleet/heap-history` (Graphe temporel Heap)
- `GET /api/heap-logs` (Adaptateur lecture seule Express)
- `GET /api/module-installs` (Adaptateur lecture seule Express)
