# 🕷️ SpiderHome Fleet Manager — Prototype de Supervision IoT

**SpiderHome Fleet Manager** est la plateforme centralisée d'administration et de télémétrie permettant de superviser le parc de modules IoT SpiderHome installés chez les clients, de diagnostiquer leur état de santé, de suivre les alertes de maintenance et d'enregistrer les consentements aux mises à jour firmware.

---

## 🛠️ Stack Technique Officielle

- **Frontend** : Angular 17+ (TypeScript 5, SCSS modularisé, composants autonomes *Standalone*)
- **Backend** : Laravel 11 / PHP 8.2+ (API REST JSON, Authentification Sanctum)
- **Base de Données** : MySQL 8.x (Moteur InnoDB, encodage `utf8mb4_unicode_ci`)
- **Télémétrie & Logs** : Adaptateur en lecture seule vers les tables Express préexistantes (`heap_logs`, `module_installs`)

---

## 📋 Prérequis Système

Avant toute installation sur une nouvelle machine, vérifiez les outils suivants :
- **Node.js** : v18.x ou v20.x (`node -v`)
- **npm** : v9.x ou v10.x (`npm -v`)
- **PHP** : >= 8.2 (`php -v`) avec extensions : `pdo_mysql`, `openssl`, `mbstring`, `tokenizer`, `xml`, `ctype`, `json`
- **Composer** : v2.x (`composer -v`)
- **MySQL** : 8.x en cours d'exécution
- **Angular CLI** : `npm install -g @angular/cli`

---

## 🚀 Procédure d'Installation Pas-à-Pas

### 1. Cloner le Projet

```bash
git clone https://github.com/ERITECH-PRO/spiderhome-fleet-monitor-stage.git
cd spiderhome-fleet-monitor-stage
```

---

### 2. Configuration & Lancement du Backend (Laravel API)

```bash
cd back

# Installation des dépendances Composer
composer install

# Configuration de l'environnement
cp .env.example .env

# Génération de la clé d'application
php artisan key:generate
```

Éditez le fichier `.env` pour configurer vos accès MySQL :

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=spiderhome_fleet
DB_USERNAME=root
DB_PASSWORD=votre_mot_de_passe
```

Exécutez les migrations et le seeder reproductible sur données fictives :

```bash
# Migrations et jeux de données de démonstration
php artisan migrate:fresh --seed

# Lancement du serveur API Laravel (Port 8000)
php artisan serve
```
Le serveur API backend est désormais actif sur **`http://localhost:8000`**.

---

### 3. Configuration & Lancement du Frontend (Angular)

Ouvrez un second terminal à la racine du projet :

```bash
cd front

# Installation des paquets npm
npm install

# Lancement du serveur de développement Angular (Port 4200)
npx ng serve
```
L'application web frontend est désormais accessible sur **`http://localhost:4200`**.

---

## 🔑 Comptes de Démonstration Fictifs

| Rôle | Adresse E-mail | Mot de passe | Permissions |
|---|---|---|---|
| **Administrateur** | `ramif792@gmail.com` | `password` | Accès complet (CRUD Clients, Sites, Modèles, Modules, SAV) |
| **Technicien** | `tech@spiderhome.com` | `password` | Supervision télémétrique, santé & diagnostics |

> ⚠️ **Sécurité** : Ces comptes sont exclusivement réservés aux environnements de démonstration et de test sur données fictives. Aucun secret réel n'est commité dans Git.

---

## 📚 Documentation & Contrat d'Intégration API

Toute la documentation d'intégration et les spécifications de tests sont regroupées dans le dossier `/docs` :

- 📜 **Spécification OpenAPI 3.0** : [`docs/api/openapi.yaml`](file:///c:/Users/RAMI/Documents/GitHub/spiderhome-fleet-monitor-stage/docs/api/openapi.yaml)
- 📬 **Collection Postman** : [`docs/postman/SpiderHome.postman_collection.json`](file:///c:/Users/RAMI/Documents/GitHub/spiderhome-fleet-monitor-stage/docs/postman/SpiderHome.postman_collection.json)
- 🧪 **Plan de Tests (T01 à T18)** : [`docs/tests/test-plan.md`](file:///c:/Users/RAMI/Documents/GitHub/spiderhome-fleet-monitor-stage/docs/tests/test-plan.md)
- 📊 **Résultats d'Exécution des Tests** : [`docs/tests/test-results.md`](file:///c:/Users/RAMI/Documents/GitHub/spiderhome-fleet-monitor-stage/docs/tests/test-results.md)

---

## 🛡️ Audit de Sécurité & Coexistence

1. **Validation Laravel Stricte** : Tous les endpoints vérifient les formats, unicité des numéros de série (ex: `SN-001`) et contraintes de clés étrangères (HTTP 422 en cas de doublon).
2. **Protection des Secrets** : Le fichier `.gitignore` bloque l'inclusion des fichiers `.env`, jetons et mots de passe.
3. **Coexistence avec l'existant** : L'adaptateur Laravel accède en **lecture seule** aux tables Express `heap_logs` et `module_installs`, garantissant le fonctionnement parallèle sans aucun risque pour les données de production.
4. **Interface Responsive** : Layout adaptatif testé et validé à partir de **360px** de largeur sans aucun décalage visuel.
