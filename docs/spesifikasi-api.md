# 📡 Spesifikasi Antarmuka Pemrograman Aplikasi (REST API)

Semua endpoint berbasis protokol HTTP/HTTPS dengan format pertukaran data JSON (`application/json`). Format standar response:

```json
{
  "success": true,
  "status_code": 200,
  "message": "Deskripsi respon sukses",
  "data": { ... },
  "meta": { "timestamp": 1791787200 }
}
```

---

## 1. Modul Autentikasi (`/api/v1/auth`)

### `POST /api/v1/auth/login`
Autentikasi operator timbang atau supervisor.
- **Request Body**:
```json
{
  "user_id": "petugas_01",
  "password": "password123",
  "station": "Timbang truk",
  "shift": "Pagi"
}
```
- **Response Success (200)**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": 1,
      "user_id": "petugas_01",
      "name": "Ahmad Fauzi",
      "role": "operator",
      "station": "Timbang truk",
      "shift": "Pagi"
    }
  }
}
```

---

## 2. Modul Data Lot (`/api/v1/lots`)

### `GET /api/v1/lots`
Mengambil daftar seluruh lot penerimaan ayam hari ini lengkap dengan metrik kalkulasi susut dan margin.
- **Query Params**: `date=YYYY-MM-DD`, `status=active|completed`
- **Response Success (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "L-0610-01",
      "farmer_name": "Pak Sumarno (Karawang)",
      "total_birds": 2400,
      "send_weight": 4920.0,
      "received_alive_weight": 4841.0,
      "wet_carcass_weight": 3402.0,
      "cold_carcass_weight": 3438.0,
      "price_live_bird": 21500,
      "price_carcass": 36000,
      "payment_basis": "kirim",
      "transit_shrinkage_pct": 1.61,
      "transit_shrinkage_kg": 79.0,
      "chilling_shrinkage_pct": -1.06,
      "total_shrinkage_pct": 30.12,
      "carcass_yield_pct": 71.02,
      "financial": {
        "cost_total": 105780000,
        "revenue_total": 123768000,
        "loss_transit": 1698500,
        "loss_chilling": 0,
        "loss_total_shrink": 1698500,
        "gross_profit": 17988000
      }
    }
  ]
}
```

### `POST /api/v1/lots`
Membuat lot penerimaan ayam baru.

---

## 3. Modul Penimbangan (`/api/v1/weighings`)

### `POST /api/v1/weighings`
Merekam hasil timbangan yang telah diverifikasi operator.
- **Request Body**:
```json
{
  "lot_id": "L-0610-01",
  "stage": "hidup",
  "weight_kg": 4841.5,
  "device_id": "SCALE-ESP32-01",
  "notes": "Penimbangan 12 keranjang kloter 1"
}
```
- **Response Success (201)**:
```json
{
  "success": true,
  "message": "Data penimbangan berhasil dicatat",
  "data": {
    "weighing_id": 104,
    "lot_id": "L-0610-01",
    "stage": "hidup",
    "weight_kg": 4841.5,
    "is_correction": false,
    "created_at": "2026-10-12T13:40:00+07:00"
  }
}
```

---

## 4. Modul Perangkat IoT (`/api/v1/devices`)

### `GET /api/v1/devices/{device_id}/live`
Mengambil bacaan sensor beban realtime dari antrian cache MQTT.
- **Response Success (200)**:
```json
{
  "success": true,
  "data": {
    "device_id": "SCALE-ESP32-01",
    "weight_kg": 4841.5,
    "is_stable": true,
    "status": "online",
    "last_seen": "2026-10-12T13:40:12+07:00"
  }
}
```

### `POST /api/v1/devices/{device_id}/command`
Mengirim perintah TARE atau ZERO ke perangkat via MQTT.
- **Request Body**: `{"action": "tare"}`
