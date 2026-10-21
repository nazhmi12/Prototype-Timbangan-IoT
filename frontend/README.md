# 🖥️ Frontend Web Dashboard – Sistem Timbang & Susut RPHU

Antarmuka web kelas industri (Industrial UI/UX) untuk operasional Rumah Potong Hewan Unggas (RPHU), dirancang menggunakan Vanilla CSS dan Vanilla JavaScript modern tanpa dependensi berat agar ringan dijalankan pada komputer operator pabrik, tablet touch-screen, maupun perangkat mobile dermaga.

## 📁 Struktur Halaman & Komponen
- `login.html`: Gerbang masuk stasiun timbang (pilihan stasiun, shift kerja, deteksi Caps Lock, dan chip akun demo).
- `pages/timbang-susut.html`: Stasiun kerja penimbangan digital utama (HUD LED indicator, filter peredam getaran ayam, kalkulasi susut transit, chilling, yield karkas, dan evaluasi laba/rugi).
- `pages/dashboard.html`: Ringkasan eksekutif dan KPI operasional pabrik.
- `pages/penerimaan-ayam.html`: Dermaga penerimaan truk dan pencatatan surat jalan kandang.
- `pages/produksi.html`: Jalur sembelih, eviscerasi, dan penimbangan karkas basah.
- `pages/cold-storage.html`: Pemantauan suhu chiller dan inventori karkas dingin.
- `pages/penjualan.html`: Distribusi penjualan karkas dan realisasi pendapatan.
- `pages/peternak.html`: Direktori peternak mitra dan pemeringkatan susut transit.
- `pages/laporan.html`: Rekapitulasi laporan berkala dengan fitur ekspor CSV dan cetak.

## ✨ Fitur Unggulan UI/UX
1. **Industrial LED Terminal Indicator**: Penampil angka bobot digital dengan indikator STABLE, TARE, NET, GROSS, dan progress bar stabilisasi getaran.
2. **Audio Beeper Synthesizer**: Suara bip konfirmasi stabil dan tare menggunakan Web Audio API tanpa perlu file audio eksternal.
3. **Dark / Light Theme Persisten**: Otomatis mengikuti preferensi OS atau tombol toggle manual dengan penyimpanan di `localStorage`.
4. **Simulator Mandiri Terpadu**: Dapat didemokan langsung saat presentasi sidang TA tanpa ketergantungan koneksi hardware fisik.
