<?php
/**
 * Database Connection Config using PDO Singleton
 */

declare(strict_types=1);

namespace App\Config;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $connection = null;

    public static function getConnection(): PDO
    {
        if (self::$connection === null) {
            $host     = getenv('DB_HOST') ?: '127.0.0.1';
            $port     = getenv('DB_PORT') ?: '3306';
            $database = getenv('DB_DATABASE') ?: 'rphu_timbang_db';
            $username = getenv('DB_USERNAME') ?: 'rphu_user';
            $password = getenv('DB_PASSWORD') ?: 'rphu_password123';
            $charset  = 'utf8mb4';

            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$connection = new PDO($dsn, $username, $password, $options);
            } catch (PDOException $e) {
                // If MySQL is not running yet (e.g. standalone test mode), log and throw graceful error
                error_log("Database connection error: " . $e->getMessage());
                throw $e;
            }
        }

        return self::$connection;
    }
}
