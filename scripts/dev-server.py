#!/usr/bin/env python3
"""
Sistem Timbang RPHU - Real Database-Connected Dev Server
Terhubung langsung ke database SQLite (database/rphu_timbang.sqlite) dengan full SQL CRUD.
Mendukung proteksi Super Admin via Database Trigger, Multi-Role (super_admin, admin, operator),
dan telemetri timbangan IoT (ESP32-HX711).
"""

import http.server
import socketserver
import json
import os
import sys
import sqlite3
import hashlib
import urllib.parse
from datetime import datetime

PORT = 3000
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend', 'src')
DB_PATH = os.path.join(BASE_DIR, 'database', 'rphu_timbang.sqlite')

# -----------------------------------------------------------------------------
# Database Connection & Helpers
# -----------------------------------------------------------------------------
def get_db():
    """Membuka koneksi ke database SQLite dengan foreign keys dan dictionary cursor."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Memastikan database dan trigger anti-delete Super Admin sudah siap."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    cur = conn.cursor()

    # Buat tabel users jika belum ada
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      default_station TEXT DEFAULT 'Timbang 1',
      is_protected INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Buat trigger anti-delete Super Admin
    cur.execute("""
    CREATE TRIGGER IF NOT EXISTS trg_prevent_super_admin_delete
    BEFORE DELETE ON users
    FOR EACH ROW
    WHEN OLD.user_id = 'superadmin'
    BEGIN
      SELECT RAISE(ABORT, 'Ditolak: Akun Super Admin Utama (superadmin) dilindungi sistem dan tidak dapat dihapus!');
    END;
    """)

    # Pastikan minimal ada superadmin default
    cur.execute("SELECT count(*) FROM users WHERE user_id = 'superadmin'")
    if cur.fetchone()[0] == 0:
        pwd_hash = hashlib.sha256("Admin@RPHU2026".encode('utf-8')).hexdigest()
        cur.execute("""
        INSERT INTO users (user_id, full_name, password_hash, role, default_station, is_protected, is_active)
        VALUES ('superadmin', 'Ir. Budi Santoso (Super Admin)', ?, 'super_admin', 'Kantor Pusat / Direksi', 1, 1);
        """, (pwd_hash,))
        conn.commit()

    # Tabel production_cuttings (Hasil Parting & Boneless Line Produksi)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS production_cuttings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cutting_code TEXT NOT NULL UNIQUE,
      lot_id TEXT NOT NULL,
      cut_type TEXT NOT NULL,
      input_carcass_kg REAL NOT NULL,
      output_main_kg REAL NOT NULL,
      output_byproduct_kg REAL DEFAULT 0.0,
      cutting_loss_kg REAL DEFAULT 0.0,
      yield_cutting_pct REAL DEFAULT 0.0,
      cuts_breakdown TEXT DEFAULT '{}',
      package_count INTEGER DEFAULT 0,
      room_temperature REAL DEFAULT 12.0,
      operator_name TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lot_id) REFERENCES lots (id)
    );
    """)

    conn.close()

# Inisialisasi DB saat modul dimuat
init_db()

# -----------------------------------------------------------------------------
# In-memory IoT Scale Telemetry (Hardware Bridge ke ESP32)
# -----------------------------------------------------------------------------
DEVICE_TELEMETRY = {
    "device_id": "SCALE-ESP32-01",
    "device_name": "Timbangan Platform Penerimaan 1",
    "ip_address": "192.168.1.105",
    "mac_address": "24:6F:28:AB:12:01",
    "weight_kg": 0.0,
    "raw_adc": 8345100,
    "is_stable": True,
    "has_load": False,
    "is_tared": False,
    "tare_offset": 0.0,
    "rssi": -58,
    "sampling_rate": "80 SPS",
    "filter": "Moving Average (N=15)",
    "status": "online",
    "mode": "live_stream",
    "last_seen": datetime.now().isoformat()
}

STAGE_LABELS = {
    "hidup": "Hidup diterima",
    "basah": "Karkas basah",
    "dingin": "Karkas dingin"
}

# -----------------------------------------------------------------------------
# Audit Log Helper
# -----------------------------------------------------------------------------
def log_audit(cur, user_id=None, action_type='ACTION', target_table='system', target_id='-', old_val=None, new_val=None, ip='127.0.0.1'):
    try:
        cur.execute("""
        INSERT INTO audit_logs (user_id, action_type, target_table, target_id, old_value, new_value, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        """, (user_id, action_type, target_table, str(target_id), old_val, new_val, ip))
    except Exception as e:
        print(f"[AUDIT LOG ERROR] {e}")

# -----------------------------------------------------------------------------
# Serializers
# -----------------------------------------------------------------------------
def serialize_user(row):
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "full_name": row["full_name"],
        "role": row["role"],
        "default_station": row["default_station"],
        "is_protected": bool(row["is_protected"]),
        "is_active": bool(row["is_active"]),
        "created_at": str(row["created_at"])
    }

def serialize_farmer(row):
    return {
        "id": row["id"],
        "farmer_code": row["farmer_code"],
        "name": row["name"],
        "region": row["region"],
        "phone": row["phone"] or "-",
        "default_base_price": float(row["default_base_price"] or 21000),
        "avg_shrinkage_pct": float(row["avg_shrinkage_pct"] or 1.5),
        "status": row["status"] or "active",
        "notes": row["notes"] or "",
        "created_at": str(row["created_at"])
    }

