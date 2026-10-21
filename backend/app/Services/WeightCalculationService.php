<?php
/**
 * Mathematical Calculation Engine for RPHU Shrinkage & Yield
 */

declare(strict_types=1);

namespace App\Services;

class WeightCalculationService
{
    /**
     * Hitung persentase susut transit
     * Susut Transit (%) = ((Berat Kirim - Berat Hidup Terima) / Berat Kirim) * 100%
     */
    public static function calculateTransitShrinkage(?float $sendWeight, ?float $receivedAliveWeight): ?float
    {
        if ($sendWeight === null || $receivedAliveWeight === null || $sendWeight <= 0) {
            return null;
        }
        $shrinkage = (($sendWeight - $receivedAliveWeight) / $sendWeight) * 100.0;
        return round($shrinkage, 2);
    }

    /**
     * Hitung persentase susut chilling (pendinginan)
     * Susut Chilling (%) = ((Karkas Basah - Karkas Dingin) / Karkas Basah) * 100%
     */
    public static function calculateChillingShrinkage(?float $wetCarcass, ?float $coldCarcass): ?float
    {
        if ($wetCarcass === null || $coldCarcass === null || $wetCarcass <= 0) {
            return null;
        }
        $shrinkage = (($wetCarcass - $coldCarcass) / $wetCarcass) * 100.0;
        return round($shrinkage, 2);
    }

    /**
     * Hitung persentase susut total
     * Susut Total (%) = ((Berat Kirim - Karkas Dingin) / Berat Kirim) * 100%
     */
    public static function calculateTotalShrinkage(?float $sendWeight, ?float $coldCarcass): ?float
    {
        if ($sendWeight === null || $coldCarcass === null || $sendWeight <= 0) {
            return null;
        }
        $shrinkage = (($sendWeight - $coldCarcass) / $sendWeight) * 100.0;
        return round($shrinkage, 2);
    }

    /**
     * Hitung yield karkas dingin terhadap bobot hidup diterima
     * Yield (%) = (Karkas Dingin / Bobot Hidup Terima) * 100%
     */
    public static function calculateCarcassYield(?float $receivedAliveWeight, ?float $coldCarcass): ?float
    {
        if ($receivedAliveWeight === null || $coldCarcass === null || $receivedAliveWeight <= 0) {
            return null;
        }
        $yield = ($coldCarcass / $receivedAliveWeight) * 100.0;
        return round($yield, 2);
    }

    /**
     * Hitung analisis finansial lot
     */
    public static function calculateFinancialMetrics(array $lot): array
    {
        $sendWeight   = isset($lot['send_weight']) ? (float)$lot['send_weight'] : null;
        $aliveWeight  = isset($lot['received_alive_weight']) ? (float)$lot['received_alive_weight'] : null;
        $wetCarcass   = isset($lot['wet_carcass_weight']) ? (float)$lot['wet_carcass_weight'] : null;
        $coldCarcass  = isset($lot['cold_carcass_weight']) ? (float)$lot['cold_carcass_weight'] : null;
        $priceLive    = isset($lot['price_live_bird']) ? (float)$lot['price_live_bird'] : 0.0;
        $priceCarcass = isset($lot['price_carcass']) ? (float)$lot['price_carcass'] : 0.0;
        $paymentBasis = $lot['payment_basis'] ?? 'kirim';

        // Dasar pembayaran ke peternak
        $paidWeight = ($paymentBasis === 'kirim') ? $sendWeight : $aliveWeight;
        $costTotal = ($paidWeight !== null) ? round($paidWeight * $priceLive) : null;

        // Hasil penjualan karkas dingin
        $revenueTotal = ($coldCarcass !== null) ? round($coldCarcass * $priceCarcass) : null;

        // Kerugian susut transit (hanya jika bayar basis kirim)
        $lossTransit = null;
        if ($aliveWeight !== null && $sendWeight !== null) {
            $lossTransit = ($paymentBasis === 'kirim') ? round(($sendWeight - $aliveWeight) * $priceLive) : 0;
        }

        // Kerugian susut chilling (jika basah > dingin)
        $lossChilling = null;
        if ($wetCarcass !== null && $coldCarcass !== null) {
            $diff = $wetCarcass - $coldCarcass;
            $lossChilling = ($diff > 0) ? round($diff * $priceCarcass) : 0;
        }

        // Total kerugian rupiah akibat susut
        $lossTotal = null;
        if ($lossTransit !== null || $lossChilling !== null) {
            $lossTotal = ($lossTransit ?? 0) + ($lossChilling ?? 0);
        }

        // Estimasi laba/rugi kotor
        $grossProfit = null;
        if ($revenueTotal !== null && $costTotal !== null) {
            $grossProfit = $revenueTotal - $costTotal;
        }

        return [
            'payment_basis'      => $paymentBasis,
            'paid_weight_kg'     => $paidWeight,
            'cost_total'         => $costTotal,
            'revenue_total'      => $revenueTotal,
            'loss_transit'       => $lossTransit,
            'loss_chilling'      => $lossChilling,
            'loss_total_shrink'  => $lossTotal,
            'gross_profit'       => $grossProfit
        ];
    }
}
