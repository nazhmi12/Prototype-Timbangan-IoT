#include "mqtt_client.h"
#include "../../include/config.h"
#include "../utils/logger.h"

ScaleMqttClient::ScaleMqttClient()
    : client(espClient),
      lastReconnectAttempt(0),
      lastTelemetryPublish(0),
      commandHandler(nullptr) {}

void ScaleMqttClient::begin() {
    client.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    client.setBufferSize(512);

    client.setCallback([this](char* topic, byte* payload, unsigned int length) {
        this->handleCallback(topic, payload, length);
    });

    Logger::info("MQTT", "Broker disetel ke %s:%d", MQTT_BROKER_HOST, MQTT_BROKER_PORT);
}

void ScaleMqttClient::handleCallback(char* topic, byte* payload, unsigned int length) {
    char jsonStr[length + 1];
    memcpy(jsonStr, payload, length);
    jsonStr[length] = '\0';

    Logger::info("MQTT", "Pesan masuk di [%s]: %s", topic, jsonStr);

    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, jsonStr);
    if (!error) {
        String action = doc["action"] | "";
        JsonObject obj = doc.as<JsonObject>();
        if (commandHandler) {
            commandHandler(action, obj);
        }
    } else {
        Logger::warn("MQTT", "Gagal parse payload JSON!");
    }
}

void ScaleMqttClient::setCommandHandler(CommandCallback handler) {
    commandHandler = handler;
}

bool ScaleMqttClient::isConnected() {
    return client.connected();
}

void ScaleMqttClient::loop() {
    if (!client.connected()) {
        unsigned long now = millis();
        if (now - lastReconnectAttempt > 5000) {
            lastReconnectAttempt = now;
            Logger::info("MQTT", "Mencoba menyambungkan ke Mosquitto...");

            String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
            if (client.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
                Logger::info("MQTT", "Tersambung ke broker! Subscribing ke %s...", MQTT_TOPIC_COMMAND);
                client.subscribe(MQTT_TOPIC_COMMAND);
                publishStatus("online");
            } else {
                Logger::warn("MQTT", "Gagal konek broker! rc=%d", client.state());
            }
        }
    } else {
        client.loop();
    }
}

void ScaleMqttClient::publishWeight(const ScaleReading& reading, const char* lotId, const char* stage) {
    if (!client.connected()) return;

    StaticJsonDocument<384> doc;
    doc["device_id"]    = DEVICE_ID;
    doc["station"]      = STATION_NAME;
    doc["lot_id"]       = lotId;
    doc["stage"]        = stage;
    doc["weight_kg"]    = serialized(String(reading.weightKg, 2));
    doc["raw_adc"]      = reading.rawAdc;
    doc["is_stable"]    = reading.isStable;
    doc["has_load"]     = reading.hasLoad;
    doc["delta_kg"]     = serialized(String(reading.delta, 3));
    doc["millis"]       = millis();

    char buffer[384];
    size_t n = serializeJson(doc, buffer);
    client.publish(MQTT_TOPIC_WEIGHT, buffer, n);
}

void ScaleMqttClient::publishStatus(const char* status) {
    if (!client.connected()) return;

    StaticJsonDocument<256> doc;
    doc["device_id"] = DEVICE_ID;
    doc["status"]    = status;
    doc["firmware"]  = FIRMWARE_VERSION;
    doc["uptime_s"]  = millis() / 1000;

    char buffer[256];
    serializeJson(doc, buffer);
    client.publish(MQTT_TOPIC_STATUS, buffer);
}
