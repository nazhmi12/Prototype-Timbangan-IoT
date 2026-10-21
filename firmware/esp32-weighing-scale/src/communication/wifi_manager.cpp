#include "wifi_manager.h"
#include "../../include/config.h"
#include "../utils/logger.h"

ScaleWiFiManager::ScaleWiFiManager()
    : isConnected(false), lastReconnectAttempt(0) {}

void ScaleWiFiManager::begin() {
    Logger::info("WIFI", "Menghubungkan ke Access Point RPHU: %s...", WIFI_SSID_DEFAULT);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID_DEFAULT, WIFI_PASS_DEFAULT);

    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 8000) {
        delay(250);
        Serial.print(".");
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        isConnected = true;
        digitalWrite(PIN_LED_NETWORK, HIGH);
        Logger::info("WIFI", "Tersambung! IP Address: %s (RSSI: %d dBm)", 
                     WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        isConnected = false;
        digitalWrite(PIN_LED_NETWORK, LOW);
        Logger::warn("WIFI", "Gagal tersambung dalam batas waktu. Mode offline aktif.");
    }
}

void ScaleWiFiManager::loop() {
    if (WiFi.status() == WL_CONNECTED) {
        if (!isConnected) {
            isConnected = true;
            digitalWrite(PIN_LED_NETWORK, HIGH);
            Logger::info("WIFI", "Koneksi pulih kembali: %s", WiFi.localIP().toString().c_str());
        }
    } else {
        if (isConnected) {
            isConnected = false;
            digitalWrite(PIN_LED_NETWORK, LOW);
            Logger::warn("WIFI", "Koneksi Wi-Fi terputus!");
        }
        unsigned long now = millis();
        if (now - lastReconnectAttempt > 10000) {
            lastReconnectAttempt = now;
            Logger::info("WIFI", "Mencoba reconnect Wi-Fi...");
            WiFi.reconnect();
        }
    }
}

bool ScaleWiFiManager::connected() {
    return (WiFi.status() == WL_CONNECTED);
}

String ScaleWiFiManager::getIPAddress() {
    return WiFi.localIP().toString();
}

int ScaleWiFiManager::getRSSI() {
    return WiFi.RSSI();
}
