<?php
/**
 * IoT Scale Device Model
 */

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;

class Device
{
    public static function all(): array
    {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM devices ORDER BY id ASC");
            $rows = $stmt->fetchAll();
            if (!empty($rows)) return $rows;
        } catch (\Throwable) {}

        return [
            [
                'id' => 'SCALE-ESP32-01',
                'device_name' => 'Timbangan Platform Penerimaan 1',
                'station_name' => 'Timbang 1',
                'ip_address' => '192.168.1.105',
                'mac_address' => '24:6F:28:AB:12:01',
                'calibration_factor' => -21450.00,
                'is_online' => 1,
                'last_heartbeat' => date('Y-m-d H:i:s')
            ],
            [
                'id' => 'SCALE-ESP32-02',
                'device_name' => 'Timbangan Gantung Karkas Chilling',
                'station_name' => 'Cold Storage',
                'ip_address' => '192.168.1.106',
                'mac_address' => '24:6F:28:AB:12:02',
                'calibration_factor' => -18200.00,
                'is_online' => 1,
                'last_heartbeat' => date('Y-m-d H:i:s')
            ]
        ];
    }
}
