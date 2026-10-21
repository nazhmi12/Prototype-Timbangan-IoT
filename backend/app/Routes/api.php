<?php
/**
 * REST API Routes Configuration - Full CRUD
 */

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\LotController;
use App\Controllers\WeighingController;
use App\Controllers\LivestockController;
use App\Controllers\ReportController;
use App\Controllers\DeviceController;

return [
    // Authentication
    ['method' => 'POST',   'path' => '/api/v1/auth/login', 'handler' => [AuthController::class, 'login']],

    // Dashboard Overview
    ['method' => 'GET',    'path' => '/api/v1/dashboard/overview', 'handler' => [DashboardController::class, 'getOverview']],

    // Lots (Full CRUD)
    ['method' => 'GET',    'path' => '/api/v1/lots', 'handler' => [LotController::class, 'index']],
    ['method' => 'GET',    'path' => '/api/v1/lots/{id}', 'handler' => [LotController::class, 'show']],
    ['method' => 'POST',   'path' => '/api/v1/lots', 'handler' => [LotController::class, 'store']],
    ['method' => 'PUT',    'path' => '/api/v1/lots/{id}', 'handler' => [LotController::class, 'update']],
    ['method' => 'PUT',    'path' => '/api/v1/lots/{id}/prices', 'handler' => [LotController::class, 'updatePrices']],
    ['method' => 'DELETE', 'path' => '/api/v1/lots/{id}', 'handler' => [LotController::class, 'delete']],

    // Weighings (Create, Read, Revise/Update, Delete)
    ['method' => 'POST',   'path' => '/api/v1/weighings', 'handler' => [WeighingController::class, 'store']],
    ['method' => 'GET',    'path' => '/api/v1/weighings/today', 'handler' => [WeighingController::class, 'getTodayLog']],
    ['method' => 'PUT',    'path' => '/api/v1/weighings/{id}', 'handler' => [WeighingController::class, 'update']],
    ['method' => 'DELETE', 'path' => '/api/v1/weighings/{id}', 'handler' => [WeighingController::class, 'delete']],

    // Livestock / Farmers (Full CRUD)
    ['method' => 'GET',    'path' => '/api/v1/farmers', 'handler' => [LivestockController::class, 'index']],
    ['method' => 'POST',   'path' => '/api/v1/farmers', 'handler' => [LivestockController::class, 'store']],
    ['method' => 'PUT',    'path' => '/api/v1/farmers/{id}', 'handler' => [LivestockController::class, 'update']],
    ['method' => 'DELETE', 'path' => '/api/v1/farmers/{id}', 'handler' => [LivestockController::class, 'delete']],

    // Reports
    ['method' => 'GET',    'path' => '/api/v1/reports/daily', 'handler' => [ReportController::class, 'daily']],

    // IoT Scale Devices
    ['method' => 'GET',    'path' => '/api/v1/devices', 'handler' => [DeviceController::class, 'index']],
    ['method' => 'GET',    'path' => '/api/v1/devices/{id}/telemetry', 'handler' => [DeviceController::class, 'getTelemetry']],
    ['method' => 'POST',   'path' => '/api/v1/devices/{id}/telemetry', 'handler' => [DeviceController::class, 'updateTelemetry']],
    ['method' => 'POST',   'path' => '/api/v1/devices/{id}/command', 'handler' => [DeviceController::class, 'sendCommand']],
];
