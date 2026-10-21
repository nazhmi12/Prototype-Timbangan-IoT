<?php
/**
 * ReportController
 */

declare(strict_types=1);

namespace App\Controllers;

use App\Services\ReportService;

class ReportController
{
    public function daily(): void
    {
        $date = $_GET['date'] ?? date('Y-m-d');
        $report = ReportService::getDailySummary($date);
        jsonResponse(true, "Laporan susut & yield harian RPHU ({$date})", $report);
    }
}
