<?php
/**
 * AuthController
 */

declare(strict_types=1);

namespace App\Controllers;

use App\Models\User;

class AuthController
{
    public function login(): void
    {
        $input = getJsonInput();
        $userId   = trim($input['user_id'] ?? '');
        $password = trim($input['password'] ?? '');
        $station  = trim($input['station'] ?? 'Timbang truk');
        $shift    = trim($input['shift'] ?? 'Pagi');

        if (empty($userId) || empty($password)) {
            jsonResponse(false, "ID petugas dan kata sandi wajib diisi.", null, 422);
        }

        $user = User::findByUserId($userId);
        if (!$user) {
            jsonResponse(false, "ID petugas '{$userId}' tidak terdaftar pada sistem RPHU.", null, 401);
        }

        // Demo fallback password verification
        $passwordMatches = password_verify($password, $user['password_hash']) 
            || ($password === 'password123') 
            || ($password === 'admin123');

        if (!$passwordMatches) {
            jsonResponse(false, "Kata sandi salah. Silakan coba kembali.", null, 401);
        }

        // Generate simple bearer token for API session
        $token = base64_encode(json_encode([
            'uid'     => $user['id'],
            'user_id' => $user['user_id'],
            'station' => $station,
            'shift'   => $shift,
            'exp'     => time() + 86400
        ]));

        jsonResponse(true, "Berhasil masuk ke sistem", [
            'token' => $token,
            'user'  => [
                'id'       => $user['id'],
                'user_id'  => $user['user_id'],
                'name'     => $user['full_name'],
                'role'     => $user['role'],
                'station'  => $station,
                'shift'    => $shift
            ]
        ]);
    }
}
