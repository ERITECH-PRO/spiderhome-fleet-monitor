<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TwoFactorController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\DeviceEventController;
use App\Http\Controllers\Api\DeviceModelController;
use App\Http\Controllers\Api\DeviceStatusController;
use App\Http\Controllers\Api\FleetDashboardController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\HeapLogController;
use App\Http\Controllers\Api\LegacyDashboardController;
use App\Http\Controllers\Api\ModuleInstallController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ServiceRequestController;
use App\Http\Controllers\Api\SiteController;
use App\Http\Controllers\Api\UserController;
use App\Models\User;

/*
|--------------------------------------------------------------------------
| Routes publiques
|--------------------------------------------------------------------------
| Limitées au strict nécessaire : authentification et sonde de santé.
| Toute route exposant des données client est authentifiée (Sanctum).
*/

Route::middleware('throttle:10,1')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('login/2fa', [AuthController::class, 'loginTwoFactor']);
    Route::post('forgot-password', [PasswordResetController::class, 'forgotPassword']);
    Route::post('verify-otp',      [PasswordResetController::class, 'verifyOtp']);
    Route::post('reset-password',  [PasswordResetController::class, 'resetPassword']);
});

Route::get('health', HealthController::class);

// Bloc « Statut » publié par les modules (GUID, firmware, IP, RSSI, uptime…).
// Protégé par SPIDERHOME_INGEST_TOKEN, jamais par la session opérateur.
Route::post('ingest/status', DeviceStatusController::class)->middleware('throttle:120,1');

/*
|--------------------------------------------------------------------------
| Routes authentifiées
|--------------------------------------------------------------------------
| Lecture : chaque modèle applique automatiquement l'isolation client
| (App\Models\Concerns\CustomerScoped) — un compte « client » ne voit
| jamais les données d'un autre client, sans effort du contrôleur.
| Écriture : restreinte par rôle avec le middleware `role:...`
| (cahier des charges §4 « Utilisateurs et droits »).
*/

$staff = User::STAFF_ROLES;                    // admin, support, technician, quality
$manage = [User::ROLE_ADMIN, User::ROLE_SUPPORT]; // écriture sur le référentiel métier

