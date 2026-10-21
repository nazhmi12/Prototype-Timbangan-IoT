<?php
/**
 * Global API Response Helper
 */

declare(strict_types=1);

if (!function_exists('jsonResponse')) {
    function jsonResponse(bool $success, string $message, mixed $data = null, int $statusCode = 200, array $meta = []): void
    {
        http_response_code($statusCode);
        $payload = [
            'success'     => $success,
            'status_code' => $statusCode,
            'message'     => $message,
            'data'        => $data,
            'meta'        => array_merge(['timestamp' => time(), 'iso' => date('c')], $meta)
        ];
        echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if (!function_exists('getJsonInput')) {
    function getJsonInput(): array
    {
        $raw = file_get_contents('php://input');
        if (empty($raw)) {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
}
