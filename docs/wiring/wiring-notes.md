# 🔌 Catatan Teknis Perkabelan (Wiring Notes) & Kalibrasi

Dokumen ini menjelaskan tata letak pin, reduksi noise sinyal analog, dan prosedur kalibrasi beban pada modul timbangan berbasis ESP32 dan HX711.

---

## 1. Pemetaan Pin GPIO ESP32

| Modul | Pin Modul | Pin ESP32 | Keterangan |
|---|---|---|---|
| **HX711 ADC** | `VCC` | `3.3V` / `5V` | Daya sensor. Rekomendasi 5V ke Vin dengan logic level converter jika kabel panjang |
| | `GND` | `GND` | Ground bersama (Common Ground) |
| | `DT` (Data) | `GPIO 18` | Jalur data serial bit streaming |
| | `SCK` (Clock) | `GPIO 19` | Pulsa clock sinkronisasi |
| **LCD 2004 I2C** | `VCC` | `5V` (Vin) | Catu daya lampu latar LCD |
| | `GND` | `GND` | Ground |
| | `SDA` | `GPIO 21` | I2C Data |
| | `SCL` | `GPIO 22` | I2C Clock |
| **Tombol TARE** | Pin 1 | `GPIO 13` | Input pull-up internal (ditekan = LOW) |
| **Tombol ZERO** | Pin 1 | `GPIO 14` | Input pull-up internal |
| **Buzzer** | Anoda (+) | `GPIO 25` | Output PWM / Digital High bunyi stabil |
| **LED Stable** | Anoda (+) | `GPIO 26` | Melalui resistor 220Ω (Hijau) |
| **LED Wi-Fi/MQTT**| Anoda (+) | `GPIO 27` | Melalui resistor 220Ω (Biru) |

---

## 2. Pengkabelan 4-Wire Strain Gauge Load Cell ke HX711

| Warna Kabel Load Cell | Terminal HX711 | Fungsi Sinyal |
|---|---|---|
| **Merah (Red)** | `E+` | Tegangan Eksitasi Positif (+5V) |
| **Hitam (Black)** | `E-` | Tegangan Eksitasi Negatif (GND) |
| **Hijau (Green)** | `A+` | Sinyal Diferensial Positif (+mV) |
| **Putih (White)** | `A-` | Sinyal Diferensial Negatif (-mV) |
| **Kuning/Shield (Bare)**| `GND` | Pelindung EMI/RFI (Grounding Chasis) |

---

## 3. Prosedur Kalibrasi Beban Nyata (Calibration Procedure)

1. **Persiapan**:
   - Pastikan platform timbangan berada di permukaan lantai RPHU yang datar dan kokoh.
   - Bersihkan platform dan nyalakan perangkat selama minimal 5 menit agar tercapai *thermal equilibrium* (kestabilan suhu).
2. **Penentuan Titik Nol (Tare)**:
   - Tanpa ada beban di atas platform, panggil fungsi `scale.tare()`. Nilai ADC mentah disimpan sebagai `zero_offset`.
3. **Pengujian Beban Standar (Known Weight)**:
   - Letakkan anak timbang bersertifikat (misal $W_{known} = 20.00\text{ kg}$).
   - Catat nilai ADC mentah yang terbaca ($ADC_{raw}$).
4. **Hitung Faktor Kalibrasi (Calibration Factor)**:
   $$\text{Calibration Factor} = \frac{ADC_{raw} - \text{zero\_offset}}{W_{known}}$$
   - Masukkan nilai ini ke dalam konstanta `CALIBRATION_FACTOR` di `include/config.h`.

---

## 4. Tips Reduksi Noise di Lingkungan RPHU

1. **Jalur Terpilin (Twisted Pair & Shielded Cable)**: Sinyal dari Load Cell ke modul HX711 berupa mili-volt (sangat rentan induksi dinamo motor mesin potong atau pompa air). Gunakan kabel berpelindung (*shielded audio cable*) dengan ground terhubung ke ground logam.
2. **Jarak Kabel HX711**: Letakkan modul HX711 sedekat mungkin dengan Load Cell (panjang kabel sensor < 50 cm), sedangkan jalur digital dari HX711 ke ESP32 boleh diperpanjang hingga 2-3 meter.
3. **Kapasitor Bypass**: Pasang kapasitor $100\text{nF}$ keramik sedekat mungkin dengan pin VCC dan GND HX711.
