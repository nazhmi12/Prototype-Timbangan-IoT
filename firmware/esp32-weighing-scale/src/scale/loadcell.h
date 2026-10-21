#pragma once

#include <Arduino.h>
#include "HX711.h"
#include "../../include/config.h"

struct ScaleReading {
    float weightKg;
    long rawAdc;
    bool isStable;
    bool hasLoad;
    float delta;
};

class LoadCellDriver {
private:
    HX711 scale;
    float calibrationFactor;
    long zeroOffset;

    // Moving average & stability buffer
    float sampleBuffer[FILTER_WINDOW_SIZE];
    int bufferIndex;
    int bufferCount;
    int stableCounter;
    bool lastStableState;

public:
    LoadCellDriver();
    void begin(uint8_t doutPin = PIN_HX711_DT, uint8_t sckPin = PIN_HX711_SCK);
    ScaleReading update();
    void tare();
    void setCalibration(float factor);
    float getCalibration() const;
    void zero();
    bool isReady();
};
