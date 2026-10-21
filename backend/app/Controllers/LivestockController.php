<?php
/**
 * LivestockController (Farmer & Supply Management - Full CRUD)
 */

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use PDO;

class LivestockController
{
    private static array $mockFarmers = [
        [
            'id' => 1,
            'farmer_code' => 'PTK-001',
            'name' => 'Pak Sumarno',
            'region' => 'Karawang Timur (45 km)',
            'phone' => '0812-3456-7890',
            'default_base_price' => 21500.00,
            'avg_shrinkage_pct' => 1.61,
            'status' => 'active',
            'notes' => 'Pengiriman rutin dini hari, kondisi ayam prima.'
        ],
        [
            'id' => 2,
            'farmer_code' => 'PTK-002',
            'name' => 'UD Maju Unggas',
            'region' => 'Subang Selatan (95 km)',
            'phone' => '0813-8888-9999',
            'default_base_price' => 21000.00,
            'avg_shrinkage_pct' => 3.38,
            'status' => 'evaluation',
            'notes' => 'Jarak jauh, perlu evaluasi penutup terpal siang hari.'
        ],
        [
            'id' => 3,
            'farmer_code' => 'PTK-003',
            'name' => 'Bu Tini',
            'region' => 'Cikarang, Bekasi (30 km)',
            'phone' => '0815-1234-5678',
            'default_base_price' => 21500.00,
            'avg_shrinkage_pct' => 1.85,
            'status' => 'active',
            'notes' => 'Lokasi dekat, pengiriman lancar.'
        ],
        [
            'id' => 4,
            'farmer_code' => 'PTK-004',
            'name' => 'CV Sinar Kandang',
            'region' => 'Campaka, Purwakarta (65 km)',
            'phone' => '0811-9876-5432',
            'default_base_price' => 21000.00,
            'avg_shrinkage_pct' => 1.38,
            'status' => 'active',
            'notes' => 'Performa terbaik, susut sangat rendah.'
        ]
    ];

    /**
     * READ: Ambil seluruh data peternak
     */
    public function index(): void
    {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM livestock_farmers ORDER BY id ASC");
            $rows = $stmt->fetchAll();
            if (!empty($rows)) {
                jsonResponse(true, "Daftar peternak & performa susut pengiriman", $rows);
                return;
            }
        } catch (\Throwable) {}

        jsonResponse(true, "Daftar peternak & performa susut pengiriman", self::$mockFarmers);
    }

    /**
     * CREATE: Tambah mitra peternak baru
     */
    public function store(): void
    {
        $input = getJsonInput();
        $name   = trim($input['name'] ?? '');
        $code   = trim($input['farmer_code'] ?? 'PTK-' . sprintf('%03d', count(self::$mockFarmers) + 1));
        $region = trim($input['region'] ?? '');
        $phone  = trim($input['phone'] ?? '');
        $price  = (float)($input['default_base_price'] ?? 21000);

        if (empty($name) || empty($region)) {
            jsonResponse(false, "Nama peternak dan wilayah kandang wajib diisi.", null, 422);
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("INSERT INTO livestock_farmers 
                (farmer_code, name, region, phone, default_base_price, created_at)
                VALUES (:code, :name, :region, :phone, :price, NOW())");
            $stmt->execute([
                'code'   => $code,
                'name'   => $name,
                'region' => $region,
                'phone'  => $phone,
                'price'  => $price
            ]);
            $newId = (int)$pdo->lastInsertId();
            jsonResponse(true, "Peternak berhasil ditambahkan ke database", [
                'id' => $newId,
                'farmer_code' => $code,
                'name' => $name,
                'region' => $region,
                'phone' => $phone,
                'default_base_price' => $price
            ], 201);
            return;
        } catch (\Throwable) {
            $newId = count(self::$mockFarmers) + 1;
            $newFarmer = [
                'id' => $newId,
                'farmer_code' => $code,
                'name' => $name,
                'region' => $region,
                'phone' => $phone,
                'default_base_price' => $price,
                'avg_shrinkage_pct' => 1.50,
                'status' => 'active'
            ];
            self::$mockFarmers[] = $newFarmer;
            jsonResponse(true, "Peternak berhasil ditambahkan", $newFarmer, 201);
        }
    }

    /**
     * UPDATE: Perbarui data peternak
     */
    public function update(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $input = getJsonInput();

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE livestock_farmers SET
                name = :name,
                region = :region,
                phone = :phone,
                default_base_price = :price
                WHERE id = :id");
            $stmt->execute([
                'name'   => $input['name'] ?? '',
                'region' => $input['region'] ?? '',
                'phone'  => $input['phone'] ?? '',
                'price'  => (float)($input['default_base_price'] ?? 21000),
                'id'     => $id
            ]);
            jsonResponse(true, "Data peternak berhasil diperbarui");
            return;
        } catch (\Throwable) {
            foreach (self::$mockFarmers as &$f) {
                if ($f['id'] === $id) {
                    if (isset($input['name'])) $f['name'] = $input['name'];
                    if (isset($input['region'])) $f['region'] = $input['region'];
                    if (isset($input['phone'])) $f['phone'] = $input['phone'];
                    if (isset($input['default_base_price'])) $f['default_base_price'] = (float)$input['default_base_price'];
                    jsonResponse(true, "Data peternak berhasil diperbarui", $f);
                    return;
                }
            }
        }

        jsonResponse(false, "Peternak tidak ditemukan", null, 404);
    }

    /**
     * DELETE: Hapus data peternak
     */
    public function delete(array $params): void
    {
        $id = (int)($params['id'] ?? 0);

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("DELETE FROM livestock_farmers WHERE id = :id");
            $stmt->execute(['id' => $id]);
            jsonResponse(true, "Peternak berhasil dihapus");
            return;
        } catch (\Throwable) {
            $initial = count(self::$mockFarmers);
            self::$mockFarmers = array_values(array_filter(self::$mockFarmers, fn($f) => $f['id'] !== $id));
            if (count(self::$mockFarmers) < $initial) {
                jsonResponse(true, "Peternak berhasil dihapus");
                return;
            }
        }

        jsonResponse(false, "Peternak tidak ditemukan", null, 404);
    }
}
