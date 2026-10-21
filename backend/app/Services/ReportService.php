<?php
/**
 * Daily, Monthly, and Farmer Performance Report Aggregation Service
 */

declare(strict_types=1);

namespace App\Services;

use App\Models\Lot;

class ReportService
{
    /**
     * Dapatkan ringkasan statistik harian RPHU
     */
    public static function getDailySummary(string $date): array
    {
        $lots = Lot::getByDate($date);

        $totalBirds = 0;
        $totalSendWeight = 0.0;
        $totalAliveReceived = 0.0;
        $totalWetCarcass = 0.0;
        $totalColdCarcass = 0.0;
        $totalLossRupiah = 0.0;
        $totalGrossProfit = 0.0;

        foreach ($lots as $lot) {
            $totalBirds += (int)($lot['total_birds'] ?? 0);
            $totalSendWeight += (float)($lot['send_weight'] ?? 0);
            $totalAliveReceived += (float)($lot['received_alive_weight'] ?? 0);
            $totalWetCarcass += (float)($lot['wet_carcass_weight'] ?? 0);
            $totalColdCarcass += (float)($lot['cold_carcass_weight'] ?? 0);

            $fin = $lot['financial'] ?? [];
            $totalLossRupiah += (float)($fin['loss_total_shrink'] ?? 0);
            $totalGrossProfit += (float)($fin['gross_profit'] ?? 0);
        }

        $avgTransitShrinkage = ($totalSendWeight > 0 && $totalAliveReceived > 0)
            ? round((($totalSendWeight - $totalAliveReceived) / $totalSendWeight) * 100, 2)
            : 0.0;

        $avgYield = ($totalAliveReceived > 0 && $totalColdCarcass > 0)
            ? round(($totalColdCarcass / $totalAliveReceived) * 100, 2)
            : 0.0;

        return [
            'date'                  => $date,
            'lot_count'             => count($lots),
            'total_birds'           => $totalBirds,
            'total_send_weight_kg'  => $totalSendWeight,
            'total_received_kg'     => $totalAliveReceived,
            'total_wet_carcass_kg'  => $totalWetCarcass,
            'total_cold_carcass_kg' => $totalColdCarcass,
            'avg_transit_shrink_pct'=> $avgTransitShrinkage,
            'avg_yield_pct'         => $avgYield,
            'total_shrink_loss_rp'  => $totalLossRupiah,
            'total_gross_profit_rp' => $totalGrossProfit,
            'lots'                  => $lots
        ];
    }
}
