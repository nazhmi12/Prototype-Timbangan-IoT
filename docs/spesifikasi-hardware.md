# ⚙️ Spesifikasi Perangkat Keras (Hardware BOM)

Dokumen ini merupakan acuan penyusunan BAB III Skripsi mengenai perancangan dan pemilihan komponen perangkat keras untuk purwarupa alat penimbang otomasi RPHU.

---

## 1. Bill of Materials (BOM) & Spesifikasi Komponen

| No | Komponen | Model / Spesifikasi | Fungsi Teknis | Estimasi Harga (IDR) |
|---|---|---|---|---|
| 1 | **Mikrokontroler Utama** | ESP32-WROOM-32 (Dual Core 240MHz, 4MB Flash, Wi-Fi & BLE) | Pemroses sinyal filter digital, pengendali display, & pengirim MQTT telemetri | Rp 65.000 |
| 2 | **Modul Penguat ADC** | HX711 24-bit Analog-to-Digital Converter Shield | Memperkuat dan mengonversi sinyal tegangan mikrovolt dari jembatan Wheatstone | Rp 18.000 |
| 3 | **Sensor Berat** | Single Point Load Cell 100 kg / 4x Shear Beam 200 kg | Mengukur deformasi mekanis akibat beban massa keranjang ayam / karkas | Rp 165.000 |
| 4 | **Tampilan Lokal** | LCD 2004 (20x4 Karakter) dengan I2C Backback PCF8574 | Menampilkan bobot realtime, status STABLE/TARE, dan status koneksi Wi-Fi | Rp 38.000 |
| 5 | **Indikator Audio & Visual** | Buzzer Aktif 5V + LED Hijau, Merah, Biru 5mm | Memberikan feedback suara saat bobot stabil & indikator status sistem | Rp 7.000 |
| 6 | **Tombol Kendali** | 3x Tactile Push Button 12mm Industrial Grade | Tombol TARE (Nol-kan wadah), ZERO (Kalibrasi nol), dan SIMPAN MANUAL | Rp 9.000 |
| 7 | **Catu Daya (Power Supply)** | Switching PSU 5V DC 2.5A / Adaptor AC-DC Industrial | Sumber tegangan teregulasi dengan ripple rendah (< 50mV) | Rp 45.000 |
| 8 | **Kotak Enclosure** | Enclosure Box Waterproof IP65 (158x90x60 mm) | Melindungi elektronika dari percikan air sanitasi RPHU yang lembab | Rp 42.000 |
| 9 | **Rangka Dudukan** | Plat Besi / Stainless Steel 304 (Ukuran 40x40 cm) | Platform dudukan keranjang ayam (crate) | Rp 150.000 |
| **Total** | | | **Estimasi Biaya Prototipe** | **Rp 534.000** |

---

## 2. Karakteristik Sensor Load Cell & HX711

- **Prinsip Kerja**: Jembatan Wheatstone dengan 4 strain gauge foil yang terikat pada struktur lentur aluminium/baja.
- **Sensitivitas Output**: $2.0 \pm 0.1\text{ mV/V}$.
- **Tegangan Eksitasi**: $5\text{ V DC}$ dari pin E+ dan E- HX711.
- **Resolusi ADC HX711**: 24-bit ($2^{24} = 16.777.216$ level kuantisasi).
- **Sampling Rate**: Dapat disetel 10 SPS (default) atau 80 SPS dengan menjepit pin `RATE` ke VCC untuk respon tanggap getaran dinamis.
- **Drift Suhu**: $\le 0.002\% \text{ FS}/^\circ\text{C}$ (dilengkapi kompensasi tare otomatis pada firmware).

---

## 3. Desain Proteksi Industri (Industrial Environment Hardening)

Area RPHU adalah lingkungan basah (*wet processing area*) dengan tingkat kelembapan $\ge 85\%$ dan paparan air semprot sanitasi harian:
1. **IP65 Enclosure**: Semua komponen elektronika dan display dipasang di dalam kotak kedap debu dan semprotan air dengan gland kabel bersilikon.
2. **De-coupling & Low Noise**: Ditambahkan kapasitor decoupling $100\mu\text{F}$ elektrolit dan $0.1\mu\text{F}$ keramik pada jalur VCC-GND HX711 guna mencegah interferensi motor conveyor atau chiller kompresor.
3. **Galvanic Isolation / Grounding**: Rangka besi platform timbang ditanahkan (*earth ground*) untuk membuang listrik statis akibat gesekan keranjang plastik.
