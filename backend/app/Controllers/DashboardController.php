<?php
/**
 * DashboardController
 */

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Lot;
use App\Models\Device;
use App\Models\Weighing;
use App\Services\ReportService;

class DashboardController
{
    public function getOverview(): void
    {
        $today = date('Y-m-d');
        $summary = ReportService::getDailySummary($today);
        $devices = Device::all();
        $recentWeighings = Weighing::getTodayLog();

        jsonResponse(true, "Data ringkasan dashboard operasional RPHU", [
            'summary'          => $summary,
            'devices'          => $devices,
            'recent_weighings' => array_slice($recentWeighings, 0, 10),
            'system_status'    => [
                'mqtt_broker'  => 'connected',
                'active_scale' => 'SCALE-ESP32-01',
                'server_time'  => date('Y-m-d H:i:s')
            ]
        ]);
    }
}
