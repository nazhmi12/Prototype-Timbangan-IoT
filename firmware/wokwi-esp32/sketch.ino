#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "HX711.h"

// Pin configuration
#define PIN_HX711_DT    4
#define PIN_HX711_SCK   5
#define PIN_BTN_TARE    18

// Network & MQTT Settings
const char* WIFI_SSID     = "";
const char* WIFI_PASS     = "";
const char* MQTT_BROKER   = "";
const int   MQTT_PORT     = 1883;
const char* MQTT_TOPIC    = "";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

HX711 scale;
LiquidCrystal_I2C lcd(0x27, 16, 2);

float calibrationFactor = 420.0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastMqttPublish = 0;
const unsigned long DISPLAY_INTERVAL = 300; // ms
const unsigned long PUBLISH_INTERVAL = 1000; // ms

void showWeight(float weight) {
  lcd.setCursor(0, 0);
  lcd.print("TIMBANG RPHU    ");
  lcd.setCursor(0, 1);
  lcd.print("Berat: ");
  lcd.print(weight, 2);
  lcd.print(" kg   ");
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected.");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker...");
    String clientId = "esp32-scale-" + String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println(" connected.");
    } else {
      Serial.print(" failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(". Retrying in 2 seconds...");
      delay(2000);
    }
  }
}

void tareScale() {
  Serial.println("Tare in progress...");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("TARE...");
  lcd.setCursor(0, 1);
  lcd.print("Kosongkan scale");

  delay(1000);
  scale.tare(10);

  lcd.clear();
  showWeight(0.0);
  Serial.println("Tare done.");
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_BTN_TARE, INPUT_PULLUP);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SISTEM TIMBANG");
  lcd.setCursor(0, 1);
  lcd.print("Inisialisasi...");
  delay(1000);

  scale.begin(PIN_HX711_DT, PIN_HX711_SCK);
  scale.set_scale(calibrationFactor);
  tareScale();

  connectWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);

  Serial.println("System ready.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Handle tare button
  if (digitalRead(PIN_BTN_TARE) == LOW) {
    tareScale();
    delay(400); // debounce
  }

  // Update LCD display
  if (millis() - lastDisplayUpdate >= DISPLAY_INTERVAL) {
    lastDisplayUpdate = millis();

    if (scale.is_ready()) {
      float weight = scale.get_units(10);
      if (weight < 0.05) weight = 0.0;
      showWeight(weight);
    }
  }

  // Publish telemetry to MQTT
  if (millis() - lastMqttPublish >= PUBLISH_INTERVAL) {
    lastMqttPublish = millis();

    if (scale.is_ready()) {
      float weight = scale.get_units(10);
      if (weight < 0.05) weight = 0.0;

      String payload = String(weight, 2);
      mqttClient.publish(MQTT_TOPIC, payload.c_str());

      Serial.print("Weight: ");
      Serial.print(payload);
      Serial.println(" kg");
    }
  }
}
