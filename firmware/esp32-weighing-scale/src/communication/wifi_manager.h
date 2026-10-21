#pragma once

#include <Arduino.h>
#include <WiFi.h>

class ScaleWiFiManager {
private:
    bool isConnected;
    unsigned long lastReconnectAttempt;

public:
    ScaleWiFiManager();
    void begin();
    void loop();
    bool connected();
    String getIPAddress();
    int getRSSI();
};
