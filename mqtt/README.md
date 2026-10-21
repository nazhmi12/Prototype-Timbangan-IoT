# 🛰️ Mosquitto MQTT Broker Setup

Konfigurasi broker telemetri untuk komunikasi antara timbangan ESP32 dan Backend/Frontend.

## Port Telemetri:
- **Port 1883**: Protokol standar MQTT (TCP) untuk mikrokontroler ESP32.
- **Port 9001**: WebSocket bridge untuk koneksi realtime langsung ke frontend browser (opsional).

## Topik MQTT:
- `rphu/scale/{device_id}/weight`: Publish data bobot realtime dari ESP32 (QoS 1).
- `rphu/scale/{device_id}/status`: Heartbeat & status online perangkat.
- `rphu/scale/{device_id}/command`: Perintah kendali dari backend/web (`tare`, `zero`, `calibrate`).
