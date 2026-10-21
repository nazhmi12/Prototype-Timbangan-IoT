-- =============================================================================
-- SISTEM TIMBANG & SUSUT BOBOT AYAM RPHU
-- DATABASE SCHEMA DEFINITION (MySQL 8.0 / MariaDB 10.11)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `rphu_timbang_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `rphu_timbang_db`;

-- -----------------------------------------------------------------------------
-- 1. Tabel users (Petugas & Operator Timbang)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(50) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('operator', 'admin', 'super_admin') NOT NULL DEFAULT 'operator',
  `default_station` VARCHAR(50) DEFAULT 'Timbang 1',
  `is_protected` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = Super Admin dilindungi, tidak dapat dihapus',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trigger: Melindungi akun Super Admin dari penghapusan (Anti-Delete)
DROP TRIGGER IF EXISTS `trg_prevent_super_admin_delete`;
DELIMITER $$
CREATE TRIGGER `trg_prevent_super_admin_delete`
BEFORE DELETE ON `users`
FOR EACH ROW
BEGIN
  IF OLD.role = 'super_admin' OR OLD.is_protected = 1 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Ditolak: Akun Super Admin dilindungi sistem dan tidak dapat dihapus!';
  END IF;
END$$
DELIMITER ;

-- -----------------------------------------------------------------------------
-- 2. Tabel livestock_farmers (Peternak / Pemasok Unggas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `livestock_farmers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `farmer_code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `region` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `default_base_price` DECIMAL(12,2) NOT NULL DEFAULT 21000.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_farmers_code` (`farmer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Tabel lots (Batch Penerimaan Unggas per Pengiriman)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lots` (
  `id` VARCHAR(32) NOT NULL,
  `farmer_id` INT UNSIGNED NULL,
  `total_birds` INT UNSIGNED NOT NULL DEFAULT 0,
  `send_weight` DECIMAL(10,2) NOT NULL COMMENT 'Bobot kirim di kandang (kg)',
  `received_alive_weight` DECIMAL(10,2) NULL COMMENT 'Bobot hidup tiba di RPHU (kg)',
  `wet_carcass_weight` DECIMAL(10,2) NULL COMMENT 'Bobot karkas basah (kg)',
  `cold_carcass_weight` DECIMAL(10,2) NULL COMMENT 'Bobot karkas dingin (kg)',
  `price_live_bird` DECIMAL(12,2) NOT NULL DEFAULT 21500.00 COMMENT 'Harga modal ayam hidup (Rp/kg)',
  `price_carcass` DECIMAL(12,2) NOT NULL DEFAULT 36000.00 COMMENT 'Harga jual karkas (Rp/kg)',
  `payment_basis` ENUM('kirim', 'terima') NOT NULL DEFAULT 'kirim' COMMENT 'Dasar pembayaran ke peternak',
  `status` ENUM('waiting', 'processing', 'completed') NOT NULL DEFAULT 'waiting',
  `arrival_date` DATE NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lots_arrival_date` (`arrival_date`),
  CONSTRAINT `fk_lots_farmer` FOREIGN KEY (`farmer_id`) REFERENCES `livestock_farmers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Tabel devices (Stasiun & Perangkat IoT ESP32)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `devices` (
  `id` VARCHAR(50) NOT NULL,
  `device_name` VARCHAR(100) NOT NULL,
  `station_name` VARCHAR(80) NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `mac_address` VARCHAR(17) NULL,
  `calibration_factor` DECIMAL(10,2) NOT NULL DEFAULT -21450.00,
  `is_online` TINYINT(1) NOT NULL DEFAULT 0,
  `last_heartbeat` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Tabel weighings (Riwayat Transaksi Penimbangan - Append Only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `weighings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lot_id` VARCHAR(32) NOT NULL,
  `device_id` VARCHAR(50) NOT NULL,
  `recorded_by_user_id` INT UNSIGNED NOT NULL,
  `stage` ENUM('hidup', 'basah', 'dingin') NOT NULL,
  `measured_weight_kg` DECIMAL(10,2) NOT NULL,
  `raw_adc_value` BIGINT NOT NULL DEFAULT 0,
  `is_stable` TINYINT(1) NOT NULL DEFAULT 1,
  `is_correction` TINYINT(1) NOT NULL DEFAULT 0,
  `operator_notes` VARCHAR(255) NULL,
  `recorded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_weighings_lot` (`lot_id`),
  KEY `idx_weighings_stage` (`stage`),
  KEY `idx_weighings_date` (`recorded_at`),
  CONSTRAINT `fk_weighings_lot` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_weighings_user` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Tabel audit_logs (Audit Trail Keamanan & Anti-Tampering)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `action_type` VARCHAR(50) NOT NULL,
  `target_table` VARCHAR(50) NOT NULL,
  `target_id` VARCHAR(50) NOT NULL,
  `old_value` JSON NULL,
  `new_value` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_action` (`action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