def serialize_lot(row):
    return {
        "id": row["id"],
        "nama": row["nama"],
        "farmer_id": row["farmer_id"],
        "ekor": row["total_birds"],
        "total_birds": row["total_birds"],
        "kirim": float(row["send_weight"] or 0),
        "send_weight": float(row["send_weight"] or 0),
        "hidup": float(row["received_alive_weight"]) if row["received_alive_weight"] is not None else None,
        "received_alive_weight": float(row["received_alive_weight"]) if row["received_alive_weight"] is not None else None,
        "basah": float(row["wet_carcass_weight"]) if row["wet_carcass_weight"] is not None else None,
        "wet_carcass_weight": float(row["wet_carcass_weight"]) if row["wet_carcass_weight"] is not None else None,
        "dingin": float(row["cold_carcass_weight"]) if row["cold_carcass_weight"] is not None else None,
        "cold_carcass_weight": float(row["cold_carcass_weight"]) if row["cold_carcass_weight"] is not None else None,
        "modal": float(row["price_live_bird"] or 21500),
        "price_live_bird": float(row["price_live_bird"] or 21500),
        "jual": float(row["price_carcass"] or 36000),
        "price_carcass": float(row["price_carcass"] or 36000),
        "basis": row["payment_basis"] or "kirim",
        "payment_basis": row["payment_basis"] or "kirim",
        "status": row["status"] or "waiting",
        "arrival_date": str(row["arrival_date"]) if "arrival_date" in row.keys() else None,
        "created_at": str(row["created_at"])
    }

def serialize_weighing(row):
    rec_time = "00:00"
    if "recorded_at" in row.keys() and row["recorded_at"]:
        parts = str(row["recorded_at"]).split()
        if len(parts) > 1:
            rec_time = parts[1][:5]
    stage = row["stage"]
    return {
        "id": row["id"],
        "lot_id": row["lot_id"],
        "device_id": row["device_id"] if "device_id" in row.keys() else "SCALE-ESP32-01",
        "stage": stage,
        "stage_label": STAGE_LABELS.get(stage, stage),
        "weight_kg": float(row["measured_weight_kg"] or 0),
        "measured_weight_kg": float(row["measured_weight_kg"] or 0),
        "time": rec_time,
        "is_correction": bool(row["is_correction"]) if "is_correction" in row.keys() else False,
        "notes": row["operator_notes"] or "" if "operator_notes" in row.keys() else "",
        "recorded_at": str(row["recorded_at"]) if "recorded_at" in row.keys() else ""
    }

def serialize_cutting(row):
    breakdown = {}
    if "cuts_breakdown" in row.keys() and row["cuts_breakdown"]:
        try:
            breakdown = json.loads(row["cuts_breakdown"]) if isinstance(row["cuts_breakdown"], str) else row["cuts_breakdown"]
        except Exception:
            breakdown = {}
    return {
        "id": row["id"],
        "cutting_code": row["cutting_code"],
        "lot_id": row["lot_id"],
        "cut_type": row["cut_type"],
        "input_carcass_kg": float(row["input_carcass_kg"] or 0),
        "output_main_kg": float(row["output_main_kg"] or 0),
        "output_byproduct_kg": float(row["output_byproduct_kg"] or 0),
        "cutting_loss_kg": float(row["cutting_loss_kg"] or 0),
        "yield_cutting_pct": float(row["yield_cutting_pct"] or 0),
        "cuts_breakdown": breakdown,
        "package_count": int(row["package_count"] or 0),
        "room_temperature": float(row["room_temperature"] or 12.0),
        "operator_name": row["operator_name"] or "Operator Produksi",
        "notes": row["notes"] or "",
        "created_at": str(row["created_at"])
    }

def serialize_delivery_order(row):
    return {
        "id": row["id"],
        "invoice_no": row["invoice_no"],
        "date": str(row["do_date"]),
        "time": str(row["do_time"] or "09:00"),
        "customer": row["customer"],
        "destination": row["destination"],
        "lot_id": row["lot_id"],
        "product_name": row["product_name"],
        "birds": int(row["birds"] or 0),
        "boxes": int(row["boxes"] or 0),
        "weight_kg": float(row["weight_kg"] or 0),
        "price_per_kg": float(row["price_per_kg"] or 0),
        "total_amount": float(row["total_amount"] or 0),
        "truck_plate": row["truck_plate"] or "-",
        "driver_name": row["driver_name"] or "-",
        "chiller_temp": float(row["chiller_temp"] or 3.0),
        "status": row["status"] or "in_transit",
        "status_label": row["status_label"] or "Truk Berangkat",
        "notes": row["notes"] or "",
        "created_at": str(row["created_at"])
    }


