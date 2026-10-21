<?php
/**
 * MQTT Broker Connection Configuration
 */

declare(strict_types=1);

namespace App\Config;

class MqttConfig
{
    public static function getSettings(): array
    {
        return [
            'host'          => getenv('MQTT_HOST') ?: '127.0.0.1',
            'port'          => (int)(getenv('MQTT_PORT') ?: 1883),
            'client_id'     => getenv('MQTT_CLIENT_ID') ?: 'rphu_backend_api_' . uniqid(),
            'username'      => getenv('MQTT_USER') ?: 'rphu_mqtt_user',
            'password'      => getenv('MQTT_PASSWORD') ?: 'rphu_mqtt_pass123',
            'clean_session' => true,
            'topic_prefix'  => getenv('MQTT_TOPIC_PREFIX') ?: 'rphu/scale'
        ];
    }
}
