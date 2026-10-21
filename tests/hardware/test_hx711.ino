/*
 * Bench Test Sketch for HX711 and Load Cell Calibration
 * Digunakan untuk menguji kepekaan sensor dan mencari faktor kalibrasi
 */
#include "HX711.h"

const int LOADCELL_DOUT_PIN = 18;
const int LOADCELL_SCK_PIN = 19;

HX711 scale;
float calibration_factor = -21450.0;

void setup() {
  Serial.begin(115200);
  Serial.println("HX711 Calibration Bench Test");

  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale();
  scale.tare(); // Reset ke 0

  long zero_factor = scale.read_average(10);
  Serial.print("Zero factor (tare): ");
  Serial.println(zero_factor);
}

void loop() {
  scale.set_scale(calibration_factor);

  Serial.print("Reading: ");
  Serial.print(scale.get_units(5), 2);
  Serial.print(" kg");
  Serial.print(" | Cal factor: ");
  Serial.println(calibration_factor);

  if (Serial.available()) {
    char temp = Serial.read();
    if (temp == '+' || temp == 'a') calibration_factor += 50;
    else if (temp == '-' || temp == 'z') calibration_factor -= 50;
  }
  delay(200);
}
