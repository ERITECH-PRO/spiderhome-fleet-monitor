<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\AuthController;
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
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ServiceRequestController;
use App\Http\Controllers\Api\SiteController;

/*
|--------------------------------------------------------------------------
| Routes publiques
|--------------------------------------------------------------------------
| Limitées au strict nécessaire : authentification et sonde de santé.
| Toute route exposant des données client est authentifiée (Sanctum).
*/

Route::middleware('throttle:10,1')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
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
*/

Route::middleware('auth:sanctum')->group(function () {

    // ── Session ─────────────────────────────────────────────────────────────
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me',      [AuthController::class, 'me']);

    // ── Registre métier ─────────────────────────────────────────────────────
    // Alimenté automatiquement par « php artisan spiderhome:sync ».
    // Les écritures restent possibles pour corriger un rattachement ou un libellé.
    Route::get('devices/{id}/health', [DeviceController::class, 'health']);
    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('sites', SiteController::class);
    Route::apiResource('device-models', DeviceModelController::class);
    Route::apiResource('devices', DeviceController::class);
    Route::apiResource('device-events', DeviceEventController::class)->only(['index', 'show']);

    // ── SAV / demandes d'intervention ───────────────────────────────────────
    Route::apiResource('service-requests', ServiceRequestController::class);
    Route::patch('service-requests/{serviceRequest}/status',  [ServiceRequestController::class, 'updateStatus']);
    Route::get('service-requests/{serviceRequest}/histories', [ServiceRequestController::class, 'histories']);

    // ── Alertes ─────────────────────────────────────────────────────────────
    Route::get('alerts/stats',                 [AlertController::class, 'stats']);
    Route::get('alerts',                       [AlertController::class, 'index']);
    Route::get('alerts/{alert}',               [AlertController::class, 'show']);
    Route::patch('alerts/{alert}/acknowledge', [AlertController::class, 'acknowledge']);
    Route::patch('alerts/{alert}/resolve',     [AlertController::class, 'resolve']);
    Route::patch('alerts/{alert}/reopen',      [AlertController::class, 'reopen']);

    // ── Tableau de bord flotte ──────────────────────────────────────────────
    Route::prefix('fleet')->name('fleet.')->group(function () {
        Route::get('overview',     [FleetDashboardController::class, 'overview'])->name('overview');
        Route::get('events',       [FleetDashboardController::class, 'events'])->name('events');
        Route::get('heap-history', [FleetDashboardController::class, 'heapHistory'])->name('heap-history');
    });

    // ── Adaptateurs lecture seule vers la base du collecteur Express ────────
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

    // ── Compatibilité avec le dashboard legacy ──────────────────────────────
    Route::get('logs',          [LegacyDashboardController::class, 'logs']);
    Route::get('chart',         [LegacyDashboardController::class, 'chart']);
    Route::get('stats',         [LegacyDashboardController::class, 'stats']);
    Route::get('installations', [LegacyDashboardController::class, 'installations']);
});