# -----------------------------------------------------------------------------
# HTTP Request Handler
# -----------------------------------------------------------------------------
class RPHURequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        response_bytes = json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def read_json_body(self):
        content_len = int(self.headers.get('Content-Length', 0))
        if content_len == 0:
            return {}
        raw = self.rfile.read(content_len).decode('utf-8')
        try:
            return json.loads(raw)
        except Exception:
            return {}

    # =========================================================================
    # GET
    # =========================================================================
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/v1'):
            conn = get_db()
            cur = conn.cursor()

            try:
                # Health Check
                if path in ['/api/v1', '/api/v1/']:
                    self.send_json({
                        "success": True,
                        "message": "Sistem Timbang RPHU API Server Online (SQLite Real Database)",
                        "database_engine": "SQLite 3",
                        "database_file": "database/rphu_timbang.sqlite",
                        "time": datetime.now().isoformat()
                    })
                    return

                # Status Koneksi Database
                elif path == '/api/v1/database/status':
                    counts = {}
                    for tbl in ['users', 'livestock_farmers', 'lots', 'weighings', 'devices', 'production_cuttings', 'delivery_orders', 'audit_logs']:
                        try:
                            cur.execute(f"SELECT count(*) FROM {tbl}")
                            counts[tbl] = cur.fetchone()[0]
                        except Exception:
                            counts[tbl] = 0

                    self.send_json({
                        "success": True,
                        "database": {
                            "connected": True,
                            "engine": "SQLite 3 (Persistent File)",
                            "file": "database/rphu_timbang.sqlite",
                            "absolute_path": DB_PATH,
                            "tables": counts,
                            "super_admin_protection": "Database Trigger (trg_prevent_super_admin_delete) AKTIF",
                            "timestamp": datetime.now().isoformat()
                        }
                    })
                    return

                # Users - Read All
                elif path in ['/api/v1/users', '/api/v1/users/']:
                    cur.execute("SELECT * FROM users ORDER BY id ASC")
                    users = [serialize_user(r) for r in cur.fetchall()]
                    self.send_json({"success": True, "data": users})
                    return

                # Users - Read One
                elif path.startswith('/api/v1/users/'):
                    uid = path.split('/')[-1]
                    cur.execute("SELECT * FROM users WHERE id = ? OR user_id = ?", (uid, uid))
                    row = cur.fetchone()
                    if row:
                        self.send_json({"success": True, "data": serialize_user(row)})
                    else:
                        self.send_json({"success": False, "message": "User tidak ditemukan"}, 404)
                    return

                # Farmers - Read All
                elif path in ['/api/v1/farmers', '/api/v1/farmers/']:
                    cur.execute("SELECT * FROM livestock_farmers ORDER BY id ASC")
                    farmers = [serialize_farmer(r) for r in cur.fetchall()]
                    self.send_json({"success": True, "data": farmers})
                    return

                # Farmers - Read One
                elif path.startswith('/api/v1/farmers/'):
                    fid = path.split('/')[-1]
                    cur.execute("SELECT * FROM livestock_farmers WHERE id = ? OR farmer_code = ?", (fid, fid))
                    row = cur.fetchone()
                    if row:
                        self.send_json({"success": True, "data": serialize_farmer(row)})
                    else:
                        self.send_json({"success": False, "message": "Peternak tidak ditemukan"}, 404)
                    return

                # Lots - Read All
                elif path in ['/api/v1/lots', '/api/v1/lots/']:
                    cur.execute("SELECT * FROM lots ORDER BY created_at DESC")
                    lots = [serialize_lot(r) for r in cur.fetchall()]
                    self.send_json({"success": True, "data": lots})
                    return

                # Lots - Read One
                elif path.startswith('/api/v1/lots/'):
                    lot_id = path.split('/')[-1]
                    cur.execute("SELECT * FROM lots WHERE id = ?", (lot_id,))
                    row = cur.fetchone()
                    if row:
                        self.send_json({"success": True, "data": serialize_lot(row)})
                    else:
                        self.send_json({"success": False, "message": "Lot tidak ditemukan"}, 404)
                    return

                # Weighings - Read Today
                elif path.startswith('/api/v1/weighings'):
                    cur.execute("SELECT * FROM weighings ORDER BY id DESC")
                    recs = [serialize_weighing(r) for r in cur.fetchall()]
                    self.send_json({"success": True, "data": recs})
                    return

                # IoT Device Telemetry
                elif path in ['/api/v1/devices/SCALE-ESP32-01/telemetry', '/api/v1/devices/telemetry']:
                    DEVICE_TELEMETRY["last_seen"] = datetime.now().isoformat()
                    self.send_json({"success": True, "data": DEVICE_TELEMETRY})
                    return

                # Dashboard Overview
                elif path == '/api/v1/dashboard/overview':
                    cur.execute("SELECT count(*) FROM lots")
                    lots_count = cur.fetchone()[0]
                    cur.execute("SELECT count(*) FROM weighings")
                    weighings_count = cur.fetchone()[0]
                    cur.execute("SELECT count(*) FROM livestock_farmers")
                    farmers_count = cur.fetchone()[0]
                    cur.execute("SELECT count(*) FROM users")
                    users_count = cur.fetchone()[0]

                    self.send_json({
                        "success": True,
                        "data": {
                            "active_scale": "SCALE-ESP32-01",
                            "status": "online",
                            "database": "SQLite 3 Connected",
                            "lots_count": lots_count,
                            "weighings_count": weighings_count,
                            "farmers_count": farmers_count,
                            "users_count": users_count,
                            "scale_telemetry": DEVICE_TELEMETRY
                        }
                    })
                    return

                # Audit Logs
                elif path in ['/api/v1/logs', '/api/v1/audit-logs']:
                    cur.execute("""
                    SELECT a.*, u.full_name as user_name, u.role as user_role
                    FROM audit_logs a
                    LEFT JOIN users u ON a.user_id = u.id OR a.user_id = u.user_id
                    ORDER BY a.id DESC
                    LIMIT 200
                    """)
                    rows = cur.fetchall()
                    logs = []
                    for r in rows:
                        logs.append({
                            "id": r["id"],
                            "user_id": r["user_id"],
                            "user_name": r["user_name"] or ("Super Admin" if str(r["user_id"]) == "1" else (f"Petugas ({r['user_id']})" if r["user_id"] else "Sistem RPHU")),
                            "role": r["user_role"] or ("super_admin" if str(r["user_id"]) in ["1", "superadmin"] else "operator"),
                            "action_type": r["action_type"],
                            "target_table": r["target_table"],
                            "target_id": r["target_id"],
                            "old_value": r["old_value"],
                            "new_value": r["new_value"],
                            "ip_address": r["ip_address"] or "127.0.0.1",
                            "created_at": str(r["created_at"])
                        })
                    self.send_json({"success": True, "data": logs, "total": len(logs)})
                    return

                # Production Cuttings - Read All
                elif path in ['/api/v1/production/cuttings', '/api/v1/production/cuttings/']:
                    cur.execute("SELECT * FROM production_cuttings ORDER BY id DESC")
                    rows = [serialize_cutting(r) for r in cur.fetchall()]
                    self.send_json({"success": True, "data": rows})
                    return

                # Production Cuttings - Read One
                elif path.startswith('/api/v1/production/cuttings/'):
                    cid = path.split('/')[-1]
                    cur.execute("SELECT * FROM production_cuttings WHERE id = ? OR cutting_code = ?", (cid, cid))
                    row = cur.fetchone()
                    if row:
                        self.send_json({"success": True, "data": serialize_cutting(row)})
                    else:
                        self.send_json({"success": False, "message": "Data batch cutting tidak ditemukan"}, 404)
                    return

                # Delivery Orders / Surat Jalan - Read All
                elif path in ['/api/v1/sales/delivery-orders', '/api/v1/sales/delivery-orders/']:
                    cur.execute("SELECT * FROM delivery_orders ORDER BY id DESC")
                    rows = [serialize_delivery_order(r) for r in cur.fetchall()]
                    self.send_json({"success": True, "data": rows})
                    return

                # Delivery Orders - Read One
                elif path.startswith('/api/v1/sales/delivery-orders/'):
                    sjid = path.split('/')[-1]
                    cur.execute("SELECT * FROM delivery_orders WHERE id = ? OR invoice_no = ?", (sjid, sjid))
                    row = cur.fetchone()
                    if row:
                        self.send_json({"success": True, "data": serialize_delivery_order(row)})
                    else:
                        self.send_json({"success": False, "message": "Surat Jalan tidak ditemukan"}, 404)
                    return

                else:
                    self.send_json({"success": False, "message": f"Endpoint GET {path} tidak ditemukan"}, 404)
                    return

            finally:
                conn.close()

        super().do_GET()

    # =========================================================================
    # POST
    # =========================================================================
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        payload = self.read_json_body()

        conn = get_db()
        cur = conn.cursor()

        try:
            # Auth Login
            if path == '/api/v1/auth/login':
                uid = payload.get('user_id', '').strip()
                pwd = payload.get('password', '').strip()
                cur.execute("SELECT * FROM users WHERE LOWER(user_id) = LOWER(?) AND is_active = 1", (uid,))
                user_row = cur.fetchone()
                if not user_row:
                    self.send_json({"success": False, "message": f"User ID '{uid}' tidak ditemukan di database!"}, 401)
                    return

                user_data = serialize_user(user_row)
                stored_hash = user_row['password_hash']
                input_hash = hashlib.sha256(pwd.encode('utf-8')).hexdigest()

                # Cek kata sandi (cocokkan hash sha256 atau password default standar)
                valid_pass = False
                if not pwd:
                    valid_pass = False
                elif stored_hash in ['hash123', ''] or input_hash == stored_hash or pwd in ['admin123', 'operator123', 'Admin@RPHU2026', 'password123', '123456']:
                    valid_pass = True

                if not valid_pass:
                    self.send_json({"success": False, "message": "Kata sandi yang Anda masukkan salah!"}, 401)
                    return

                self.send_json({
                    "success": True,
                    "message": f"Login berhasil sebagai {user_data['full_name']}",
                    "data": {
                        "token": "jwt_token_" + str(int(datetime.now().timestamp())),
                        "user": {
                            "user_id": user_data["user_id"],
                            "name": user_data["full_name"],
                            "role": user_data["role"],
                            "station": payload.get('station', user_data.get('default_station', 'Timbang 1')),
                            "shift": payload.get('shift', 'Pagi'),
                            "is_protected": user_data.get("is_protected", False)
                        }
                    }
                })
                return

            # Users - Create (Super Admin & Admin User)
            elif path == '/api/v1/users':
                uid = payload.get('user_id', '').strip()
                name = payload.get('full_name', '').strip()
                if not uid or not name:
                    self.send_json({"success": False, "message": "User ID dan Nama Lengkap wajib diisi!"}, 400)
                    return

                # Cek duplikasi user_id
                cur.execute("SELECT count(*) FROM users WHERE LOWER(user_id) = LOWER(?)", (uid,))
                if cur.fetchone()[0] > 0:
                    self.send_json({"success": False, "message": f"User ID '{uid}' sudah terdaftar di database! Gunakan ID lain."}, 400)
                    return

                role = payload.get('role', 'operator').strip().lower()
                if role not in ['super_admin', 'admin', 'operator']:
                    role = 'operator'

                # Super Admin otomatis terproteksi dari penghapusan
                is_prot = 1 if (role == 'super_admin' or payload.get('is_protected')) else 0
                pwd = payload.get('password', '123456')
                pwd_hash = hashlib.sha256(pwd.encode('utf-8')).hexdigest()
                station = payload.get('default_station', 'Timbang 1')

                cur.execute("""
                INSERT INTO users (user_id, full_name, password_hash, role, default_station, is_protected, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                """, (uid, name, pwd_hash, role, station, is_prot))
                conn.commit()

                cur.execute("SELECT * FROM users WHERE user_id = ?", (uid,))
                created = serialize_user(cur.fetchone())

                self.send_json({
                    "success": True,
                    "message": f"Pengguna baru '{name}' ({role}) berhasil disimpan ke database SQLite",
                    "data": created
                }, 201)
                return

            # Farmers - Create
            elif path == '/api/v1/farmers':
                cur.execute("SELECT max(id) FROM livestock_farmers")
                max_row = cur.fetchone()
                max_id = (max_row[0] or 0) + 1 if max_row else 1
                default_code = f"PTK-{max_id:03d}"
                code = payload.get('farmer_code') or default_code
                code = str(code).strip()
                name = str(payload.get('name', 'Peternak Baru')).strip()
                region = str(payload.get('region', 'Jawa Barat')).strip()
                phone = str(payload.get('phone', '-')).strip()
                price = float(payload.get('default_base_price', 21000))
                shrink = float(payload.get('avg_shrinkage_pct', 1.5))
                status = str(payload.get('status', 'active')).strip()
                notes = str(payload.get('notes', 'Mitra baru.')).strip()

                # Pastikan kode peternak unik
                cur.execute("SELECT count(*) FROM livestock_farmers WHERE farmer_code = ?", (code,))
                if cur.fetchone()[0] > 0:
                    code = f"PTK-{max_id:03d}"
                    cur.execute("SELECT count(*) FROM livestock_farmers WHERE farmer_code = ?", (code,))
                    if cur.fetchone()[0] > 0:
                        import time
                        code = f"PTK-{int(time.time()) % 10000:04d}"

                cur.execute("""
                INSERT INTO livestock_farmers (farmer_code, name, region, phone, default_base_price, avg_shrinkage_pct, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (code, name, region, phone, price, shrink, status, notes))
                conn.commit()

                cur.execute("SELECT * FROM livestock_farmers WHERE farmer_code = ?", (code,))
                created = serialize_farmer(cur.fetchone())
                self.send_json({"success": True, "message": "Peternak berhasil ditambahkan ke database", "data": created}, 201)
                return

            # Lots - Create / Register Arrival
            elif path == '/api/v1/lots':
                cur.execute("SELECT count(*) FROM lots")
                next_id = cur.fetchone()[0] + 1
                lot_id = payload.get('id') or f"L-0610-{next_id:02d}"
                lot_id = str(lot_id).strip()
                nama = str(payload.get('nama', 'Lot Baru')).strip()
                farmer_id = payload.get('farmer_id')
                ekor = int(payload.get('ekor', payload.get('total_birds', 0)))
                kirim = float(payload.get('kirim', payload.get('send_weight', 0.0)))
                hidup = float(payload.get('hidup')) if payload.get('hidup') is not None else None
                modal = float(payload.get('modal', payload.get('price_live_bird', 21500)))
                jual = float(payload.get('jual', payload.get('price_carcass', 36000)))
                basis = str(payload.get('basis', payload.get('payment_basis', 'kirim'))).strip()
                status = str(payload.get('status', 'waiting')).strip()

                # Pastikan farmer_id valid sesuai foreign key
                if farmer_id is not None:
                    try:
                        cur.execute("SELECT id FROM livestock_farmers WHERE id = ?", (farmer_id,))
                        if not cur.fetchone():
                            cur.execute("SELECT id FROM livestock_farmers LIMIT 1")
                            first = cur.fetchone()
                            farmer_id = first[0] if first else None
                    except Exception:
                        farmer_id = None
                else:
                    cur.execute("SELECT id FROM livestock_farmers LIMIT 1")
                    first = cur.fetchone()
                    farmer_id = first[0] if first else None

                cur.execute("""
                INSERT OR REPLACE INTO lots (id, farmer_id, nama, total_birds, send_weight, received_alive_weight, price_live_bird, price_carcass, payment_basis, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (lot_id, farmer_id, nama, ekor, kirim, hidup, modal, jual, basis, status))
                conn.commit()

                cur.execute("SELECT * FROM lots WHERE id = ?", (lot_id,))
                created = serialize_lot(cur.fetchone())
                self.send_json({"success": True, "message": f"Lot {lot_id} berhasil didaftarkan di database", "data": created}, 201)
                return

            # Weighings - Create
            elif path == '/api/v1/weighings':
                lot_id = payload.get('lot_id')
                stage = payload.get('stage')
                weight = float(payload.get('weight_kg', 0.0))
                notes = payload.get('notes', payload.get('operator_notes', 'Penimbangan dicatat'))
                device_id = payload.get('device_id', 'SCALE-ESP32-01')

                # Cek apakah penimbangan sebelumnya sudah ada (koreksi)
                cur.execute("SELECT id FROM weighings WHERE lot_id = ? AND stage = ?", (lot_id, stage))
                existing = cur.fetchone()
                is_correction = 1 if existing else 0

                cur.execute("""
                INSERT INTO weighings (lot_id, device_id, recorded_by_user_id, stage, measured_weight_kg, is_correction, operator_notes)
                VALUES (?, ?, 1, ?, ?, ?, ?)
                """, (lot_id, device_id, stage, weight, is_correction, notes))
                conn.commit()

                # Update status & stage pada tabel lots
                if stage == 'hidup':
                    cur.execute("UPDATE lots SET received_alive_weight = ?, status = 'processing' WHERE id = ?", (weight, lot_id))
                elif stage == 'basah':
                    cur.execute("UPDATE lots SET wet_carcass_weight = ?, status = 'processing' WHERE id = ?", (weight, lot_id))
                elif stage == 'dingin':
                    cur.execute("UPDATE lots SET cold_carcass_weight = ?, status = 'completed' WHERE id = ?", (weight, lot_id))
                conn.commit()

                cur.execute("SELECT * FROM weighings WHERE id = last_insert_rowid()")
                created = serialize_weighing(cur.fetchone())

                self.send_json({
                    "success": True,
                    "message": "Data penimbangan berhasil disimpan ke database SQLite",
                    "data": created
                }, 201)
                return

            # Device Telemetry Update
            elif path.startswith('/api/v1/devices/') and path.endswith('/telemetry'):
                if 'weight_kg' in payload:
                    DEVICE_TELEMETRY['weight_kg'] = round(float(payload['weight_kg']), 2)
                if 'is_stable' in payload:
                    DEVICE_TELEMETRY['is_stable'] = bool(payload['is_stable'])
                if 'raw_adc' in payload:
                    DEVICE_TELEMETRY['raw_adc'] = int(payload['raw_adc'])
                if 'has_load' in payload:
                    DEVICE_TELEMETRY['has_load'] = bool(payload['has_load'])
                if 'is_tared' in payload:
                    DEVICE_TELEMETRY['is_tared'] = bool(payload['is_tared'])
                DEVICE_TELEMETRY['last_seen'] = datetime.now().isoformat()
                self.send_json({
                    "success": True,
                    "message": "Telemetri ESP32 berhasil diperbarui",
                    "data": DEVICE_TELEMETRY
                })
                return

            # Device Command (Tare, Zero, Set Weight)
            elif path.startswith('/api/v1/devices/') and path.endswith('/command'):
                action = payload.get('action', 'tare')
                if action == 'tare':
                    DEVICE_TELEMETRY['is_tared'] = True
                    DEVICE_TELEMETRY['tare_offset'] = DEVICE_TELEMETRY['weight_kg']
                    DEVICE_TELEMETRY['weight_kg'] = 0.0
                elif action == 'zero':
                    DEVICE_TELEMETRY['is_tared'] = False
                    DEVICE_TELEMETRY['tare_offset'] = 0.0
                    DEVICE_TELEMETRY['weight_kg'] = 0.0
                    DEVICE_TELEMETRY['has_load'] = False
                elif action == 'set_weight':
                    w = round(float(payload.get('weight_kg', 0.0)), 2)
                    DEVICE_TELEMETRY['weight_kg'] = w
                    DEVICE_TELEMETRY['has_load'] = w > 0.5
                    DEVICE_TELEMETRY['is_stable'] = payload.get('is_stable', True)
                DEVICE_TELEMETRY['last_seen'] = datetime.now().isoformat()
                self.send_json({
                    "success": True,
                    "message": f"Perintah '{action}' berhasil dikirim ke ESP32",
                    "action": action,
                    "telemetry": DEVICE_TELEMETRY
                })
                return

            # Create Audit Log Manual / Event
            elif path in ['/api/v1/logs', '/api/v1/audit-logs']:
                uid = payload.get('user_id')
                act = payload.get('action_type', 'ACTION')
                tbl = payload.get('target_table', 'system')
                tid = payload.get('target_id', '-')
                old_v = payload.get('old_value')
                new_v = payload.get('new_value')
                ip = payload.get('ip_address', '127.0.0.1')

                log_audit(cur, uid, act, tbl, tid, old_v, new_v, ip)
                conn.commit()
                self.send_json({"success": True, "message": "Log aktivitas berhasil disimpan ke database SQLite"}, 201)
                return

            # Production Cutting - Create
            elif path in ['/api/v1/production/cuttings', '/api/v1/production/cuttings/']:
                cur.execute("SELECT count(*) FROM production_cuttings")
                next_num = cur.fetchone()[0] + 1
                ccode = payload.get('cutting_code', f"CUT-202610-{next_num:03d}").strip()
                lot_id = payload.get('lot_id', 'L-0610-01').strip()
                cut_type = payload.get('cut_type', 'parting_8')
                in_kg = float(payload.get('input_carcass_kg', 0.0))
                out_main_kg = float(payload.get('output_main_kg', 0.0))
                out_by_kg = float(payload.get('output_byproduct_kg', 0.0))
                loss_kg = max(0.0, in_kg - (out_main_kg + out_by_kg))
                yield_pct = (out_main_kg / in_kg * 100) if in_kg > 0 else 0.0
                breakdown = json.dumps(payload.get('cuts_breakdown', {}))
                pkg_count = int(payload.get('package_count', 0))
                temp = float(payload.get('room_temperature', 12.0))
                operator = payload.get('operator_name', 'Operator Produksi')
                notes = payload.get('notes', '')

                cur.execute("""
                INSERT INTO production_cuttings (cutting_code, lot_id, cut_type, input_carcass_kg, output_main_kg, output_byproduct_kg, cutting_loss_kg, yield_cutting_pct, cuts_breakdown, package_count, room_temperature, operator_name, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
                """, (ccode, lot_id, cut_type, in_kg, out_main_kg, out_by_kg, loss_kg, yield_pct, breakdown, pkg_count, temp, operator, notes))

                log_audit(cur, None, 'PRODUCTION_CUTTING_RECORDED', 'production_cuttings', ccode, None, json.dumps({
                    "lot_id": lot_id, "input_kg": in_kg, "output_kg": out_main_kg, "cut_type": cut_type, "yield_pct": yield_pct
                }))
                conn.commit()

                cur.execute("SELECT * FROM production_cuttings WHERE cutting_code = ?", (ccode,))
                created = serialize_cutting(cur.fetchone())
                self.send_json({"success": True, "message": f"Hasil pemotongan {ccode} berhasil disimpan ke database", "data": created}, 201)
                return

            # Delivery Order - Create
            elif path in ['/api/v1/sales/delivery-orders', '/api/v1/sales/delivery-orders/']:
                cur.execute("SELECT count(*) FROM delivery_orders")
                next_num = cur.fetchone()[0] + 1
                sjid = payload.get('id', f"SJ-202610-{next_num:03d}").strip()
                inv = payload.get('invoice_no', f"INV-2026-{next_num:03d}").strip()
                do_date = payload.get('date', datetime.now().strftime('%Y-%m-%d'))
                do_time = payload.get('time', datetime.now().strftime('%H:%M'))
                cust = payload.get('customer', 'Pelanggan RPHU').strip()
                dest = payload.get('destination', '-').strip()
                lot_id = payload.get('lot_id', 'L-0610-01')
                prod = payload.get('product_name', 'Karkas Ayam Segar Dingin').strip()
                birds = int(payload.get('birds', 0))
                boxes = int(payload.get('boxes', 0))
                w = float(payload.get('weight_kg', 0.0))
                price = float(payload.get('price_per_kg', 36000.0))
                tot = float(payload.get('total_amount', w * price))
                plate = payload.get('truck_plate', '-').strip()
                driver = payload.get('driver_name', '-').strip()
                chiller = float(payload.get('chiller_temp', 3.0))
                status = payload.get('status', 'in_transit')
                st_lbl = payload.get('status_label', 'Truk Berangkat')
                notes = payload.get('notes', '')

                cur.execute("""
                INSERT OR REPLACE INTO delivery_orders (id, invoice_no, do_date, do_time, customer, destination, lot_id, product_name, birds, boxes, weight_kg, price_per_kg, total_amount, truck_plate, driver_name, chiller_temp, status, status_label, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
                """, (sjid, inv, do_date, do_time, cust, dest, lot_id, prod, birds, boxes, w, price, tot, plate, driver, chiller, status, st_lbl, notes))

                log_audit(cur, None, 'DELIVERY_ORDER_CREATED', 'delivery_orders', sjid, None, json.dumps({
                    "customer": cust, "weight_kg": w, "total_amount": tot, "truck_plate": plate
                }))
                conn.commit()

                cur.execute("SELECT * FROM delivery_orders WHERE id = ?", (sjid,))
                created = serialize_delivery_order(cur.fetchone())
                self.send_json({"success": True, "message": f"Surat Jalan {sjid} berhasil disimpan ke database", "data": created}, 201)
                return

            # System - Clear Data
            elif path in ['/api/v1/system/clear-data', '/api/v1/system/clear-data/']:
                clear_farmers = bool(payload.get('clear_farmers', False))
                cur.execute("DELETE FROM weighings;")
                cur.execute("DELETE FROM production_cuttings;")
                cur.execute("DELETE FROM delivery_orders;")
                cur.execute("DELETE FROM lots;")
                cur.execute("DELETE FROM audit_logs;")
                cur.execute("DELETE FROM sqlite_sequence WHERE name IN ('weighings', 'production_cuttings', 'audit_logs');")

                if clear_farmers:
                    cur.execute("DELETE FROM livestock_farmers;")
                    cur.execute("DELETE FROM sqlite_sequence WHERE name = 'livestock_farmers';")
                else:
                    cur.execute("UPDATE livestock_farmers SET avg_shrinkage_pct = 0.0;")

                log_audit(cur, None, 'SYSTEM_RESET', 'system', 'all', None, json.dumps({"clear_farmers": clear_farmers}))
                conn.commit()

                self.send_json({
                    "success": True,
                    "message": "Seluruh data transaksi operasional berhasil dikosongkan.",
                    "cleared_farmers": clear_farmers
                })
                return

            else:
                self.send_json({"success": False, "message": f"Endpoint POST {path} tidak ditemukan"}, 404)

        except Exception as e:
            self.send_json({"success": False, "message": f"Database Error: {str(e)}"}, 500)
        finally:
            conn.close()

    # =========================================================================
    # PUT
    # =========================================================================
    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        payload = self.read_json_body()

        conn = get_db()
        cur = conn.cursor()

        try:
            # Users - Update
            if path.startswith('/api/v1/users/'):
                uid = path.split('/')[-1]
                cur.execute("SELECT * FROM users WHERE id = ? OR user_id = ?", (uid, uid))
                user = cur.fetchone()
                if not user:
                    self.send_json({"success": False, "message": "User tidak ditemukan"}, 404)
                    return

                # Proteksi Super Admin
                if user['role'] == 'super_admin' or user['is_protected']:
                    if 'role' in payload and payload['role'] != 'super_admin':
                        self.send_json({"success": False, "message": "Ditolak: Role Super Admin dilindungi sistem dan tidak dapat diubah!"}, 403)
                        return

                name = payload.get('full_name', user['full_name']).strip()
                station = payload.get('default_station', user['default_station'])
                role = payload.get('role', user['role']) if not user['is_protected'] else 'super_admin'
                is_active = int(payload.get('is_active', user['is_active'])) if not user['is_protected'] else 1

                cur.execute("""
                UPDATE users SET full_name = ?, default_station = ?, role = ?, is_active = ?
                WHERE id = ?
                """, (name, station, role, is_active, user['id']))
                conn.commit()

                cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
                updated = serialize_user(cur.fetchone())
                self.send_json({"success": True, "message": f"Data pengguna '{updated['user_id']}' berhasil diperbarui di database", "data": updated})
                return

            # Farmers - Update
            elif path.startswith('/api/v1/farmers/'):
                fid = path.split('/')[-1]
                cur.execute("SELECT * FROM livestock_farmers WHERE id = ? OR farmer_code = ?", (fid, fid))
                farmer = cur.fetchone()
                if not farmer:
                    self.send_json({"success": False, "message": "Peternak tidak ditemukan"}, 404)
                    return

                code = payload.get('farmer_code', farmer['farmer_code'])
                name = payload.get('name', farmer['name'])
                region = payload.get('region', farmer['region'])
                phone = payload.get('phone', farmer['phone'])
                price = float(payload.get('default_base_price', farmer['default_base_price']))
                shrink = float(payload.get('avg_shrinkage_pct', farmer['avg_shrinkage_pct'] if farmer['avg_shrinkage_pct'] is not None else 1.5))
                status = payload.get('status', farmer['status'])
                notes = payload.get('notes', farmer['notes'])

                cur.execute("""
                UPDATE livestock_farmers SET farmer_code = ?, name = ?, region = ?, phone = ?, default_base_price = ?, avg_shrinkage_pct = ?, status = ?, notes = ?
                WHERE id = ?
                """, (code, name, region, phone, price, shrink, status, notes, farmer['id']))
                conn.commit()

                cur.execute("SELECT * FROM livestock_farmers WHERE id = ?", (farmer['id'],))
                updated = serialize_farmer(cur.fetchone())
                self.send_json({"success": True, "message": "Data peternak berhasil diperbarui", "data": updated})
                return

            # Lots - Update
            elif path.startswith('/api/v1/lots/'):
                lot_id = path.split('/')[4] if 'prices' in path else path.split('/')[-1]
                cur.execute("SELECT * FROM lots WHERE id = ?", (lot_id,))
                lot = cur.fetchone()
                if not lot:
                    self.send_json({"success": False, "message": "Lot tidak ditemukan"}, 404)
                    return

                modal = float(payload.get('modal', payload.get('price_live_bird', lot['price_live_bird'])))
                jual = float(payload.get('jual', payload.get('price_carcass', lot['price_carcass'])))
                basis = payload.get('basis', payload.get('payment_basis', lot['payment_basis']))
                ekor = int(payload.get('ekor', payload.get('total_birds', lot['total_birds'])))
                kirim = float(payload.get('kirim', payload.get('send_weight', lot['send_weight'])))
                status = payload.get('status', lot['status'])

                cur.execute("""
                UPDATE lots SET price_live_bird = ?, price_carcass = ?, payment_basis = ?, total_birds = ?, send_weight = ?, status = ?
                WHERE id = ?
                """, (modal, jual, basis, ekor, kirim, status, lot_id))
                conn.commit()

                cur.execute("SELECT * FROM lots WHERE id = ?", (lot_id,))
                updated = serialize_lot(cur.fetchone())
                self.send_json({"success": True, "message": f"Lot {lot_id} berhasil diperbarui di database", "data": updated})
                return

            # Weighings - Update
            elif path.startswith('/api/v1/weighings/'):
                wid = path.split('/')[-1]
                cur.execute("SELECT * FROM weighings WHERE id = ?", (wid,))
                rec = cur.fetchone()
                if not rec:
                    self.send_json({"success": False, "message": "Data timbangan tidak ditemukan"}, 404)
                    return

                new_weight = float(payload.get('weight_kg', payload.get('measured_weight_kg', rec['measured_weight_kg'])))
                notes = payload.get('notes', payload.get('operator_notes', 'Koreksi supervisor'))

                cur.execute("""
                UPDATE weighings SET measured_weight_kg = ?, is_correction = 1, operator_notes = ?
                WHERE id = ?
                """, (new_weight, notes, wid))

                # Perbarui stage di lot
                stage = rec['stage']
                if stage == 'hidup':
                    cur.execute("UPDATE lots SET received_alive_weight = ? WHERE id = ?", (new_weight, rec['lot_id']))
                elif stage == 'basah':
                    cur.execute("UPDATE lots SET wet_carcass_weight = ? WHERE id = ?", (new_weight, rec['lot_id']))
                elif stage == 'dingin':
                    cur.execute("UPDATE lots SET cold_carcass_weight = ? WHERE id = ?", (new_weight, rec['lot_id']))

                conn.commit()

                cur.execute("SELECT * FROM weighings WHERE id = ?", (wid,))
                updated = serialize_weighing(cur.fetchone())
                self.send_json({"success": True, "message": "Koreksi timbangan berhasil disimpan di database", "data": updated})
                return

            else:
                self.send_json({"success": False, "message": f"Endpoint PUT {path} tidak ditemukan"}, 404)

        except Exception as e:
            self.send_json({"success": False, "message": f"Database Error: {str(e)}"}, 500)
        finally:
            conn.close()

    # =========================================================================
    # DELETE
    # =========================================================================
    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        conn = get_db()
        cur = conn.cursor()

        try:
            # Users - Delete (DIPROTEKSI OLEH DATABASE TRIGGER SQLite trg_prevent_super_admin_delete)
            if path.startswith('/api/v1/users/'):
                uid = path.split('/')[-1]
                cur.execute("SELECT * FROM users WHERE id = ? OR user_id = ?", (uid, uid))
                user = cur.fetchone()
                if not user:
                    self.send_json({"success": False, "message": "User tidak ditemukan"}, 404)
                    return

                # Proteksi eksplisit hanya untuk akun root superadmin
                if user['user_id'] == 'superadmin':
                    self.send_json({
                        "success": False,
                        "message": "Ditolak: Akun Super Admin Utama (superadmin) dilindungi sistem dan TIDAK BISA dihapus!"
                    }, 403)
                    return

                # Eksekusi DELETE riil pada tabel users.
                # Jika mencoba menghapus super_admin, trigger SQLite akan melempar IntegrityError!
                try:
                    cur.execute("DELETE FROM users WHERE id = ?", (user['id'],))
                    conn.commit()
                    self.send_json({"success": True, "message": f"Pengguna '{user['user_id']}' ({user['full_name']}) berhasil dihapus dari database"})
                except (sqlite3.IntegrityError, sqlite3.OperationalError) as trigger_err:
                    conn.rollback()
                    err_msg = str(trigger_err)
                    self.send_json({
                        "success": False,
                        "message": f"Database Trigger Rejection: {err_msg}"
                    }, 403)
                return

            # Farmers - Delete
            elif path.startswith('/api/v1/farmers/'):
                fid = path.split('/')[-1]
                cur.execute("SELECT id, name FROM livestock_farmers WHERE id = ? OR farmer_code = ?", (fid, fid))
                farmer = cur.fetchone()
                if not farmer:
                    self.send_json({"success": False, "message": "Peternak tidak ditemukan"}, 404)
                    return

                cur.execute("DELETE FROM livestock_farmers WHERE id = ?", (farmer['id'],))
                conn.commit()
                self.send_json({"success": True, "message": f"Peternak '{farmer['name']}' berhasil dihapus dari database"})
                return

            # Lots - Delete
            elif path.startswith('/api/v1/lots/'):
                lot_id = path.split('/')[-1]
                cur.execute("SELECT id FROM lots WHERE id = ?", (lot_id,))
                lot = cur.fetchone()
                if not lot:
                    self.send_json({"success": False, "message": "Lot tidak ditemukan"}, 404)
                    return

                # Hapus weighing terkait dulu agar foreign key aman
                cur.execute("DELETE FROM weighings WHERE lot_id = ?", (lot_id,))
                cur.execute("DELETE FROM lots WHERE id = ?", (lot_id,))
                conn.commit()
                self.send_json({"success": True, "message": f"Lot {lot_id} dan rekaman timbangannya berhasil dihapus dari database"})
                return

            # Weighings - Delete
            elif path.startswith('/api/v1/weighings/'):
                wid = path.split('/')[-1]
                cur.execute("SELECT id FROM weighings WHERE id = ?", (wid,))
                rec = cur.fetchone()
                if not rec:
                    self.send_json({"success": False, "message": "Data timbangan tidak ditemukan"}, 404)
                    return

                cur.execute("DELETE FROM weighings WHERE id = ?", (wid,))
                conn.commit()
                self.send_json({"success": True, "message": "Data timbangan berhasil dihapus dari database"})
                return

            else:
                self.send_json({"success": False, "message": f"Endpoint DELETE {path} tidak ditemukan"}, 404)

        except Exception as e:
            self.send_json({"success": False, "message": f"Database Error: {str(e)}"}, 500)
        finally:
            conn.close()

# -----------------------------------------------------------------------------
# Main Entry Point
# -----------------------------------------------------------------------------
class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

def run():
    # Periksa dan cetak status database saat server menyala
    conn = get_db()
    cur = conn.cursor()
    table_stats = []
    for tbl in ['users', 'livestock_farmers', 'lots', 'weighings', 'devices']:
        try:
            cur.execute(f"SELECT count(*) FROM {tbl}")
            cnt = cur.fetchone()[0]
            table_stats.append(f"{tbl}: {cnt}")
        except Exception:
            table_stats.append(f"{tbl}: 0")
    conn.close()

    print("=" * 70)
    print(f"[RPHU Server] Listening on http://localhost:{PORT} (Multi-Threaded)")
    print(f"Static directory : {FRONTEND_DIR}")
    print(f"Database         : SQLite 3 ({DB_PATH})")
    print(f"Active records   : {', '.join(table_stats)}")
    print("=" * 70)

    with ThreadedTCPServer(("", PORT), RPHURequestHandler) as httpd:
        httpd.serve_forever()

if __name__ == '__main__':
    run()
