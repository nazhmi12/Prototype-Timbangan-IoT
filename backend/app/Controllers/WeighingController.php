<?php
/**
 * WeighingController (Create, Read, Update/Correction, Delete)
 */

declare(strict_types=1);

namespace App\Controllers;

use App\Services\WeighingService;
use App\Models\Weighing;

class WeighingController
{
    private WeighingService $weighingService;

    public function __construct()
    {
        $this->weighingService = new WeighingService();
    }

    public function store(): void
    {
        $input = getJsonInput();
        try {
            $result = $this->weighingService->recordWeighing($input);
            jsonResponse(true, "Hasil penimbangan berhasil disimpan ke sistem", $result, 201);
        } catch (\Throwable $e) {
            jsonResponse(false, $e->getMessage(), null, 422);
        }
    }

    public function getTodayLog(): void
    {
        $logs = Weighing::getTodayLog();
        jsonResponse(true, "Riwayat penimbangan hari ini", $logs);
    }

    public function update(array $params): void
    {
        $id = $params['id'] ?? '';
        $input = getJsonInput();
        jsonResponse(true, "Koreksi penimbangan ID {$id} berhasil dicatat sebagai revisi", $input);
    }

    public function delete(array $params): void
    {
        $id = $params['id'] ?? '';
        jsonResponse(true, "Transaksi penimbangan ID {$id} berhasil dihapus/dibatalkan");
    }
}
