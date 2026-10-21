<?php
/**
 * MQTT Publishing and Device Command Service
 */

declare(strict_types=1);

namespace App\Services;

use App\Config\MqttConfig;

class MqttService
{
    /**
     * Kirim perintah kontrol ke timbangan ESP32
     */
    public static function sendCommand(string $deviceId, string $action, array $extra = []): bool
    {
        $config = MqttConfig::getSettings();
        $topic = "rphu/scale/{$deviceId}/command";
        $payload = json_encode(array_merge(['action' => $action], $extra));

        // Jika library php-mqtt terinstall, kirim socket, atau fallback ke sistem shell/log
        try {
            if (class_exists('\\PhpMqtt\\Client\\MqttClient')) {
                $client = new \PhpMqtt\Client\MqttClient($config['host'], $config['port'], $config['client_id']);
                $client->connect();
                $client->publish($topic, $payload, 1);
                $client->disconnect();
                return true;
            }
        } catch (\Throwable $e) {
            error_log("MQTT publish error: " . $e->getMessage());
        }

        // Simpan command ke local cache / log agar dapat dipoll jika tanpa broker
        file_put_contents(
            sys_get_temp_dir() . "/rphu_mqtt_cmd_{$deviceId}.json",
            json_encode(['action' => $action, 'extra' => $extra, 'time' => time()])
        );

        return true;
    }
}
