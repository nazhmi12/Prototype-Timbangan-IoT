#pragma once

#include <Arduino.h>

// =============================================================================
// DEVICE IDENTIFICATION & STATION CONFIGURATION
// =============================================================================
#define DEVICE_ID             "SCALE-ESP32-01"
#define STATION_NAME          "Timbang Penerimaan & Susut 1"
#define FIRMWARE_VERSION      "v1.4.0-rphu"

// =============================================================================
// HARDWARE PIN DEFINITIONS (ESP32-WROOM-32)
// =============================================================================
// HX711 24-Bit ADC Pins
#define PIN_HX711_DT          18
#define PIN_HX711_SCK         19

// Push Buttons (Active LOW with internal pull-up)
#define PIN_BTN_TARE          13
#define PIN_BTN_ZERO          14
#define PIN_BTN_SAVE          15

// Audio-Visual Indicators
#define PIN_BUZZER            25
#define PIN_LED_STABLE        26   // Green LED
#define PIN_LED_NETWORK       27   // Blue LED

// I2C Display (PCF8574 LiquidCrystal_I2C)
#define I2C_SDA               21
#define I2C_SCL               22
#define LCD_I2C_ADDR          0x27
#define LCD_COLS              20
#define LCD_ROWS              4

// =============================================================================
// LOAD CELL & SIGNAL FILTERING PARAMETERS
// =============================================================================
// Kalibrasi awal (nilai ini didapat dari prosedur anak timbang M1)
#define DEFAULT_CAL_FACTOR    -21450.0f
#define DEFAULT_ZERO_OFFSET   8388608L

// Filter peredam getaran ayam aktif (Flapping movement rejector)
#define FILTER_WINDOW_SIZE    15      // Ukuran Moving Average buffer
#define STABILITY_THRESHOLD   0.15f   // Bobot dianggap stabil jika delta <= 0.15 kg
#define STABILITY_HOLD_COUNT  8       // Bertahan stabil sebanyak N siklus berturut-turut
#define MIN_WEIGHT_TRIGGER    0.50f   // Ambang batas deteksi adanya beban (kg)

// =============================================================================
// NETWORK & MQTT CONFIGURATION
// =============================================================================
#define WIFI_SSID_DEFAULT     "RPHU_INDUSTRIAL_AP"
#define WIFI_PASS_DEFAULT     "RphuConnect2026!"

#define MQTT_BROKER_HOST      "192.168.1.100"
#define MQTT_BROKER_PORT      1883
#define MQTT_USER             "rphu_mqtt_user"
#define MQTT_PASS             "rphu_mqtt_pass123"

#define MQTT_TOPIC_WEIGHT     "rphu/scale/SCALE-ESP32-01/weight"
#define MQTT_TOPIC_STATUS     "rphu/scale/SCALE-ESP32-01/status"
#define MQTT_TOPIC_COMMAND    "rphu/scale/SCALE-ESP32-01/command"

#define TELEMETRY_INTERVAL_MS 250     // Broadcast telemetri tiap 250ms
