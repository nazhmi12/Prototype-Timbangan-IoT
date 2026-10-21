<?php
/**
 * Weighing Model (Append-Only Log)
 */

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class Weighing
{
    private static array $inMemoryLog = [];

    public static function create(array $data): int
    {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("INSERT INTO weighings 
                (lot_id, device_id, recorded_by_user_id, stage, measured_weight_kg, raw_adc_value, is_stable, is_correction, operator_notes, recorded_at)
                VALUES (:lot_id, :device_id, :user_id, :stage, :weight, :adc, :stable, :correction, :notes, NOW())");
            
            $stmt->execute([
                'lot_id'     => $data['lot_id'],
                'device_id'  => $data['device_id'],
                'user_id'    => $data['recorded_by_user_id'],
                'stage'      => $data['stage'],
                'weight'     => $data['measured_weight_kg'],
                'adc'        => $data['raw_adc_value'] ?? 0,
                'stable'     => $data['is_stable'] ? 1 : 0,
                'correction' => $data['is_correction'] ? 1 : 0,
                'notes'      => $data['operator_notes'] ?? null
            ]);
            return (int)$pdo->lastInsertId();
        } catch (\Throwable) {
            $id = count(self::$inMemoryLog) + 1;
            $data['id'] = $id;
            $data['recorded_at'] = date('Y-m-d H:i:s');
            self::$inMemoryLog[] = $data;
            return $id;
        }
    }

    public static function getTodayLog(): array
    {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT w.*, u.full_name as operator_name 
                                 FROM weighings w 
                                 LEFT JOIN users u ON w.recorded_by_user_id = u.id 
                                 WHERE DATE(w.recorded_at) = CURDATE() 
                                 ORDER BY w.id DESC");
            $rows = $stmt->fetchAll();
            if (!empty($rows)) return $rows;
        } catch (\Throwable) {}

        return array_reverse(self::$inMemoryLog);
    }
}
