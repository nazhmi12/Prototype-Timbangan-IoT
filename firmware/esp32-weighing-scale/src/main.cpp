/**
 * =============================================================================
 * SISTEM TIMBANG OTOMASI & ANALISIS SUSUT AYAM RPHU
 * TUGAS AKHIR / SKRIPSI TEKNIK ELEKTRO & INFORMATIKA
 * =============================================================================
 * Target: ESP32-WROOM-32 (Dual Core 240MHz)
 * RTOS Architecture:
 *   - Core 1: High-Frequency Load Cell Acquisition & Digital Stability Filtering
 *   - Core 0: Wi-Fi Management, MQTT Telemetry Broker Client, & Cloud Sync
 * =============================================================================
 */

#include <Arduino.h>
#include "include/config.h"
#include "src/utils/logger.h"
#include "src/scale/loadcell.h"
#include "src/communication/wifi_manager.h"
#include "src/communication/mqtt_client.h"
#include "src/services/weighing_service.h"

// Instance driver hardware & layanan
LoadCellDriver scaleDriver;
ScaleWiFiManager wifiManager;
ScaleMqttClient mqttClient;
WeighingService weighingService(scaleDriver, mqttClient, wifiManager);

// Task Handle FreeRTOS
TaskHandle_t TaskNetworkHandle = NULL;

// RTOS Task Core 0: Penanganan Komunikasi Jaringan & MQTT
void TaskNetwork(void* pvParameters) {
    Logger::info("RTOS", "Task Jaringan berjalan di Core %d", xPortGetCoreID());

    wifiManager.begin();
    mqttClient.begin();

    // Hook callback perintah dari backend / UI via MQTT
    mqttClient.setCommandHandler([](const String& action, JsonObject& payload) {
        if (action == "tare") {
            scaleDriver.tare();
        } else if (action == "zero") {
            scaleDriver.zero();
        } else if (action == "calibrate") {
            float factor = payload["factor"] | DEFAULT_CAL_FACTOR;
            scaleDriver.setCalibration(factor);
        } else if (action == "set_lot") {
            String lot = payload["lot_id"] | "L-0610-01";
            String stage = payload["stage"] | "hidup";
            weighingService.setLotContext(lot, stage);
        }
    });

    for (;;) {
        wifiManager.loop();
        if (wifiManager.connected()) {
            mqttClient.loop();
        }
        vTaskDelay(pdMS_TO_TICKS(20)); // Delay kooperatif 20ms
    }
}

void setup() {
    Logger::init(115200);
    Logger::info("MAIN", "Booting ESP32 Timbangan RPHU... Core: %d", xPortGetCoreID());

    // 1. Inisialisasi Driver Sensor Load Cell HX711
    scaleDriver.begin(PIN_HX711_DT, PIN_HX711_SCK);

    // 2. Inisialisasi Layanan Timbang, LCD, Tombol, dan Indikator
    weighingService.begin();

    // 3. Buat RTOS Task Jaringan di Core 0 (Prioritas 1)
    xTaskCreatePinnedToCore(
        TaskNetwork,          // Fungsi Task
        "TaskNetwork",        // Nama Task
        8192,                 // Stack size (bytes)
        NULL,                 // Parameter
        1,                    // Prioritas (1 = Normal)
        &TaskNetworkHandle,   // Task Handle
        0                     // Core ID 0
    );

    Logger::info("MAIN", "Inisialisasi sistem selesai. Memulai pengukuran di Core 1.");
}

void loop() {
    // Loop utama berjalan di Core 1 (Khusus pemrosesan sinyal sensor timbang)
    weighingService.update();
    delay(10); // Loop rate ~100Hz untuk stabilitas
}
