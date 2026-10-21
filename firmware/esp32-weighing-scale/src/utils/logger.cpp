#include "logger.h"
#include <stdarg.h>

void Logger::init(unsigned long baudRate) {
    Serial.begin(baudRate);
    delay(50);
    Serial.println("\n==================================================");
    Serial.println("  SISTEM TIMBANG RPHU - ESP32 FIRMWARE v1.4.0     ");
    Serial.println("==================================================");
}

void Logger::log(LogLevel level, const char* tag, const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);

    const char* levelStr = "INFO";
    switch (level) {
        case LOG_LEVEL_DEBUG: levelStr = "DEBUG"; break;
        case LOG_LEVEL_INFO:  levelStr = "INFO "; break;
        case LOG_LEVEL_WARN:  levelStr = "WARN "; break;
        case LOG_LEVEL_ERROR: levelStr = "ERROR"; break;
    }

    Serial.printf("[%08lu][%s][%s] %s\n", millis(), levelStr, tag, buffer);
}

void Logger::info(const char* tag, const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    log(LOG_LEVEL_INFO, tag, "%s", buffer);
}

void Logger::warn(const char* tag, const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    log(LOG_LEVEL_WARN, tag, "%s", buffer);
}

void Logger::error(const char* tag, const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    log(LOG_LEVEL_ERROR, tag, "%s", buffer);
}

void Logger::debug(const char* tag, const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    log(LOG_LEVEL_DEBUG, tag, "%s", buffer);
}
