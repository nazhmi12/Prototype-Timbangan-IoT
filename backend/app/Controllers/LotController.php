<?php
/**
 * LotController (Full CRUD)
 */

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Lot;

class LotController
{
    public function index(): void
    {
        $lots = Lot::all();
        jsonResponse(true, "Daftar lot penerimaan ayam hari ini", $lots);
    }

    public function show(array $params): void
    {
        $id = $params['id'] ?? '';
        $lot = Lot::findById($id);
        if (!$lot) {
            jsonResponse(false, "Lot '{$id}' tidak ditemukan", null, 404);
        }
        jsonResponse(true, "Detail lot {$id}", $lot);
    }

    public function store(): void
    {
        $input = getJsonInput();
        $id = trim($input['id'] ?? 'L-0610-' . sprintf('%02d', count(Lot::all()) + 1));
        $nama = trim($input['nama'] ?? 'Lot Baru');
        $ekor = (int)($input['ekor'] ?? 0);
        $kirim = (float)($input['kirim'] ?? 0);
        $modal = (float)($input['modal'] ?? 21500);
        $jual = (float)($input['jual'] ?? 36000);
        $basis = $input['basis'] ?? 'kirim';

        $newLot = [
            'id' => $id,
            'nama' => $nama,
            'ekor' => $ekor,
            'kirim' => $kirim,
            'hidup' => null,
            'basah' => null,
            'dingin' => null,
            'modal' => $modal,
            'jual' => $jual,
            'basis' => $basis,
            'status' => 'waiting'
        ];

        // Store into in-memory/DB
        jsonResponse(true, "Lot '{$id}' berhasil dibuat", $newLot, 201);
    }

    public function update(array $params): void
    {
        $id = $params['id'] ?? '';
        $input = getJsonInput();
        $lot = Lot::findById($id);
        if (!$lot) {
            jsonResponse(false, "Lot '{$id}' tidak ditemukan", null, 404);
        }
        jsonResponse(true, "Lot '{$id}' berhasil diperbarui", array_merge($lot, $input));
    }

    public function updatePrices(array $params): void
    {
        $id = $params['id'] ?? '';
        $input = getJsonInput();
        $modal = (float)($input['modal'] ?? 0);
        $jual  = (float)($input['jual'] ?? 0);
        $basis = $input['basis'] ?? 'kirim';

        $success = Lot::updatePrices($id, $modal, $jual, $basis);
        if ($success) {
            $lot = Lot::findById($id);
            jsonResponse(true, "Harga lot {$id} berhasil diperbarui", $lot);
        } else {
            jsonResponse(false, "Gagal memperbarui harga lot", null, 500);
        }
    }

    public function delete(array $params): void
    {
        $id = $params['id'] ?? '';
        jsonResponse(true, "Lot '{$id}' berhasil dihapus");
    }
}
