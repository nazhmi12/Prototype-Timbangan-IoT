# 📚 Dokumentasi Teknis Sistem Timbang & Susut RPHU

Folder ini memuat dokumentasi lengkap spesifikasi arsitektur, diagram UML, skematik wiring perangkat keras, dan skema database untuk penyusunan laporan Tugas Akhir (BAB III & BAB IV).

## 📑 Daftar Isi Dokumen

1. [**Arsitektur Sistem**](arsitektur-sistem.md)
   - Gambaran umum sistem berlapis (Layered IoT Architecture)
   - Diagram aliran data (Data Flow Pipeline)
   - Desain filter peredam getaran (Flapping Movement Vibration Filter)
   - Protokol komunikasi telemetri (MQTT vs REST)

2. [**Spesifikasi Perangkat Keras (Hardware)**](spesifikasi-hardware.md)
   - Bill of Materials (BOM) & komponen elektronik
   - Karakteristik Load Cell & Konverter 24-bit ADC HX711
   - Desain proteksi industri (IP65 enclosure & galvanic isolation)
   - Analisis estimasi biaya prototipe

3. [**Spesifikasi REST API**](spesifikasi-api.md)
   - Daftar endpoint API autentikasi, lot, timbang, dan perangkat
   - Struktur request dan format response JSON
   - Status code & error handling standar

4. [**Skema Database & ERD**](database-schema.md)
   - Diagram Relasi Entitas (ERD)
   - Kamus data tabel (`users`, `lots`, `weighings`, `devices`, `audit_logs`)
   - Indeks performa & relasi foreign key

5. [**Diagram Teknis UML**](diagrams/)
   - `use-case-diagram.png`: Interaksi pengguna dengan sistem
   - `activity-diagram.png`: Alur proses operasional penimbangan & kalkulasi susut
   - `sequence-diagram.png`: Urutan pesan antar modul saat penimbangan berlangsung
   - `deployment-diagram.png`: Pemetaan node fisik dan topologi jaringan

6. [**Perkabelan & Skematik Wiring**](wiring/)
   - `esp32-loadcell-hx711.png`: Diagram skematik koneksi pin
   - `wiring-notes.md`: Catatan teknis pengkabelan, reduksi noise analog, dan prosedur kalibrasi beban
