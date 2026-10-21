<?php
/**
 * Weighing Service Unit Test
 */

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;
use App\Services\WeighingService;
use Exception;

class WeighingTest extends TestCase
{
    private WeighingService $service;

    protected function setUp(): void
    {
        $this->service = new WeighingService();
    }

    public function testRecordValidWeighing(): void
    {
        $result = $this->service->recordWeighing([
            'lot_id'    => 'L-0610-01',
            'stage'     => 'hidup',
            'weight_kg' => 4845.0,
            'user_id'   => 1
        ]);

        $this->assertIsArray($result);
        $this->assertEquals('L-0610-01', $result['lot_id']);
        $this->assertEquals(4845.0, $result['weight_kg']);
    }

    public function testInvalidStageProgressionThrowsException(): void
    {
        $this->expectException(Exception::class);
        // Lot L-0610-03 belum ada tahap hidup, tidak boleh langsung timbang basah
        $this->service->recordWeighing([
            'lot_id'    => 'L-0610-03',
            'stage'     => 'basah',
            'weight_kg' => 2500.0,
            'user_id'   => 1
        ]);
    }
}
