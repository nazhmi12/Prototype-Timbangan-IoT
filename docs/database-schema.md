# 🗄️ Skema Database & Relasi Entitas (ERD)

Database menggunakan mesin MySQL 8.0 / MariaDB 10.11 dengan collation `utf8mb4_unicode_ci` dan engine `InnoDB` untuk mendukung transaksi ACID.

---

## 1. Diagram Relasi Entitas (ERD)

```mermaid
erDiagram
    USERS ||--o{ AUDIT_LOGS : performs
    USERS ||--o{ WEIGHINGS : records
    LOTS ||--o{ WEIGHINGS : contains
    DEVICES ||--o{ WEIGHINGS : originates_from
    LIVESTOCK_FARMERS ||--o{ LOTS : supplies

    USERS {
        int id PK
        string user_id UK
        string full_name
        string password_hash
        string role
        string default_station
        boolean is_active
        datetime created_at
    }

    LIVESTOCK_FARMERS {
        int id PK
        string farmer_code UK
        string name
        string region
        string phone
        decimal default_base_price
    }

    LOTS {
        string id PK
        int farmer_id FK
        int total_birds
        decimal send_weight_kg
        decimal received_alive_weight_kg
        decimal wet_carcass_weight_kg
        decimal cold_carcass_weight_kg
        decimal price_live_per_kg
        decimal price_carcass_per_kg
        enum payment_basis
        enum status
        date arrival_date
        datetime created_at
        datetime updated_at
    }

    DEVICES {
        string id PK
        string device_name
        string station_name
        string ip_address
        string mac_address
        decimal calibration_factor
        datetime last_heartbeat
        boolean is_online
    }

    WEIGHINGS {
        bigint id PK
        string lot_id FK
        string device_id FK
        int recorded_by_user_id FK
        enum stage
        decimal measured_weight_kg
        decimal raw_adc_value
        boolean is_stable
        boolean is_correction
        text operator_notes
        datetime recorded_at
    }

    AUDIT_LOGS {
        bigint id PK
        int user_id FK
        string action_type
        string target_table
        string target_id
        json old_value
        json new_value
        string ip_address
        datetime created_at
    }
```

---

## 2. Kamus Data & Integritas Relasional

### A. Tabel `lots`
Menyimpan entitas batch kedatangan unggas per pengiriman truk/kandang.
- `id` (VARCHAR 32, PRIMARY KEY): Kode unik lot, contoh: `L-0610-01`.
- `send_weight_kg` (DECIMAL 10,2): Berat timbang di kandang asal.
- `received_alive_weight_kg` (DECIMAL 10,2): Berat saat ayam hidup tiba di RPHU.
- `wet_carcass_weight_kg` (DECIMAL 10,2): Berat karkas setelah pencabutan bulu & pengeluaran jeroan.
- `cold_carcass_weight_kg` (DECIMAL 10,2): Berat karkas akhir setelah keluar dari bak chilling / cold storage.
- `payment_basis` (ENUM): `'kirim'` (bayar berbasis berat kandang) atau `'terima'` (bayar berbasis berat tiba).

### B. Tabel `weighings`
Menyimpan riwayat transaksi pembacaan sensor timbangan. Tabel ini bersifat **Append-Only** (hanya `INSERT`, tidak ada `DELETE`).
- `stage` (ENUM): `'hidup'`, `'basah'`, `'dingin'`.
- `is_correction` (BOOLEAN): Bernilai `1` jika data dicatat untuk merevisi bacaan sebelumnya pada tahap yang sama.

### C. Tabel `audit_logs`
Merekam jejak audit keamanan seluruh aksi operator, login, dan modifikasi data harga atau status lot.
