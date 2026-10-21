#include "weighing_service.h"
#include "../../include/config.h"
#include "../utils/logger.h"

WeighingService::WeighingService(LoadCellDriver& lc, ScaleMqttClient& mq, ScaleWiFiManager& wf)
    : loadcell(lc),
      mqtt(mq),
      wifi(wf),
      lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS),
      state(SCALE_STATE_IDLE),
      lastTelemetryTime(0),
      lastLcdUpdateTime(0),
      buzzerTriggered(false),
      currentLotId("L-0610-01"),
      currentStage("hidup") {}

void WeighingService::begin() {
    pinMode(PIN_BTN_TARE, INPUT_PULLUP);
    pinMode(PIN_BTN_ZERO, INPUT_PULLUP);
    pinMode(PIN_BTN_SAVE, INPUT_PULLUP);

    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);

    pinMode(PIN_LED_STABLE, OUTPUT);
    digitalWrite(PIN_LED_STABLE, LOW);

    pinMode(PIN_LED_NETWORK, OUTPUT);
    digitalWrite(PIN_LED_NETWORK, LOW);

    // Inisialisasi LCD
    Wire.begin(I2C_SDA, I2C_SCL);
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("RPHU SISTEM TIMBANG");
    lcd.setCursor(0, 1);
    lcd.print("Stasiun: Timbang 1");
    lcd.setCursor(0, 2);
    lcd.print("Init sensor & WiFi..");
    delay(1000);
    lcd.clear();

    soundBeep(120);
    Logger::info("SERVICE", "WeighingService aktif.");
}

void WeighingService::soundBeep(int durationMs) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(durationMs);
    digitalWrite(PIN_BUZZER, LOW);
}

void WeighingService::setLotContext(const String& lotId, const String& stage) {
    currentLotId = lotId;
    currentStage = stage;
    Logger::info("SERVICE", "Lot aktif disetel ke %s [%s]", currentLotId.c_str(), currentStage.c_str());
}

void WeighingService::updateButtons() {
    // Tombol TARE ditekan
    if (digitalRead(PIN_BTN_TARE) == LOW) {
        delay(30); // Debounce
        if (digitalRead(PIN_BTN_TARE) == LOW) {
            loadcell.tare();
            soundBeep(150);
            while (digitalRead(PIN_BTN_TARE) == LOW) delay(10);
        }
    }

    // Tombol ZERO ditekan
    if (digitalRead(PIN_BTN_ZERO) == LOW) {
        delay(30);
        if (digitalRead(PIN_BTN_ZERO) == LOW) {
            loadcell.zero();
            soundBeep(200);
            while (digitalRead(PIN_BTN_ZERO) == LOW) delay(10);
        }
    }

    // Tombol SIMPAN MANUAL ditekan
    if (digitalRead(PIN_BTN_SAVE) == LOW) {
        delay(30);
        if (digitalRead(PIN_BTN_SAVE) == LOW) {
            if (currentReading.isStable && currentReading.hasLoad) {
                Logger::info("SERVICE", "Tombol SIMPAN manual ditekan! Mengirim hasil akhir...");
                mqtt.publishWeight(currentReading, currentLotId.c_str(), currentStage.c_str());
                soundBeep(300);
            }
            while (digitalRead(PIN_BTN_SAVE) == LOW) delay(10);
        }
    }
}

void WeighingService::update() {
    currentReading = loadcell.update();
    updateButtons();

    // State Machine
    if (!currentReading.hasLoad) {
        state = SCALE_STATE_IDLE;
        digitalWrite(PIN_LED_STABLE, LOW);
        buzzerTriggered = false;
    } else {
        if (currentReading.isStable) {
            state = SCALE_STATE_STABILIZED;
            digitalWrite(PIN_LED_STABLE, HIGH);
            if (!buzzerTriggered) {
                soundBeep(80); // Bunyi feedback saat stabil
                buzzerTriggered = true;
            }
        } else {
            state = SCALE_STATE_MEASURING;
            digitalWrite(PIN_LED_STABLE, LOW);
            buzzerTriggered = false;
        }
    }

    // Publikasi Telemetri berkala ke MQTT
    unsigned long now = millis();
    if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = now;
        mqtt.publishWeight(currentReading, currentLotId.c_str(), currentStage.c_str());
    }

    // Perbarui Tampilan LCD lokal (tiap 200ms agar halus)
    if (now - lastLcdUpdateTime >= 200) {
        lastLcdUpdateTime = now;
        updateLcd();
    }
}

void WeighingService::updateLcd() {
    char line0[21], line1[21], line2[21], line3[21];

    snprintf(line0, sizeof(line0), "RPHU: %-14s", currentLotId.c_str());
    snprintf(line1, sizeof(line1), "BERAT: %7.1f kg", currentReading.weightKg);

    const char* statusStr = (state == SCALE_STATE_STABILIZED) ? "[STABIL]" : 
                            (state == SCALE_STATE_MEASURING)  ? "[GERAK ]" : "[KOSONG]";
    snprintf(line2, sizeof(line2), "STAT : %-8s %s", statusStr, currentStage.c_str());

    const char* netStr = wifi.connected() ? "WIFI:OK" : "WIFI:DISC";
    const char* mqStr  = mqtt.isConnected() ? "MQ:OK" : "MQ:DISC";
    snprintf(line3, sizeof(line3), "%-9s %9s", netStr, mqStr);

    lcd.setCursor(0, 0); lcd.print(line0);
    lcd.setCursor(0, 1); lcd.print(line1);
    lcd.setCursor(0, 2); lcd.print(line2);
    lcd.setCursor(0, 3); lcd.print(line3);
}

ScaleState WeighingService::getState() const {
    return state;
}

ScaleReading WeighingService::getCurrentReading() const {
    return currentReading;
}
