#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "../scale/loadcell.h"

typedef std::function<void(const String& action, JsonObject& payload)> CommandCallback;

class ScaleMqttClient {
private:
    WiFiClient espClient;
    PubSubClient client;
    unsigned long lastReconnectAttempt;
    unsigned long lastTelemetryPublish;
    CommandCallback commandHandler;

    void handleCallback(char* topic, byte* payload, unsigned int length);

public:
    ScaleMqttClient();
    void begin();
    void loop();
    bool isConnected();
    void publishWeight(const ScaleReading& reading, const char* lotId = "", const char* stage = "hidup");
    void publishStatus(const char* status);
    void setCommandHandler(CommandCallback handler);
};
