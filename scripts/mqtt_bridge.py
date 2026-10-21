#!/usr/bin/env python3
"""
MQTT Bridge Worker - Sistem Timbang RPHU
Menghubungkan data telemetri timbangan ESP32 ke REST API Backend.
"""

import sys
import os
import json
import time
import logging
import urllib.request
import urllib.error

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("mqtt_bridge")

BROKER_HOST = os.getenv("MQTT_HOST", "broker.emqx.io")
BROKER_PORT = int(os.getenv("MQTT_PORT", 1883))
TOPIC_WEIGHT = os.getenv("MQTT_TOPIC", "timbangan/automation")
BACKEND_URL = os.getenv("BACKEND_TELEMETRY_URL", "http://localhost:8000/api/v1/devices/SCALE-ESP32-01/telemetry")

def forward_telemetry(weight_kg: float, is_stable: bool = True):
    payload = json.dumps({
        "device_id": "SCALE-ESP32-01",
        "weight_kg": round(weight_kg, 2),
        "is_stable": is_stable,
        "source": "mqtt_bridge"
    }).encode("utf-8")

    req = urllib.request.Request(
        BACKEND_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status != 200:
                logger.warning(f"Backend response status: {resp.status}")
    except Exception as e:
        # Backend mungkin belum start atau offline
        logger.debug(f"Gagal push ke backend: {e}")

def main():
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        logger.info("Modul 'paho-mqtt' belum terpasang.")
        logger.info("Catatan: Web dashboard sudah terhubung langsung via WebSocket di browser.")
        logger.info("Jika ingin menjalankan bridge latar belakang: pip install paho-mqtt")
        return

    logger.info(f"Menghubungkan ke broker {BROKER_HOST}:{BROKER_PORT}...")
    logger.info(f"Topik aktif: {TOPIC_WEIGHT}")

    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            logger.info("Koneksi broker MQTT berhasil.")
            client.subscribe(TOPIC_WEIGHT)
            logger.info(f"Subscribe topik '{TOPIC_WEIGHT}' aktif.")
        else:
            logger.error(f"Koneksi broker gagal dengan kode: {rc}")

    def on_message(client, userdata, msg):
        raw = msg.payload.decode("utf-8", errors="ignore").strip()
        if not raw:
            return

        try:
            if raw.startswith("{"):
                data = json.loads(raw)
                weight = float(data.get("weight_kg", data.get("weight", 0)))
                is_stable = bool(data.get("is_stable", True))
            else:
                weight = float(raw)
                is_stable = True

            logger.info(f"Telemetri masuk: {weight:.2f} kg (stabil={is_stable})")
            forward_telemetry(weight, is_stable)
        except Exception as err:
            logger.warning(f"Format payload tidak valid '{raw}': {err}")

    client_id = f"rphu-bridge-{int(time.time())}"
    client = mqtt.Client(client_id=client_id)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
        client.loop_forever()
    except KeyboardInterrupt:
        logger.info("Worker dihentikan oleh pengguna.")
    except Exception as e:
        logger.error(f"Error pada loop MQTT: {e}")

if __name__ == "__main__":
    main()
