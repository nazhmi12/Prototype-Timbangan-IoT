<?php
/**
 * Global Request Validation Helper
 */

declare(strict_types=1);

namespace App\Helpers;

class ValidationHelper
{
    public static function requireFields(array $data, array $required): ?string
    {
        foreach ($required as $field) {
            if (!isset($data[$field]) || trim((string)$data[$field]) === '') {
                return "Bidang '{$field}' wajib diisi.";
            }
        }
        return null;
    }

    public static function sanitize(mixed $data): mixed
    {
        if (is_array($data)) {
            return array_map([self::class, 'sanitize'], $data);
        }
        return is_string($data) ? htmlspecialchars(trim($data), ENT_QUOTES, 'UTF-8') : $data;
    }
}
