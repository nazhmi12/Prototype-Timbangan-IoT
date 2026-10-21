-- =============================================================================
-- SISTEM TIMBANG RPHU - INITIAL SEED DATA
-- =============================================================================

USE `rphu_timbang_db`;

-- 1. Insert Default Users (Super Admin, Admin User, & Operator)
INSERT INTO `users` (`id`, `user_id`, `full_name`, `password_hash`, `role`, `default_station`, `is_protected`, `is_active`) VALUES
(1, 'superadmin', 'Ir. Budi Santoso (Super Admin)', '$2y$10$wWv32WvV3w2QhO/bqv5Kz.c5r7U9sU8zD8B7n4v2s1K9o2q8p3n8.', 'super_admin', 'Kantor Pusat / Direksi', 1, 1),
(2, 'admin_rphu', 'Siti Rahma (Admin User)', '$2y$10$wWv32WvV3w2QhO/bqv5Kz.c5r7U9sU8zD8B7n4v2s1K9o2q8p3n8.', 'admin', 'Kantor Operasional RPHU', 0, 1),
(3, 'operator_01', 'Ahmad Fauzi (Operator Timbang)', '$2y$10$wWv32WvV3w2QhO/bqv5Kz.c5r7U9sU8zD8B7n4v2s1K9o2q8p3n8.', 'operator', 'Timbang 1', 0, 1),
(4, 'petugas_01', 'Dedi Supriadi (Operator)', '$2y$10$wWv32WvV3w2QhO/bqv5Kz.c5r7U9sU8zD8B7n4v2s1K9o2q8p3n8.', 'operator', 'Timbang 1', 0, 1)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `role` = VALUES(`role`), `is_protected` = VALUES(`is_protected`);

-- 2. Insert Farmers
INSERT INTO `livestock_farmers` (`id`, `farmer_code`, `name`, `region`, `phone`, `default_base_price`) VALUES
(1, 'PTK-001', 'Pak Sumarno (Karawang)', 'Karawang Timur', '081234567890', 21500.00),
(2, 'PTK-002', 'UD Maju Unggas (Subang)', 'Subang Selatan', '081388889999', 21000.00),
(3, 'PTK-003', 'Bu Tini (Bekasi)', 'Cikarang, Bekasi', '081512345678', 21500.00),
(4, 'PTK-004', 'CV Sinar Kandang (Purwakarta)', 'Campaka, Purwakarta', '081198765432', 21000.00)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. Insert Lots (Matching Mockup Data)
INSERT INTO `lots` (`id`, `farmer_id`, `total_birds`, `send_weight`, `received_alive_weight`, `wet_carcass_weight`, `cold_carcass_weight`, `price_live_bird`, `price_carcass`, `payment_basis`, `status`, `arrival_date`) VALUES
('L-0610-01', 1, 2400, 4920.00, 4841.00, 3402.00, 3438.00, 21500.00, 36000.00, 'kirim', 'completed', CURDATE()),
('L-0610-02', 2, 3100, 6355.00, 6140.00, NULL,    NULL,    21000.00, 36000.00, 'kirim', 'processing', CURDATE()),
('L-0610-03', 3, 1800, 3690.00, NULL,    NULL,    NULL,    21500.00, 36000.00, 'kirim', 'waiting',    CURDATE()),
('L-0610-04', 4, 2750, 5640.00, 5562.00, 3911.00, NULL,    21000.00, 36000.00, 'kirim', 'processing', CURDATE())
ON DUPLICATE KEY UPDATE `send_weight` = VALUES(`send_weight`);

-- 4. Insert Devices
INSERT INTO `devices` (`id`, `device_name`, `station_name`, `ip_address`, `mac_address`, `calibration_factor`, `is_online`, `last_heartbeat`) VALUES
('SCALE-ESP32-01', 'Timbangan Platform Penerimaan 1', 'Timbang 1', '192.168.1.105', '24:6F:28:AB:12:01', -21450.00, 1, NOW()),
('SCALE-ESP32-02', 'Timbangan Gantung Karkas Chilling', 'Cold Storage', '192.168.1.106', '24:6F:28:AB:12:02', -18200.00, 1, NOW())
ON DUPLICATE KEY UPDATE `device_name` = VALUES(`device_name`);

-- 5. Insert Sample Initial Weighing Transactions
INSERT INTO `weighings` (`lot_id`, `device_id`, `recorded_by_user_id`, `stage`, `measured_weight_kg`, `raw_adc_value`, `is_stable`, `is_correction`, `operator_notes`, `recorded_at`) VALUES
('L-0610-01', 'SCALE-ESP32-01', 1, 'hidup', 4841.00, 8345900, 1, 0, 'Penimbangan ayam hidup diterima kloter 1', NOW() - INTERVAL 3 HOUR),
('L-0610-01', 'SCALE-ESP32-01', 1, 'basah', 3402.00, 5865200, 1, 0, 'Karkas basah setelah cabut bulu', NOW() - INTERVAL 2 HOUR),
('L-0610-01', 'SCALE-ESP32-01', 1, 'dingin', 3438.00, 5928100, 1, 0, 'Karkas dingin setelah chilling', NOW() - INTERVAL 1 HOUR),
('L-0610-02', 'SCALE-ESP32-01', 1, 'hidup', 6140.00, 10582000, 1, 0, 'Ayam hidup tiba truk 2', NOW() - INTERVAL 45 MINUTE),
('L-0610-04', 'SCALE-ESP32-01', 1, 'hidup', 5562.00, 9586000, 1, 0, 'Ayam hidup tiba truk 3', NOW() - INTERVAL 30 MINUTE),
('L-0610-04', 'SCALE-ESP32-01', 1, 'basah', 3911.00, 6742000, 1, 0, 'Karkas basah cv sinar kandang', NOW() - INTERVAL 15 MINUTE);
