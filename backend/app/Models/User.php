<?php
/**
 * User Model
 */

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class User
{
    public static function findByUserId(string $userId): ?array
    {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT * FROM users WHERE user_id = :uid LIMIT 1");
            $stmt->execute(['uid' => $userId]);
            $user = $stmt->fetch();
            return $user ?: null;
        } catch (\Throwable) {
            // Fallback demo users jika DB belum termigrasi
            $demoUsers = [
                'petugas_01' => [
                    'id' => 1,
                    'user_id' => 'petugas_01',
                    'full_name' => 'Ahmad Fauzi (Operator)',
                    'password_hash' => password_hash('password123', PASSWORD_DEFAULT),
                    'role' => 'operator',
                    'default_station' => 'Timbang truk'
                ],
                'admin_rphu' => [
                    'id' => 2,
                    'user_id' => 'admin_rphu',
                    'full_name' => 'Budi Santoso (Supervisor)',
                    'password_hash' => password_hash('admin123', PASSWORD_DEFAULT),
                    'role' => 'supervisor',
                    'default_station' => 'Kantor'
                ]
            ];
            return $demoUsers[$userId] ?? null;
        }
    }
}
