#include "loadcell.h"
#include "../utils/logger.h"

LoadCellDriver::LoadCellDriver()
    : calibrationFactor(DEFAULT_CAL_FACTOR),
      zeroOffset(DEFAULT_ZERO_OFFSET),
      bufferIndex(0),
      bufferCount(0),
      stableCounter(0),
      lastStableState(false) {
    for (int i = 0; i < FILTER_WINDOW_SIZE; ++i) {
        sampleBuffer[i] = 0.0f;
    }
}

void LoadCellDriver::begin(uint8_t doutPin, uint8_t sckPin) {
    scale.begin(doutPin, sckPin);
    Logger::info("LOADCELL", "Menginisialisasi HX711 pada DT=%d, SCK=%d...", doutPin, sckPin);

    // Tunggu HX711 siap
    unsigned long start = millis();
    while (!scale.is_ready() && (millis() - start < 2000)) {
        delay(50);
    }

    if (scale.is_ready()) {
        scale.set_scale(calibrationFactor);
        scale.tare(10); // Ambil 10 sampel untuk tare awal
        Logger::info("LOADCELL", "HX711 Siap. Tare awal selesai. Cal factor=%.2f", calibrationFactor);
    } else {
        Logger::error("LOADCELL", "Gagal mendeteksi HX711! Periksa kabel DT/SCK atau catu daya.");
    }
}

bool LoadCellDriver::isReady() {
    return scale.is_ready();
}

ScaleReading LoadCellDriver::update() {
    ScaleReading reading = {0.0f, 0L, false, false, 0.0f};

    if (!scale.is_ready()) {
        return reading;
    }

    // Ambil bacaan bobot terbaru (dalam kilogram)
    float rawUnits = scale.get_units(1);
    reading.rawAdc = scale.read();

    // Masukkan ke dalam circular moving average buffer
    sampleBuffer[bufferIndex] = rawUnits;
    bufferIndex = (bufferIndex + 1) % FILTER_WINDOW_SIZE;
    if (bufferCount < FILTER_WINDOW_SIZE) {
        bufferCount++;
    }

    // Hitung rata-rata dan rentang delta min-max
    float sum = 0.0f;
    float minVal = sampleBuffer[0];
    float maxVal = sampleBuffer[0];

    for (int i = 0; i < bufferCount; ++i) {
        float val = sampleBuffer[i];
        sum += val;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
    }

    reading.weightKg = (bufferCount > 0) ? (sum / bufferCount) : rawUnits;
    reading.delta = maxVal - minVal;
    reading.hasLoad = (reading.weightKg >= MIN_WEIGHT_TRIGGER);

    // Kriteria deteksi kestabilan (meredam kepakan ayam)
    if (reading.hasLoad && (reading.delta <= STABILITY_THRESHOLD)) {
        if (stableCounter < STABILITY_HOLD_COUNT) {
            stableCounter++;
        }
    } else {
        stableCounter = 0;
    }

    reading.isStable = (stableCounter >= STABILITY_HOLD_COUNT);
    lastStableState = reading.isStable;

    return reading;
}

void LoadCellDriver::tare() {
    Logger::info("LOADCELL", "Melakukan TARE wadah...");
    scale.tare(10);
    bufferIndex = 0;
    bufferCount = 0;
    stableCounter = 0;
}

void LoadCellDriver::zero() {
    Logger::info("LOADCELL", "Me-reset titik nol platform...");
    scale.tare(15);
}

void LoadCellDriver::setCalibration(float factor) {
    calibrationFactor = factor;
    scale.set_scale(calibrationFactor);
    Logger::info("LOADCELL", "Kalibrasi diperbarui: %.2f", calibrationFactor);
}

float LoadCellDriver::getCalibration() const {
    return calibrationFactor;
}
