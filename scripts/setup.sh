#!/usr/bin/env bash
# ==============================================================================
# Script Otomasi Instalasi & Persiapan Lingkungan Sistem Timbang RPHU
# ==============================================================================
set -e

echo "🚀 [RPHU Setup] Menyiapkan lingkungan Sistem Timbang RPHU..."

# 1. Salin berkas konfigurasi .env jika belum ada
if [ ! -f .env ]; then
    echo "📋 Membuat berkas .env dari .env.example..."
    cp .env.example .env
fi

# 2. Buat direktori logs dan exports jika belum ada
mkdir -p backend/storage/logs
mkdir -p backend/storage/exports
chmod -R 777 backend/storage

# 3. Validasi Docker jika tersedia
if command -v docker &> /dev/null; then
    echo "🐳 Docker terdeteksi. Memulai docker compose..."
    docker compose up -d --build
    echo "✅ Container Docker berhasil dijalankan!"
    echo "🌐 Frontend: http://localhost:8080/frontend/src/login.html"
    echo "📡 Backend API: http://localhost:8000/api/v1"
    echo "🗄️ phpMyAdmin: http://localhost:8081"
else
    echo "ℹ️ Docker tidak ditemukan. Anda dapat menjalankan via server lokal Apache/PHP & MySQL."
fi

echo "✨ Inisialisasi selesai!"
