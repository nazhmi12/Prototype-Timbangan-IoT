<?php
/**
 * Weight Calculation Engine Unit Test
 */

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;
use App\Services\WeightCalculationService;

class WeightCalculationTest extends TestCase
{
    public function testTransitShrinkageCalculation(): void
    {
        // 4920 kg kirim, 4841 kg terima => susut 79 kg => 79/4920 * 100 = 1.6056% => 1.61%
        $shrink = WeightCalculationService::calculateTransitShrinkage(4920.0, 4841.0);
        $this->assertEquals(1.61, $shrink);
    }

    public function testChillingShrinkageCalculation(): void
    {
        // 3402 kg basah, 3438 kg dingin => kenaikan berat (water absorption) -36 kg => -1.058% => -1.06%
        $shrink = WeightCalculationService::calculateChillingShrinkage(3402.0, 3438.0);
        $this->assertEquals(-1.06, $shrink);
    }

    public function testCarcassYieldCalculation(): void
    {
        // 3438 kg dingin / 4841 kg hidup => 71.018% => 71.02%
        $yield = WeightCalculationService::calculateCarcassYield(4841.0, 3438.0);
        $this->assertEquals(71.02, $yield);
    }

    public function testFinancialMetricsEvaluation(): void
    {
        $lot = [
            'send_weight' => 4920.0,
            'received_alive_weight' => 4841.0,
            'wet_carcass_weight' => 3402.0,
            'cold_carcass_weight' => 3438.0,
            'price_live_bird' => 21500.0,
            'price_carcass' => 36000.0,
            'payment_basis' => 'kirim'
        ];

        $fin = WeightCalculationService::calculateFinancialMetrics($lot);
        $this->assertEquals(105780000, $fin['cost_total']); // 4920 * 21500
        $this->assertEquals(123768000, $fin['revenue_total']); // 3438 * 36000
        $this->assertEquals(1698500, $fin['loss_transit']); // (4920 - 4841) * 21500 = 79 * 21500 = 1698500
        $this->assertEquals(17988000, $fin['gross_profit']); // 123768000 - 105780000
    }
}
