#!/usr/bin/env bash
# Backup Database RPHU ke file SQL terkompresi
set -e

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="database/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/rphu_backup_$DATE.sql.gz"

echo "💾 Memulai backup database RPHU..."
if command -v mysqldump &> /dev/null; then
    mysqldump -u rphu_user -prphu_password123 rphu_timbang_db | gzip > "$BACKUP_FILE"
    echo "✅ Backup berhasil disimpan ke: $BACKUP_FILE"
else
    echo "⚠️ mysqldump tidak ditemukan. Jika menggunakan Docker, gunakan: docker exec rphu-mysql mysqldump -u rphu_user -prphu_password123 rphu_timbang_db > backup.sql"
fi
