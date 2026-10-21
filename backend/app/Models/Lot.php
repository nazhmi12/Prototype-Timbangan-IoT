<?php
/**
 * Lot Model
 */

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use App\Services\WeightCalculationService;
use PDO;

class Lot
{
    private static array $mockLots = [
        [
            'id' => 'L-0610-01',
            'farmer_name' => 'Pak Sumarno (Karawang)',
            'total_birds' => 2400,
            'send_weight' => 4920.0,
            'received_alive_weight' => 4841.0,
            'wet_carcass_weight' => 3402.0,
            'cold_carcass_weight' => 3438.0,
            'price_live_bird' => 21500.0,
            'price_carcass' => 36000.0,
            'payment_basis' => 'kirim',
            'status' => 'completed',
            'arrival_date' => '2026-10-12'
        ],
        [
            'id' => 'L-0610-02',
            'farmer_name' => 'UD Maju Unggas (Subang)',
            'total_birds' => 3100,
            'send_weight' => 6355.0,
            'received_alive_weight' => 6140.0,
            'wet_carcass_weight' => null,
            'cold_carcass_weight' => null,
            'price_live_bird' => 21000.0,
            'price_carcass' => 36000.0,
            'payment_basis' => 'kirim',
            'status' => 'processing',
            'arrival_date' => '2026-10-12'
        ],
        [
            'id' => 'L-0610-03',
            'farmer_name' => 'Bu Tini (Bekasi)',
            'total_birds' => 1800,
            'send_weight' => 3690.0,
            'received_alive_weight' => null,
            'wet_carcass_weight' => null,
            'cold_carcass_weight' => null,
            'price_live_bird' => 21500.0,
            'price_carcass' => 36000.0,
            'payment_basis' => 'kirim',
            'status' => 'waiting',
            'arrival_date' => '2026-10-12'
        ],
        [
            'id' => 'L-0610-04',
            'farmer_name' => 'CV Sinar Kandang (Purwakarta)',
            'total_birds' => 2750,
            'send_weight' => 5640.0,
            'received_alive_weight' => 5562.0,
            'wet_carcass_weight' => 3911.0,
            'cold_carcass_weight' => null,
            'price_live_bird' => 21000.0,
            'price_carcass' => 36000.0,
            'payment_basis' => 'kirim',
            'status' => 'processing',
            'arrival_date' => '2026-10-12'
        ]
    ];

    public static function all(): array
    {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT l.*, f.name as farmer_name 
                                 FROM lots l 
                                 LEFT JOIN livestock_farmers f ON l.farmer_id = f.id 
                                 ORDER BY l.id ASC");
            $rows = $stmt->fetchAll();
            if (!empty($rows)) {
                return array_map([self::class, 'enrichLot'], $rows);
            }
        } catch (\Throwable) {
            // DB fallback
        }

        return array_map([self::class, 'enrichLot'], self::$mockLots);
    }

    public static function findById(string $id): ?array
    {
        $all = self::all();
        foreach ($all as $item) {
            if ($item['id'] === $id) {
                return $item;
            }
        }
        return null;
    }

    public static function getByDate(string $date): array
    {
        $all = self::all();
        return array_filter($all, fn($l) => ($l['arrival_date'] ?? '') === $date);
    }

    public static function updateStageWeight(string $lotId, string $stage, float $weight): bool
    {
        $col = match ($stage) {
            'hidup'  => 'received_alive_weight',
            'basah'  => 'wet_carcass_weight',
            'dingin' => 'cold_carcass_weight',
            default  => null
        };
        if (!$col) return false;

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE lots SET {$col} = :w, updated_at = NOW() WHERE id = :id");
            return $stmt->execute(['w' => $weight, 'id' => $lotId]);
        } catch (\Throwable) {
            // Update in-memory mock if db fails
            foreach (self::$mockLots as &$l) {
                if ($l['id'] === $lotId) {
                    $l[$col] = $weight;
                    return true;
                }
            }
        }
        return false;
    }

    public static function updatePrices(string $lotId, float $modal, float $jual, string $basis): bool
    {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE lots SET price_live_bird = :m, price_carcass = :j, payment_basis = :b WHERE id = :id");
            return $stmt->execute(['m' => $modal, 'j' => $jual, 'b' => $basis, 'id' => $lotId]);
        } catch (\Throwable) {
            foreach (self::$mockLots as &$l) {
                if ($l['id'] === $lotId) {
                    $l['price_live_bird'] = $modal;
                    $l['price_carcass'] = $jual;
                    $l['payment_basis'] = $basis;
                    return true;
                }
            }
        }
        return false;
    }

    private static function enrichLot(array $lot): array
    {
        $send  = isset($lot['send_weight']) ? (float)$lot['send_weight'] : null;
        $alive = isset($lot['received_alive_weight']) ? (float)$lot['received_alive_weight'] : null;
        $wet   = isset($lot['wet_carcass_weight']) ? (float)$lot['wet_carcass_weight'] : null;
        $cold  = isset($lot['cold_carcass_weight']) ? (float)$lot['cold_carcass_weight'] : null;

        $lot['transit_shrinkage_pct'] = WeightCalculationService::calculateTransitShrinkage($send, $alive);
        $lot['chilling_shrinkage_pct'] = WeightCalculationService::calculateChillingShrinkage($wet, $cold);
        $lot['total_shrinkage_pct']    = WeightCalculationService::calculateTotalShrinkage($send, $cold);
        $lot['carcass_yield_pct']      = WeightCalculationService::calculateCarcassYield($alive, $cold);
        $lot['financial']              = WeightCalculationService::calculateFinancialMetrics($lot);

        return $lot;
    }
}
