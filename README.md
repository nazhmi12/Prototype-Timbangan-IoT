# 🐔 Sistem Timbang Otomasi & Analisis Susut Bobot Ayam RPHU
### Industrial IoT Solution for Poultry Slaughterhouse (Rumah Potong Hewan Unggas)
**Tugas Akhir / Skripsi Teknik Elektro / Informatika / Sistem Komputer**

[![IoT](https://img.shields.io/badge/IoT-ESP32%20%7C%20FreeRTOS-00979D?style=flat-square&logo=espressif)](https://www.espressif.com/)
[![Sensor](https://img.shields.io/badge/Sensor-HX711%2024--bit%20ADC%20%7C%20Load%20Cell-F7931E?style=flat-square)](https://cdn.sparkfun.com/datasheets/Sensors/ForceFlex/hx711_english.pdf)
[![MQTT](https://img.shields.io/badge/Protocol-MQTT%20v3.1.1-660066?style=flat-square&logo=eclipsemosquitto)](https://mosquitto.org/)
[![Backend](https://img.shields.io/badge/Backend-PHP%208.2%20MVC%20REST-777BB4?style=flat-square&logo=php)](https://www.php.net/)
[![Database](https://img.shields.io/badge/Database-MySQL%208.0-4479A1?style=flat-square&logo=mysql)](https://www.mysql.com/)
[![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20CSS%20%26%20JS%20(Industrial%20UI)-E34F26?style=flat-square&logo=html5)](/)

---

## 📌 1. Latar Belakang Masalah (Domain Skripsi/TA)
Dalam rantai pasok industri perunggasan (poultry supply chain), khususnya pada operasional **Rumah Potong Hewan Unggas (RPHU)** berkapasitas komersial, **susut bobot (weight shrinkage)** adalah salah satu faktor penyebab kerugian finansial terbesar yang sering kali luput dari pemantauan presisi realtime.

Tiga titik kritis penyusutan bobot ayam:
1. **Susut Transit (Transit Shrinkage)**:
   Selisih bobot antara saat ayam ditimbang di kandang peternak (*berat kirim*) dengan saat truk tiba di dermaga penerimaan RPHU (*ayam hidup diterima*). Dipicu oleh lama durasi perjalanan, suhu terik, stres, ventilasi, dan ekskresi (feses). Nilai normal berkisar antara $1.5\% - 3.5\%$.
2. **Susut Sembelih & Pembersihan (Bleeding, Scalding, Defeathering & Evisceration)**:
   Pengurangan bobot saat konversi dari ayam hidup menjadi karkas basah (*warm carcass*). Normal yield berkisar antara $68\% - 73\%$.
3. **Susut Pendinginan (Chilling Shrinkage)**:
   Perubahan bobot karkas basah setelah melewati proses perendaman/chiller (*air blast / spin chiller*) menjadi karkas dingin siap simpan (*cold storage*). Pada *spin chilling* terjadi penyerapan air (*water pickup*), sedangkan pada *air chilling* terjadi evaporasi (*drip loss*).

### 💡 Solusi yang Dibangun
Sistem ini mengintegrasikan:
- **Perangkat Keras IoT**: ESP32 microcontroller dengan modul konverter ADC 24-bit HX711, 4-wire high-precision Load Cell platform, digital low-pass moving average filter untuk mereduksi getaran ayam hidup (flapping vibration rejection), serta layar indikator lokal LCD2004/OLED.
- **Protokol Telemetri Ringan**: MQTT (Message Queuing Telemetry Transport) QoS 1 dengan fallback buffer SPIFFS saat jaringan terputus.
- **Backend & Database**: Arsitektur MVC PHP 8.2 & MySQL untuk kalkulasi susut otomatis, audit log anti-tampering, dan tracking finansial per lot peternak.
- **Frontend Dashboard**: Antarmuka kelas industri dengan *high-visibility digital weight indicator*, mode simulasi terpadu, grafik analitik, evaluasi laba/rugi kotor, dan ekspor laporan berkala.

---

## 🏛️ 2. Arsitektur Folder Proyek
```text
sistem-timbang-rphu/
├── README.md                          # Dokumentasi utama proyek TA
├── .gitignore                         # Git ignore list
├── .env.example                       # Contoh variabel lingkungan
├── docker-compose.yml                 # Stack Docker (Mosquitto, PHP, MySQL, phpMyAdmin)
│
├── docs/                              # Dokumentasi teknis & BAB III / IV skripsi
│   ├── README.md                      # Indeks dokumentasi
│   ├── arsitektur-sistem.md           # Desain arsitektur berlapis & pipeline data
│   ├── spesifikasi-hardware.md        # BOM hardware, spesifikasi komponen, & budget
│   ├── spesifikasi-api.md             # Dokumentasi endpoint REST API
│   ├── database-schema.md             # Kamus data, ERD, dan indeks relasional
│   ├── diagrams/                      # Diagram UML (Use Case, Activity, Sequence, Deployment)
│   └── wiring/                        # Skematik rangkaian & catatan teknis perkabelan
│
├── firmware/                          # Kode sumber embedded ESP32 (PlatformIO)
│   └── esp32-weighing-scale/
│       ├── platformio.ini             # Konfigurasi PlatformIO & dependency
│       ├── include/config.h           # Pinout GPIO & parameter kalibrasi
│       └── src/                       # Source code C++ (FreeRTOS dual-core)
│
├── backend/                           # API Server PHP 8.2 MVC
│   ├── public/index.php               # Front controller
│   ├── app/                           # Controllers, Models, Services, Middleware
│   └── database/                      # Migrations, seeders, schema SQL
│
├── frontend/                          # Dashboard Antarmuka Web Industri
│   ├── public/                        # Static assets (icons, images)
│   └── src/                           # HTML pages, CSS, JS modular, & components
│
├── database/                          # Skrip DDL & DML MySQL mandiri
├── mqtt/                              # Konfigurasi Mosquitto Broker
├── scripts/                           # Otomasi setup, backup, dan restore
└── tests/                             # Unit, integrasi, API, dan hardware test
```

---

## ⚡ 3. Cara Menjalankan Sistem

### A. Prasyarat Sistem
- Docker & Docker Compose (Rekomendasi untuk lingkungan lokal & server pengujian)
- Atau instalasi manual: PHP >= 8.2, MySQL >= 8.0, Mosquitto MQTT Broker, Web Server (Apache/Nginx)
- PlatformIO IDE / CLI untuk flashing firmware ESP32

### B. Menjalankan dengan Docker (Paling Cepat)
1. Salin berkas lingkungan:
   ```bash
   cp .env.example .env
   ```
2. Jalankan seluruh container:
   ```bash
   docker compose up -d
   ```
3. Akses antarmuka:
   - **Frontend Web**: `http://localhost:8080/frontend/src/login.html` atau `http://localhost:8080/frontend/src/pages/timbang-susut.html`
   - **Backend API**: `http://localhost:8000/api/v1`
   - **phpMyAdmin**: `http://localhost:8081` (User: `rphu_user`, Pass: `rphu_password123`)
   - **MQTT Broker**: `localhost:1883`

### C. Menjalankan Mode Frontend Mandiri (Standalone Client)
Cukup buka berkas langsung di browser modern (Chrome / Edge / Firefox / Safari):
- Halaman Login: `frontend/src/login.html`
- Stasiun Timbang & Susut: `frontend/src/pages/timbang-susut.html`
- Dashboard Ringkasan: `frontend/src/pages/dashboard.html`

Frontend dilengkapi **fitur simulator terintegrasi**, sehingga dapat langsung didemokan di hadapan dosen penguji tanpa harus menyalakan hardware timbangan fisik!

---

## 📊 4. Rumus Perhitungan Susut & Yield RPHU

| Parameter | Rumus Matematis | Toleransi Normal RPHU |
| :--- | :--- | :--- |
| **Susut Transit (%)** | $$\frac{W_{kirim} - W_{hidup}}{W_{kirim}} \times 100\%$$ | $1.5\% - 3.0\%$ |
| **Susut Chilling (%)** | $$\frac{W_{basah} - W_{dingin}}{W_{basah}} \times 100\%$$ | $-2.0\% \text{ s/d } +1.5\%$ |
| **Susut Total (%)** | $$\frac{W_{kirim} - W_{dingin}}{W_{kirim}} \times 100\%$$ | $28.0\% - 33.0\%$ |
| **Yield Karkas (%)** | $$\frac{W_{dingin}}{W_{hidup}} \times 100\%$$ | $68.0\% - 74.0\%$ |
| **Kerugian Transit (Rp)** | $$(W_{kirim} - W_{hidup}) \times P_{modal}$$ | Sesuai dasar akad peternak |
| **Kerugian Chilling (Rp)** | $$(W_{basah} - W_{dingin}) \times P_{jual}$$ | Dihitung dengan harga karkas |

---

## 🎓 5. Pedoman Sidang & Pengujian Skripsi (TA Checklist)
1. **Validasi Kalibrasi Sensor**: Uji akurasi timbangan dengan beban standar (anak timbang M1) $5\text{ kg}$, $10\text{ kg}$, $20\text{ kg}$, dan $50\text{ kg}$. Hitung nilai *Mean Absolute Error (MAE)* dan *Percentage Error*.
2. **Ketahanan Noise Flapping**: Tunjukkan bagaimana *Moving Average Filter* pada ESP32 meredam getaran ayam aktif hingga bobot terkonfirmasi stabil (*Stable Status LED aktif*).
3. **Audit Log Anti-Tampering**: Tunjukkan pada dosen penguji bahwa riwayat timbangan bersifat *append-only* (tidak dapat diedit maupun dihapus oleh operator biasa), setiap koreksi dicatat sebagai rekaman baru dengan status revisi.
4. **Analisis Finansial**: Tunjukkan kalkulasi margin kotor dan kerugian rupiah pada menu *Ringkasan Lot* yang langsung terupdate otomatis saat bobot disimpan.

---
Dikembangkan untuk implementasi operasional Rumah Potong Hewan Unggas modern & pemenuhan Tugas Akhir Sarjana.
