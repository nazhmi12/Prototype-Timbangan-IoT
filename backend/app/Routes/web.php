<?php
/**
 * Web Routes Configuration
 */

declare(strict_types=1);

return [
    ['method' => 'GET', 'path' => '/', 'handler' => [App\Controllers\DashboardController::class, 'getOverview']]
];
