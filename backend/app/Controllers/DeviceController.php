<?php
/**
 * DeviceController
 */

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Device;
use App\Services\MqttService;

class DeviceController
{
    public function index(): void
    {
        $devices = Device::all();
        jsonResponse(true, "Daftar stasiun timbangan IoT RPHU", $devices);
    }

    public function sendCommand(array $params): void
    {
        $deviceId = $params['id'] ?? '';
        $input = getJsonInput();
        $action = $input['action'] ?? '';

        if (!in_array($action, ['tare', 'zero', 'calibrate'], true)) {
            jsonResponse(false, "Aksi tidak dikenal ('tare', 'zero', 'calibrate')", null, 400);
        }

        $sent = MqttService::sendCommand($deviceId, $action, $input);
        jsonResponse(true, "Perintah '{$action}' berhasil dikirimkan ke perangkat {$deviceId}", [
            'device_id' => $deviceId,
            'action'    => $action,
            'sent_at'   => date('Y-m-d H:i:s')
        ]);
    }

    public function getTelemetry(array $params): void
    {
        $deviceId = $params['id'] ?? 'SCALE-ESP32-01';
        $cacheFile = sys_get_temp_dir() . "/rphu_device_{$deviceId}_telemetry.json";

        if (file_exists($cacheFile)) {
            $content = file_get_contents($cacheFile);
            $data = json_decode($content, true);
            if (is_array($data)) {
                jsonResponse(true, "Telemetri perangkat {$deviceId}", $data);
                return;
            }
        }

        // Default telemetry fallback
        $default = [
            'device_id'     => $deviceId,
            'weight_kg'     => 0.0,
            'raw_adc'       => 8345100,
            'is_stable'     => true,
            'has_load'      => false,
            'is_tared'      => false,
            'tare_offset'   => 0.0,
            'status'        => 'online',
            'last_seen'     => date('c')
        ];

        jsonResponse(true, "Telemetri perangkat {$deviceId} (default)", $default);
    }

    public function updateTelemetry(array $params): void
    {
        $deviceId = $params['id'] ?? 'SCALE-ESP32-01';
        $input = getJsonInput();

        $cacheFile = sys_get_temp_dir() . "/rphu_device_{$deviceId}_telemetry.json";
        $current = [];
        if (file_exists($cacheFile)) {
            $current = json_decode(file_get_contents($cacheFile), true) ?: [];
        }

        $weight = isset($input['weight_kg']) ? (float)$input['weight_kg'] : (isset($input['weight']) ? (float)$input['weight'] : 0.0);
        $isStable = isset($input['is_stable']) ? (bool)$input['is_stable'] : true;
        $isTared = isset($input['is_tared']) ? (bool)$input['is_tared'] : false;

        $payload = array_merge($current, [
            'device_id'     => $deviceId,
            'weight_kg'     => round($weight, 2),
            'is_stable'     => $isStable,
            'has_load'      => $weight > 0.1,
            'is_tared'      => $isTared,
            'last_seen'     => date('c')
        ]);

        file_put_contents($cacheFile, json_encode($payload));
        jsonResponse(true, "Telemetri perangkat {$deviceId} diperbarui", $payload);
    }
}
