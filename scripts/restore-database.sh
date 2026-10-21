#!/usr/bin/env bash
# Restore Database RPHU dari berkas SQL
set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Harap sertakan path berkas backup! Contoh: ./scripts/restore-database.sh database/backups/rphu_backup_example.sql.gz"
    exit 1
fi

echo "🔄 Me-restore database dari $BACKUP_FILE..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | mysql -u rphu_user -prphu_password123 rphu_timbang_db
else
    mysql -u rphu_user -prphu_password123 rphu_timbang_db < "$BACKUP_FILE"
fi

echo "✅ Database berhasil di-restore!"
