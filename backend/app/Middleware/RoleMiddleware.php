<?php
/**
 * RoleMiddleware
 */

declare(strict_types=1);

namespace App\Middleware;

class RoleMiddleware
{
    public static function requireRole(array $user, array $allowedRoles): void
    {
        $role = $user['role'] ?? 'operator';
        if (!in_array($role, $allowedRoles, true)) {
            jsonResponse(false, "Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini", null, 403);
        }
    }
}
