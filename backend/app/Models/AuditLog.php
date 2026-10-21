<?php
/**
 * Audit Log Model (Security and Anti-Tampering)
 */

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;

class AuditLog
{
    public static function record(int $userId, string $action, string $table, string $targetId, ?array $old = null, ?array $new = null): bool
    {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("INSERT INTO audit_logs 
                (user_id, action_type, target_table, target_id, old_value, new_value, ip_address, created_at)
                VALUES (:uid, :act, :tbl, :tid, :old, :new, :ip, NOW())");

            return $stmt->execute([
                'uid' => $userId,
                'act' => $action,
                'tbl' => $table,
                'tid' => $targetId,
                'old' => $old ? json_encode($old) : null,
                'new' => $new ? json_encode($new) : null,
                'ip'  => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);
        } catch (\Throwable) {
            return false;
        }
    }
}
