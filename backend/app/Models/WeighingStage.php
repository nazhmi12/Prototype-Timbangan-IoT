<?php
/**
 * Weighing Stage Enum/Constants
 */

declare(strict_types=1);

namespace App\Models;

class WeighingStage
{
    public const STAGE_HIDUP  = 'hidup';   // Ayam hidup diterima
    public const STAGE_BASAH  = 'basah';   // Karkas basah (setelah eviscerasi & cabut bulu)
    public const STAGE_DINGIN = 'dingin';  // Karkas dingin (setelah chilling room)

    public static function getLabels(): array
    {
        return [
            self::STAGE_HIDUP  => 'Ayam hidup diterima',
            self::STAGE_BASAH  => 'Karkas basah (setelah cabut bulu)',
            self::STAGE_DINGIN => 'Karkas dingin (setelah chilling)'
        ];
    }
}