Route::middleware('auth:sanctum')->group(function () use ($staff, $manage) {

    // ── Session ─────────────────────────────────────────────────────────────
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me',      [AuthController::class, 'me']);

    // ── Double authentification (MFA) — cahier §10 ───────────────────────────
    Route::get('two-factor/status',   [TwoFactorController::class, 'status']);
    Route::post('two-factor/enable',  [TwoFactorController::class, 'enable']);
    Route::post('two-factor/confirm', [TwoFactorController::class, 'confirm']);
    Route::post('two-factor/disable', [TwoFactorController::class, 'disable']);

    // ── Registre métier ─────────────────────────────────────────────────────
    // Lecture : tout compte authentifié (résultat filtré par rôle).
    // Écriture : admin/support uniquement — un client ne crée jamais un
    // site ou un module directement, ils viennent du provisionnement auto.
    Route::get('devices/{id}/health', [DeviceController::class, 'health']);
    Route::get('devices/{id}/qr', [DeviceController::class, 'qr']);
    Route::get('customers/{customer}/export', [CustomerController::class, 'export']);
    Route::post('customers/{customer}/anonymize', [CustomerController::class, 'anonymize'])
        ->middleware('role:' . User::ROLE_ADMIN);
    Route::apiResource('customers', CustomerController::class)
        ->except(['store', 'update', 'destroy']);
    Route::apiResource('customers', CustomerController::class)
        ->only(['store', 'update', 'destroy'])->middleware('role:' . implode(',', $manage));

    Route::apiResource('sites', SiteController::class)->except(['store', 'update', 'destroy']);
    Route::apiResource('sites', SiteController::class)
        ->only(['store', 'update', 'destroy'])->middleware('role:' . implode(',', $manage));

    Route::apiResource('device-models', DeviceModelController::class)->except(['store', 'update', 'destroy']);
    Route::apiResource('device-models', DeviceModelController::class)
        ->only(['store', 'update', 'destroy'])->middleware('role:' . implode(',', $manage));

    Route::apiResource('devices', DeviceController::class)->except(['store', 'update', 'destroy']);
    Route::apiResource('devices', DeviceController::class)
        ->only(['store', 'update', 'destroy'])->middleware('role:' . implode(',', $manage));

    Route::apiResource('device-events', DeviceEventController::class)->only(['index', 'show']);

    // ── SAV / demandes d'intervention ───────────────────────────────────────
    // Un client peut créer et consulter SES demandes (isolation automatique).
    // Seuls admin/support/technician font évoluer le statut d'une demande.
    Route::apiResource('service-requests', ServiceRequestController::class)
        ->except(['update', 'destroy']);
    Route::apiResource('service-requests', ServiceRequestController::class)
        ->only(['update', 'destroy'])->middleware('role:' . implode(',', $manage));
    Route::patch('service-requests/{serviceRequest}/status', [ServiceRequestController::class, 'updateStatus'])
        ->middleware('role:' . implode(',', array_merge($manage, [User::ROLE_TECHNICIAN])));
    Route::get('service-requests/{serviceRequest}/histories', [ServiceRequestController::class, 'histories']);
    Route::post('service-requests/{serviceRequest}/comments', [ServiceRequestController::class, 'addComment']);
    Route::get('service-requests/{serviceRequest}/attachment', [ServiceRequestController::class, 'attachment']);

    // ── Notifications in-app ─────────────────────────────────────────────────
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::patch('notifications/read-all', [NotificationController::class, 'markAllRead']);

    // ── Alertes ─────────────────────────────────────────────────────────────
    // Un client peut consulter les alertes de son propre parc, jamais les
    // gérer (acquittement/résolution réservés aux équipes internes).
    Route::get('alerts/stats',   [AlertController::class, 'stats']);
    Route::get('alerts',         [AlertController::class, 'index']);
    Route::get('alerts/{alert}', [AlertController::class, 'show']);
    Route::middleware('role:' . implode(',', array_merge($manage, [User::ROLE_TECHNICIAN])))->group(function () {
        Route::patch('alerts/{alert}/acknowledge', [AlertController::class, 'acknowledge']);
        Route::patch('alerts/{alert}/resolve',     [AlertController::class, 'resolve']);
        Route::patch('alerts/{alert}/reopen',      [AlertController::class, 'reopen']);
        Route::patch('alerts/{alert}/assign',      [AlertController::class, 'assign']);
        Route::patch('alerts/{alert}/diagnostic',  [AlertController::class, 'diagnostic']);
    });

    // ── Tableau de bord flotte ──────────────────────────────────────────────
    Route::prefix('fleet')->name('fleet.')->group(function () {
        Route::get('overview',     [FleetDashboardController::class, 'overview'])->name('overview');
        Route::get('events',       [FleetDashboardController::class, 'events'])->name('events');
        Route::get('heap-history', [FleetDashboardController::class, 'heapHistory'])->name('heap-history');
    });

    // ── Journal d'audit (lecture seule, jamais modifiable) ──────────────────
    Route::get('audit-logs', [AuditLogController::class, 'index'])
        ->middleware('role:' . implode(',', array_merge($manage, [User::ROLE_QUALITY])));

    // ── Comptes utilisateurs — cahier §4/§12 « Administration » ──────────────
    // Réservé à l'admin : c'est ici qu'on décide qui a accès à quoi, y
    // compris le rattachement customer_id qui pilote l'isolation client.
    Route::apiResource('users', UserController::class)
        ->middleware('role:' . User::ROLE_ADMIN);

    // ── Adaptateurs lecture seule vers la base du collecteur Express ────────
    // Interrogent la base legacy par clé brute (hors ORM) : pas d'isolation
    // client possible ici. Réservés aux équipes internes — jamais au rôle
    // « client », qui passe par /api/fleet/* et /api/devices/* (isolés).
    Route::middleware('role:' . implode(',', $staff))->group(function () {
        Route::prefix('heap-logs')->name('heap-logs.')->group(function () {
            Route::get('/',        [HeapLogController::class, 'index'])->name('index');
            Route::get('/devices', [HeapLogController::class, 'devices'])->name('devices');
            Route::get('/stats',   [HeapLogController::class, 'stats'])->name('stats');
            Route::get('/{id}',    [HeapLogController::class, 'show'])->name('show')->whereNumber('id');
        });

        Route::prefix('module-installs')->name('module-installs.')->group(function () {
            Route::get('/',        [ModuleInstallController::class, 'index'])->name('index');
            Route::get('/summary', [ModuleInstallController::class, 'summary'])->name('summary');
            Route::get('/{id}',    [ModuleInstallController::class, 'show'])->name('show')->whereNumber('id');
        });

        Route::get('logs',          [LegacyDashboardController::class, 'logs']);
        Route::get('chart',         [LegacyDashboardController::class, 'chart']);
        Route::get('stats',         [LegacyDashboardController::class, 'stats']);
        Route::get('installations', [LegacyDashboardController::class, 'installations']);
    });
});
