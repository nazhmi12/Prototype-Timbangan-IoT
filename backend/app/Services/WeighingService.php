<?php
/**
 * Weighing Transaction & State Progression Service
 */

declare(strict_types=1);

namespace App\Services;

use App\Models\Lot;
use App\Models\Weighing;
use App\Models\AuditLog;
use Exception;

class WeighingService
{
    /**
     * Catat penimbangan baru ke database
     */
    public function recordWeighing(array $data): array
    {
        $lotId    = $data['lot_id'] ?? '';
        $stage    = $data['stage'] ?? '';
        $weightKg = (float)($data['weight_kg'] ?? 0.0);
        $userId   = (int)($data['user_id'] ?? 1);
        $deviceId = $data['device_id'] ?? 'SCALE-ESP32-01';
        $notes    = $data['notes'] ?? null;

        if (empty($lotId) || empty($stage) || $weightKg <= 0) {
            throw new Exception("Parameter penimbangan tidak valid (lot_id, stage, weight_kg).");
        }

        // Ambil data lot
        $lot = Lot::findById($lotId);
        if (!$lot) {
            throw new Exception("Lot '{$lotId}' tidak ditemukan.");
        }

        // Validasi urutan tahap penimbangan RPHU
        if ($stage === 'basah' && empty($lot['received_alive_weight'])) {
            throw new Exception("Tahap 'hidup' (ayam hidup diterima) wajib ditimbang terlebih dahulu sebelum karkas basah.");
        }
        if ($stage === 'dingin' && empty($lot['wet_carcass_weight'])) {
            throw new Exception("Tahap 'basah' (karkas basah) wajib ditimbang terlebih dahulu sebelum karkas dingin.");
        }

        $isCorrection = false;
        if (!empty($lot[$this->getLotColumnForStage($stage)])) {
            $isCorrection = true;
        }

        // Simpan ke riwayat penimbangan (Append-Only)
        $weighingId = Weighing::create([
            'lot_id'             => $lotId,
            'device_id'          => $deviceId,
            'recorded_by_user_id'=> $userId,
            'stage'              => $stage,
            'measured_weight_kg' => $weightKg,
            'raw_adc_value'      => (int)($data['raw_adc'] ?? 0),
            'is_stable'          => (bool)($data['is_stable'] ?? true),
            'is_correction'      => $isCorrection,
            'operator_notes'     => $notes
        ]);

        // Perbarui bobot aktif pada lot
        Lot::updateStageWeight($lotId, $stage, $weightKg);

        // Catat Audit Trail
        AuditLog::record(
            $userId,
            $isCorrection ? 'REVISE_WEIGHT' : 'RECORD_WEIGHT',
            'weighings',
            (string)$weighingId,
            ['previous_weight' => $lot[$this->getLotColumnForStage($stage)] ?? null],
            ['new_weight' => $weightKg, 'stage' => $stage]
        );

        return [
            'weighing_id'   => $weighingId,
            'lot_id'        => $lotId,
            'stage'         => $stage,
            'weight_kg'     => $weightKg,
            'is_correction' => $isCorrection,
            'recorded_at'   => date('Y-m-d H:i:s')
        ];
    }

    private function getLotColumnForStage(string $stage): string
    {
        return match ($stage) {
            'hidup'  => 'received_alive_weight',
            'basah'  => 'wet_carcass_weight',
            'dingin' => 'cold_carcass_weight',
            default  => 'received_alive_weight'
        };
    }
}
