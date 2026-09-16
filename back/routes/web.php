<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\HealthController;

Route::get('/', function () {
    return view('welcome');
});

// Health check — accessible at http://localhost:8000/health
Route::get('/health', HealthController::class);
