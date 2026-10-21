#pragma once

#include <Arduino.h>
#include <LiquidCrystal_I2C.h>
#include "../scale/loadcell.h"
#include "../communication/mqtt_client.h"
#include "../communication/wifi_manager.h"

enum ScaleState {
    SCALE_STATE_IDLE,
    SCALE_STATE_MEASURING,
    SCALE_STATE_STABILIZED,
    SCALE_STATE_RECORDED
};

class WeighingService {
private:
    LoadCellDriver& loadcell;
    ScaleMqttClient& mqtt;
    ScaleWiFiManager& wifi;
    LiquidCrystal_I2C lcd;

    ScaleState state;
    ScaleReading currentReading;
    unsigned long lastTelemetryTime;
    unsigned long lastLcdUpdateTime;
    bool buzzerTriggered;

    String currentLotId;
    String currentStage;

    void updateButtons();
    void updateLcd();
    void soundBeep(int durationMs = 80);

public:
    WeighingService(LoadCellDriver& lc, ScaleMqttClient& mq, ScaleWiFiManager& wf);
    void begin();
    void update();
    void setLotContext(const String& lotId, const String& stage);
    ScaleState getState() const;
    ScaleReading getCurrentReading() const;
};
