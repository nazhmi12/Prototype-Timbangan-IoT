/**
 * Weighing Workstation Simulator & Hardware Controller
 */

const WeighingEngine = {
  currentWeight: 0.0,
  pendingWeight: null,
  isStable: false,
  isTared: false,
  isNet: false,
  stage: "hidup",
  mode: "stream", // "stream" (Live Hardware Telemetry) or "simulation" (Manual)
  simulationInterval: null,
  streamPollTimer: null,
  lastBeepedStableWeight: null,
  // Live MQTT Settings (EMQX Public Broker)
  mqttClient: null,
  mqttConnected: false,
  mqttBrokerHost: "broker.emqx.io",
  mqttTopic: "timbangan/automation",
  mqttCommandTopic: "timbangan/command",
  lastBackendSync: 0,

  init() {
    this.bindEvents();
    this.checkUrlParams();
    this.renderHistory();
    this.startTelemetryStream();
    this.initMqtt();
    this.updateLotSummaryCard();
  },

  checkUrlParams() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramLot = urlParams.get('lot');
      const paramStage = urlParams.get('stage');

      if (paramLot) {
        LotStore.select(paramLot);
        const selLot = document.getElementById('lot');
        if (selLot) selLot.value = paramLot;
      }

      if (paramStage && ['hidup', 'basah', 'dingin'].includes(paramStage)) {
        this.stage = paramStage;
        const selStage = document.getElementById('stage');
        if (selStage) selStage.value = paramStage;
      }
    } catch (e) {}
  },

  bindEvents() {
    const btnRead = document.getElementById('btnRead');
    const btnSave = document.getElementById('btnSave');
    const btnTare = document.getElementById('btnTare');
    const btnZero = document.getElementById('btnZero');
    const selStage = document.getElementById('stage');
    const selLot = document.getElementById('lot');

    if (btnRead) btnRead.addEventListener('click', () => this.readScale());
    if (btnSave) btnSave.addEventListener('click', () => this.saveWeight());
    if (btnTare) btnTare.addEventListener('click', () => this.tare());
    if (btnZero) btnZero.addEventListener('click', () => this.zero());

    // Mode Toggle (Stream vs Simulation)
    const btnModeStream = document.getElementById('btnModeStream');
    const btnModeSim = document.getElementById('btnModeSim');
    if (btnModeStream) btnModeStream.addEventListener('click', () => this.setMode('stream'));
    if (btnModeSim) btnModeSim.addEventListener('click', () => this.setMode('simulation'));

    // Hardware Panel Drawer & Testing
    const btnOpenHw = document.getElementById('btnOpenHwPanel');
    if (btnOpenHw) btnOpenHw.addEventListener('click', () => this.openHardwarePanel());

    const btnPushCustom = document.getElementById('btnPushCustomWeight');
    if (btnPushCustom) {
      btnPushCustom.addEventListener('click', () => {
        const inp = document.getElementById('hwCustomWeight');
        const val = parseFloat(inp ? inp.value : 0);
        if (isNaN(val) || val < 0) {
          App.toast('Masukkan angka bobot yang valid!', 'warning');
          return;
        }
        this.sendHardwareLoad(val, true, 'Kustom Sensor');
        this.closeModals();
      });
    }

    if (selStage) {
      selStage.addEventListener('change', (e) => {
        this.stage = e.target.value;
        this.resetRead();
      });
    }

    if (selLot) {
      selLot.addEventListener('change', (e) => {
        LotStore.select(e.target.value);
        this.resetRead();
        this.updateLotSummaryCard();
        window.dispatchEvent(new CustomEvent('lot-selected', { detail: e.target.value }));
      });
    }

    // Lot & Weighing CRUD Modal events
    const btnOpenAddLot = document.getElementById('btnOpenAddLot');
    if (btnOpenAddLot) btnOpenAddLot.addEventListener('click', () => this.openAddLotModal());

    const formAddLot = document.getElementById('formAddLot');
    if (formAddLot) formAddLot.addEventListener('submit', (e) => { e.preventDefault(); this.handleAddLot(); });

    const formEditLot = document.getElementById('formEditLot');
    if (formEditLot) formEditLot.addEventListener('submit', (e) => { e.preventDefault(); this.handleEditLot(); });

    const btnConfirmDeleteLot = document.getElementById('btnConfirmDeleteLot');
    if (btnConfirmDeleteLot) btnConfirmDeleteLot.addEventListener('click', () => this.executeDeleteLot());

    const formCorrect = document.getElementById('formCorrectWeighing');
    if (formCorrect) formCorrect.addEventListener('submit', (e) => { e.preventDefault(); this.handleCorrectWeighing(); });

    const btnConfirmDeleteWeighing = document.getElementById('btnConfirmDeleteWeighing');
    if (btnConfirmDeleteWeighing) btnConfirmDeleteWeighing.addEventListener('click', () => this.executeDeleteWeighing());

    // Modal close listeners
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModals();
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModals();
    });
  },

  setMode(newMode) {
    this.mode = newMode;
    const btnStream = document.getElementById('btnModeStream');
    const btnSim = document.getElementById('btnModeSim');
    const btnRead = document.getElementById('btnRead');

    if (btnStream && btnSim) {
      btnStream.classList.toggle('active', newMode === 'stream');
      btnSim.classList.toggle('active', newMode === 'simulation');
    }

    if (btnRead) {
      btnRead.textContent = newMode === 'stream' ? 'Tangkap Nilai Stabil' : 'Ambil Nilai Timbangan';
    }

    if (newMode === 'stream') {
      App.toast('Mode Live Telemetri ESP32 aktif. Menampilkan sinyal langsung dari timbangan.', 'info');
    } else {
      App.toast('Mode Simulasi aktif. Menggunakan generator sinyal internal.', 'info');
      this.resetRead();
    }
  },

  startTelemetryStream() {
    if (this.streamPollTimer) clearInterval(this.streamPollTimer);
    this.streamPollTimer = setInterval(() => this.pollTelemetry(), 350);
  },

  async pollTelemetry() {
    try {
      const res = await Api.get('/devices/SCALE-ESP32-01/telemetry');
      if (res && res.success && res.data) {
        const d = res.data;
        const dot = document.getElementById('dotNodeStatus');
        if (dot && !this.mqttConnected) dot.style.backgroundColor = 'var(--green)';

        if (this.mode === 'stream' && !this.mqttConnected) {
          this.applyTelemetry(d);
        }
      }
    } catch (e) {
      if (!this.mqttConnected) {
        const dot = document.getElementById('dotNodeStatus');
        if (dot) dot.style.backgroundColor = 'var(--red)';
      }
    }
  },

  initMqtt() {
    if (typeof Paho === 'undefined' || !Paho.MQTT) {
      console.warn('[MQTT] Paho MQTT client library not loaded, falling back to HTTP telemetry polling.');
      return;
    }

    try {
      const host = this.mqttBrokerHost;
      const isHttps = window.location.protocol === 'https:';
      const port = isHttps ? 8084 : 8083;
      const path = '/mqtt';
      const clientId = 'web-rphu-' + Math.random().toString(16).substring(2, 8);

      console.log(`[MQTT] Menghubungkan ke ${host}:${port}${path}...`);
      this.updateMqttStatus(false, `Menghubungkan ke ${host}...`);

      this.mqttClient = new Paho.MQTT.Client(host, Number(port), path, clientId);

      this.mqttClient.onConnectionLost = (responseObject) => {
        this.mqttConnected = false;
        console.warn('[MQTT] Koneksi terputus:', responseObject.errorMessage);
        this.updateMqttStatus(false, 'Terputus dari broker.emqx.io, mencoba ulang...');
        setTimeout(() => this.initMqtt(), 4000);
      };

      this.mqttClient.onMessageArrived = (message) => {
        this.handleMqttMessage(message);
      };

      const options = {
        timeout: 5,
        useSSL: isHttps,
        keepAliveInterval: 30,
        cleanSession: true,
        onSuccess: () => {
          this.mqttConnected = true;
          console.log(`[MQTT] Terhubung ke ${host}! Subscribing ke '${this.mqttTopic}'...`);
          this.mqttClient.subscribe(this.mqttTopic, { qos: 0 });
          this.updateMqttStatus(true);
          App.toast(`Tersambung ke MQTT Live (${host})! Menunggu data sensor...`, 'info');
        },
        onFailure: (err) => {
          this.mqttConnected = false;
          console.warn('[MQTT] Gagal konek:', err.errorMessage || err);
          // Jika port 8083 gagal dan non-https, coba port 8084
          if (!isHttps && port === 8083) {
            this.retryMqttWithPort(8084, true);
          } else {
            this.updateMqttStatus(false, 'Koneksi MQTT gagal. Fallback HTTP Telemetry.');
            setTimeout(() => this.initMqtt(), 8000);
          }
        }
      };

      this.mqttClient.connect(options);
    } catch (err) {
      console.error('[MQTT] Exception in initMqtt:', err);
    }
  },

  retryMqttWithPort(port, useSSL) {
    try {
      const host = this.mqttBrokerHost;
      const clientId = 'web-rphu-' + Math.random().toString(16).substring(2, 8);
      this.mqttClient = new Paho.MQTT.Client(host, Number(port), '/mqtt', clientId);
      this.mqttClient.onConnectionLost = () => { this.mqttConnected = false; };
      this.mqttClient.onMessageArrived = (msg) => this.handleMqttMessage(msg);

      this.mqttClient.connect({
        timeout: 5,
        useSSL: useSSL,
        cleanSession: true,
        onSuccess: () => {
          this.mqttConnected = true;
          this.mqttClient.subscribe(this.mqttTopic, { qos: 0 });
          this.updateMqttStatus(true);
          App.toast(`Tersambung ke MQTT Live (${host}:${port})!`, 'info');
        },
        onFailure: () => {
          this.mqttConnected = false;
          this.updateMqttStatus(false, 'Koneksi MQTT gagal. Mode HTTP Telemetri aktif.');
        }
      });
    } catch (e) {}
  },

  handleMqttMessage(message) {
    const topic = message.destinationName || '';
    const payloadStr = (message.payloadString || '').trim();
    if (!payloadStr) return;

    let weight = 0.0;
    let isStable = true;
    let isTared = this.isTared;

    // Deteksi format payload: bisa JSON {"weight_kg": 15.2} atau raw float "15.20"
    if (payloadStr.startsWith('{')) {
      try {
        const json = JSON.parse(payloadStr);
        weight = parseFloat(json.weight_kg !== undefined ? json.weight_kg : (json.weight !== undefined ? json.weight : 0.0));
        if (json.is_stable !== undefined) isStable = Boolean(json.is_stable);
        if (json.is_tared !== undefined) isTared = Boolean(json.is_tared);
      } catch (e) {
        weight = parseFloat(payloadStr) || 0.0;
      }
    } else {
      // Format langsung dari Arduino Wokwi: e.g. "12.50"
      weight = parseFloat(payloadStr);
      if (isNaN(weight)) weight = 0.0;
      // Angka dari Wokwi sudah melewati filter scale.get_units(10)
      isStable = true;
    }

    if (this.mode === 'stream') {
      this.applyTelemetry({
        weight_kg: weight,
        is_stable: isStable,
        is_tared: isTared,
        source: 'mqtt-live'
      });
    }

    // Sync ke database backend (throttled tiap 1.5 detik)
    this.syncTelemetryToBackend(weight, isStable, isTared);
  },

  updateMqttStatus(connected, text) {
    const info = document.getElementById('scaleTerminalNodeInfo');
    if (info) {
      if (connected) {
        info.textContent = `broker.emqx.io / ${this.mqttTopic}`;
        info.style.color = 'var(--ink)';
      } else {
        info.textContent = text || 'Menghubungkan ke broker...';
        info.style.color = '#94a3b8';
      }
    }
    const dot = document.getElementById('dotNodeStatus');
    if (dot) dot.style.backgroundColor = connected ? 'var(--green)' : 'var(--amber)';
  },

  publishMqttCommand(action) {
    if (!this.mqttClient || !this.mqttConnected) return;
    try {
      const msg = new Paho.MQTT.Message(action);
      msg.destinationName = this.mqttCommandTopic;
      this.mqttClient.send(msg);
      console.log(`[MQTT] Perintah '${action}' dipublish ke '${this.mqttCommandTopic}'`);
    } catch (e) {
      console.warn('[MQTT] Gagal kirim perintah:', e);
    }
  },

  syncTelemetryToBackend(weight, isStable, isTared) {
    const now = Date.now();
    if (now - this.lastBackendSync < 1500) return;
    this.lastBackendSync = now;

    Api.post('/devices/SCALE-ESP32-01/telemetry', {
      weight_kg: weight,
      is_stable: isStable,
      is_tared: isTared
    }).catch(() => {});
  },

  applyTelemetry(t) {
    const lot = LotStore.getSelected();
    const st = this.stage;
    const w = parseFloat(t.weight_kg) || 0.0;
    this.currentWeight = w;
    this.isStable = Boolean(t.is_stable);
    this.isTared = Boolean(t.is_tared);

    const numberEl = document.getElementById('readNumber');
    const infoEl = document.getElementById('readInfo');
    const progressEl = document.getElementById('stabilityProgress');
    const btnSave = document.getElementById('btnSave');

    if (numberEl) {
      numberEl.textContent = LotStore.f(w, 1);
      if (!t.is_stable && w > 0) {
        numberEl.classList.add('measuring');
      } else {
        numberEl.classList.remove('measuring');
      }
    }

    if (progressEl) {
      progressEl.style.width = t.is_stable ? '100%' : (w > 0 ? '60%' : '0%');
    }

    if (w <= 0.0) {
      if (infoEl) infoEl.textContent = 'Platform timbangan siap · Beban kosong (0.0 kg). Tunggu ayam dimuat.';
      this.pendingWeight = null;
      if (btnSave) btnSave.disabled = true;
      this.updateBadges(t.is_stable, t.is_tared, false);
      return;
    }

    this.pendingWeight = w;

    if (!t.is_stable) {
      if (infoEl) infoEl.textContent = 'Menstabilkan getaran beban ayam... (Moving average N=15)';
      if (btnSave) btnSave.disabled = true;
      this.updateBadges(false, t.is_tared, true);
    } else {
      const prev = lot ? this.getPreviousWeight(lot, st) : null;
      const diffText = prev ? this.formatDifference(prev, w, st) : '';
      const jam = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      if (infoEl) infoEl.textContent = `Stabil dari ESP32 · ${jam} ${diffText ? '· ' + diffText : ''}`;

      this.updateBadges(true, t.is_tared, true);
      if (btnSave) btnSave.disabled = false;

      // Play chime once per unique stable weight
      if (this.lastBeepedStableWeight !== w) {
        this.lastBeepedStableWeight = w;
        Auth.beep(980, 0.12, 'triangle');
      }
    }
  },

  openHardwarePanel() {
    const modal = document.getElementById('modalHardwareControl');
    if (modal) modal.classList.add('open');
  },

  async sendHardwareLoad(weight, isStable = true, label = '') {
    try {
      await Api.post('/devices/SCALE-ESP32-01/command', {
        action: 'set_weight',
        weight_kg: weight,
        is_stable: isStable
      });
      App.toast(`Beban sensor ${weight} kg (${label}) dikirim ke ESP32!`, 'info');
      Auth.beep(520, 0.08, 'sine');
    } catch (e) {}
  },

  async sendHardwareLoadForCurrentLot() {
    const lot = LotStore.getSelected();
    const st = this.stage;
    let target = 0;

    if (!lot) {
      App.toast('Pilih lot terlebih dahulu sebelum membaca beban timbangan!', 'warning');
      return;
    }

    const kirim = parseFloat(lot.kirim) || 5000;
    if (st === "hidup") {
      target = kirim * (1 - (0.012 + Math.random() * 0.018));
    } else if (st === "basah") {
      const base = lot.hidup || (kirim * 0.985);
      target = base * (0.69 + Math.random() * 0.025);
    } else {
      const base = lot.basah || (kirim * 0.68);
      target = base * (0.992 + Math.random() * 0.018);
    }
    target = Math.round(target);

    const checkVibe = document.getElementById('hwCheckVibrations');
    const simulateVibrations = checkVibe ? checkVibe.checked : true;

    this.closeModals();

    if (!simulateVibrations) {
      await this.sendHardwareLoad(target, true, `Tahap ${st}`);
      return;
    }

    // Simulate 8 rapid vibration telemetry packets over 1.6s
    App.toast(`Mengirim beban ${target} kg dengan simulasi kepakan sayap ke ESP32...`, 'info');
    let step = 0;
    const maxSteps = 8;
    const interval = setInterval(async () => {
      step++;
      const jitter = (Math.random() - 0.5) * (target * 0.02) * ((maxSteps - step) / maxSteps);
      const cur = Math.round(target + jitter);
      await this.sendHardwareLoad(cur, false, `Filter step ${step}/${maxSteps}`);

      if (step >= maxSteps) {
        clearInterval(interval);
        setTimeout(async () => {
          await this.sendHardwareLoad(target, true, 'Stabil Akhir');
          App.toast(`Sensor ESP32 stabil pada ${target} kg!`, 'success');
        }, 150);
      }
    }, 180);
  },

  closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    this.editingLogId = null;
    this.deletingLogId = null;
    this.editingLotId = null;
    this.deletingLotId = null;
  },

  resetRead() {
    this.pendingWeight = null;
    this.isStable = false;
    this.lastBeepedStableWeight = null;
    this.updateHUD(0.0, false, "Pilih lot dan tahap, lalu letakkan beban pada timbangan.");
    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.disabled = true;
    const progress = document.getElementById('stabilityProgress');
    if (progress) progress.style.width = '0%';
  },

  readScale() {
    const lot = LotStore.getSelected();
    if (!lot) {
      App.toast('Silakan pilih atau tambahkan lot terlebih dahulu!', 'warning');
      return;
    }

    if (this.mode === 'stream') {
      if (this.pendingWeight != null && this.pendingWeight > 0 && this.isStable) {
        App.toast(`Bobot ${LotStore.f(this.pendingWeight, 1)} kg tertangkap dari ESP32! Silakan simpan.`, 'success');
        Auth.beep(980, 0.12, 'triangle');
      } else {
        // Trigger realistic lot reading
        this.sendHardwareLoadForCurrentLot();
      }
      return;
    }

    // Fallback: Mode Simulasi Mandiri (Internal)
    const st = this.stage;
    let target = 0;
    const kirim = parseFloat(lot.kirim) || 5000;

    if (st === "hidup") {
      target = kirim * (1 - (0.012 + Math.random() * 0.018));
    } else if (st === "basah") {
      const base = lot.hidup || (kirim * 0.985);
      target = base * (0.69 + Math.random() * 0.025);
    } else {
      const base = lot.basah || (kirim * 0.68);
      target = base * (0.992 + Math.random() * 0.018);
    }

    target = Math.round(target);
    const readBtn = document.getElementById('btnRead');
    if (readBtn) readBtn.disabled = true;

    let steps = 0;
    const maxSteps = 12;
    const numberEl = document.getElementById('readNumber');
    const infoEl = document.getElementById('readInfo');
    const progressEl = document.getElementById('stabilityProgress');

    if (this.simulationInterval) clearInterval(this.simulationInterval);

    this.simulationInterval = setInterval(() => {
      steps++;
      const noise = (Math.random() - 0.5) * (target * 0.015) * ((maxSteps - steps) / maxSteps);
      const currentSim = Math.round(target + noise);

      if (numberEl) {
        numberEl.textContent = LotStore.f(currentSim, 1);
        numberEl.classList.add('measuring');
      }

      if (progressEl) {
        progressEl.style.width = `${Math.min(100, Math.round((steps / maxSteps) * 100))}%`;
      }

      if (infoEl) {
        infoEl.textContent = `Menstabilkan getaran beban... (Sampel ${steps}/${maxSteps})`;
      }

      Auth.beep(440 + steps * 20, 0.02, 'sine');

      if (steps >= maxSteps) {
        clearInterval(this.simulationInterval);
        this.pendingWeight = target;
        this.isStable = true;

        if (numberEl) {
          numberEl.textContent = LotStore.f(target, 1);
          numberEl.classList.remove('measuring');
        }

        const prevWeight = this.getPreviousWeight(lot, st);
        const diffText = this.formatDifference(prevWeight, target, st);
        const jam = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        if (infoEl) infoEl.textContent = `Stabil · ${jam} · ${diffText}`;
        this.updateBadges(true, this.isTared, true);
        Auth.beep(980, 0.12, 'triangle');

        const btnSave = document.getElementById('btnSave');
        if (btnSave) btnSave.disabled = false;
        if (readBtn) readBtn.disabled = false;
      }
    }, 90);
  },

  getPreviousWeight(lot, st) {
    if (!lot) return null;
    if (st === "hidup") return lot.kirim != null ? lot.kirim : null;
    if (st === "basah") return lot.hidup != null ? lot.hidup : null;
    return lot.basah != null ? lot.basah : null;
  },

  formatDifference(prev, cur, st) {
    if (prev == null || cur == null) return "";
    const names = { hidup: "berat kirim", basah: "ayam hidup diterima", dingin: "karkas basah" };
    const diff = prev - cur;
    const pct = Math.abs((diff / prev) * 100);
    const label = diff >= 0 ? "susut" : "naik";
    return `${label} ${LotStore.f(Math.abs(diff))} kg (${LotStore.f(pct, 2)}%) dari ${names[st] || 'sebelumnya'}`;
  },

  async saveWeight() {
    if (this.pendingWeight == null) {
      App.toast("Belum ada pembacaan bobot yang stabil!", "warning");
      return;
    }
    const lot = LotStore.getSelected();
    if (!lot) {
      App.toast("Pilih lot terlebih dahulu!", "warning");
      return;
    }
    const st = this.stage;
    const names = { hidup: "Hidup diterima", basah: "Karkas basah", dingin: "Karkas dingin" };

    if (st === "basah" && lot.hidup == null) {
      App.toast("Timbang ayam hidup diterima dulu untuk lot ini!", "warning");
      return;
    }
    if (st === "dingin" && lot.basah == null) {
      App.toast("Timbang karkas basah dulu untuk lot ini!", "warning");
      return;
    }

    const isCorrection = lot[st] != null;
    lot[st] = this.pendingWeight;
    LotStore.save();

    // Kirim dan simpan langsung ke database SQLite
    const res = await Api.post('/weighings', {
      lot_id: lot.id,
      stage: st,
      weight_kg: this.pendingWeight,
      device_id: 'SCALE-ESP32-01'
    });

    App.toast(`Berhasil menyimpan ${names[st]} untuk ${lot.id} (${LotStore.f(this.pendingWeight, 1)} kg) ke Database`, "success");
    Auth.beep(1200, 0.15, 'sine');

    this.resetRead();
    await this.renderHistory();
    window.dispatchEvent(new CustomEvent('lot-updated', { detail: lot.id }));
    if (window.DashboardUI) DashboardUI.render();
  },

  tare() {
    this.isTared = true;
    Auth.beep(600, 0.08, 'square');
    this.updateBadges(this.isStable, true, this.isNet);
    App.toast("TARE wadah berhasil dinolkan (Tare Offset Active)", "success");
    Api.post('/devices/SCALE-ESP32-01/command', { action: 'tare' });
    this.publishMqttCommand('tare');
  },

  zero() {
    this.isTared = false;
    this.isNet = false;
    Auth.beep(500, 0.1, 'square');
    this.updateBadges(false, false, false);
    this.resetRead();
    App.toast("Platform berhasil di-ZERO", "success");
    Api.post('/devices/SCALE-ESP32-01/command', { action: 'zero' });
    this.publishMqttCommand('zero');
  },

  updateHUD(val, stable, infoText) {
    const numberEl = document.getElementById('readNumber');
    const infoEl = document.getElementById('readInfo');
    if (numberEl) numberEl.textContent = LotStore.f(val, 1);
    if (infoEl) infoEl.textContent = infoText;
    this.updateBadges(stable, this.isTared, this.isNet);
  },

  updateBadges(stable, tared, net) {
    const bStable = document.getElementById('badgeStable');
    const bTare = document.getElementById('badgeTare');
    const bNet = document.getElementById('badgeNet');
    const pill = document.getElementById('stabilityPill');
    const tareTag = document.getElementById('tareStatusTag');

    if (pill) {
      if (stable) {
        pill.className = 'scale-status-pill stable';
        pill.textContent = 'STABIL';
      } else {
        pill.className = 'scale-status-pill measuring';
        pill.textContent = 'MENIMBANG...';
      }
    }

    if (tareTag) {
      tareTag.textContent = tared ? 'NET (TARE AKTIF)' : 'GROSS (BRUTO)';
      tareTag.style.color = tared ? '#38bdf8' : '#94a3b8';
    }

    if (bStable) {
      bStable.className = 'hud-badge' + (stable ? ' active-stable' : '');
    }
    if (bTare) {
      bTare.className = 'hud-badge' + (tared ? ' active-tare' : '');
    }
    if (bNet) {
      bNet.className = 'hud-badge' + (net ? ' active-net' : '');
    }
  },

  updateLotSummaryCard() {
    const lot = LotStore.getSelected();
    const pemasokEl = document.getElementById('lotPemasokLabel');
    const kirimEl = document.getElementById('lotKirimLabel');
    const ekorEl = document.getElementById('lotEkorLabel');

    if (!lot) {
      if (pemasokEl) pemasokEl.textContent = '–';
      if (kirimEl) kirimEl.textContent = '0 kg';
      if (ekorEl) ekorEl.textContent = '–';
      return;
    }

    if (pemasokEl) pemasokEl.textContent = lot.nama || lot.id;
    if (kirimEl) kirimEl.textContent = (lot.kirim ? lot.kirim.toLocaleString('id-ID') : '0') + ' kg';
    if (ekorEl) ekorEl.textContent = (lot.ekor ? lot.ekor.toLocaleString('id-ID') : '-');
  },

  addLogItem(item) {
    let logs = [];
    try {
      logs = JSON.parse(localStorage.getItem('rphu-weighing-logs') || '[]');
    } catch (e) {}
    item.id = item.id || Date.now();
    logs.unshift(item);
    if (logs.length > 50) logs.pop();
    try {
      localStorage.setItem('rphu-weighing-logs', JSON.stringify(logs));
    } catch (e) {}
    this.renderHistory();
  },

  async renderHistory() {
    const ul = document.getElementById('logList');
    if (!ul) return;

    let logs = [];
    try {
      const res = await Api.get('/weighings');
      if (res && res.success && Array.isArray(res.data)) {
        logs = res.data.map(r => ({
          id: r.id,
          lotId: r.lot_id,
          stage: r.stage,
          stageLabel: r.stage_label || (r.stage === 'hidup' ? 'Hidup diterima' : (r.stage === 'basah' ? 'Karkas basah' : 'Karkas dingin')),
          isCorrection: Boolean(r.is_correction),
          weight: parseFloat(r.weight_kg || r.measured_weight_kg || 0),
          time: r.time || (r.recorded_at ? r.recorded_at.substring(11, 16) : '00:00'),
          notes: r.notes || r.operator_notes || ''
        }));
        localStorage.setItem('rphu-weighing-logs', JSON.stringify(logs));
      } else {
        logs = JSON.parse(localStorage.getItem('rphu-weighing-logs') || '[]');
      }
    } catch (e) {
      logs = JSON.parse(localStorage.getItem('rphu-weighing-logs') || '[]');
    }

    if (logs.length === 0) {
      ul.innerHTML = '<li class="history-empty-placeholder">Belum ada transaksi timbangan hari ini.</li>';
      return;
    }

    ul.innerHTML = logs.map(l => `
      <li class="history-log-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);gap:8px;">
        <div style="flex:1;">
          <div class="log-meta" style="font-size:12.5px;color:var(--mute);margin-bottom:2px;">
            <b style="color:var(--ink);">${l.lotId}</b> · ${l.stageLabel}
            ${l.isCorrection ? '<span class="station-pill" style="color:var(--amber);font-size:10px;padding:1px 5px;margin-left:4px;">Koreksi</span>' : ''}
          </div>
          <div class="log-weight" style="font-family:var(--font-mono);font-size:14px;font-weight:700;color:var(--ink);">
            ${LotStore.f(l.weight, 1)} kg <span style="font-size:11.5px;color:var(--mute);font-weight:400;margin-left:4px;">${l.time}</span>
          </div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn-action-sm btn-action-edit" onclick="WeighingEngine.openCorrectionModal(${l.id})" title="${Auth.can('correct_weighing') ? 'Koreksi bobot transaksi' : 'Khusus Otorisasi Supervisor / Admin'}" style="${!Auth.can('correct_weighing') ? 'opacity:0.65;' : ''}">
            Koreksi
          </button>
          <button class="btn-action-sm btn-action-delete" onclick="WeighingEngine.openDeleteWeighingModal(${l.id})" title="${Auth.can('delete_weighing') ? 'Hapus rekaman' : 'Khusus Otorisasi Supervisor / Admin'}" style="${!Auth.can('delete_weighing') ? 'opacity:0.65;' : ''}">
            Hapus
          </button>
        </div>
      </li>
    `).join('');
  },

  // ----------------------------------------------------
  // WEIGHING CORRECTION & DELETE (CRUD TRANSAKSI)
  // ----------------------------------------------------
  openCorrectionModal(logId) {
    if (!Auth.can('correct_weighing')) {
      App.toast('Koreksi data timbangan memerlukan persetujuan Supervisor atau Admin.', 'warning');
      alert('Akses Ditolak: Koreksi transaksi penimbangan hanya dapat dilakukan oleh Supervisor atau Admin.');
      return;
    }

    let logs = [];
    try {
      logs = JSON.parse(localStorage.getItem('rphu-weighing-logs') || '[]');
    } catch (e) {}

    const item = logs.find(l => l.id === logId);
    if (!item) return;

    this.editingLogId = logId;
    const modal = document.getElementById('modalCorrectWeighing');
    
    document.getElementById('correctLogLotId').value = item.lotId;
    document.getElementById('correctLogStage').value = item.stage || 'hidup';
    document.getElementById('correctLogStageText').textContent = item.stageLabel || item.stage;
    document.getElementById('correctLogOldWeight').textContent = `${LotStore.f(item.weight, 1)} kg`;
    document.getElementById('correctLogNewWeight').value = item.weight;
    document.getElementById('correctLogReason').value = '';

    if (modal) modal.classList.add('open');
  },

  async handleCorrectWeighing() {
    if (!this.editingLogId) return;

    let logs = [];
    try {
      logs = JSON.parse(localStorage.getItem('rphu-weighing-logs') || '[]');
    } catch (e) {}

    const item = logs.find(l => l.id === this.editingLogId);
    if (!item) return;

    const newWeight = parseFloat(document.getElementById('correctLogNewWeight').value);
    const reason = document.getElementById('correctLogReason').value.trim();

    if (isNaN(newWeight) || newWeight <= 0) {
      App.toast('Bobot baru harus berupa angka positif!', 'warning');
      return;
    }

    item.weight = newWeight;
    item.isCorrection = true;
    item.notes = reason || 'Koreksi supervisor';
    item.time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' (Rev)';

    // Perbarui bobot pada lot yang bersangkutan
    const lot = LotStore.getById(item.lotId);
    if (lot && item.stage) {
      lot[item.stage] = newWeight;
      LotStore.save();
    }

    localStorage.setItem('rphu-weighing-logs', JSON.stringify(logs));
    this.closeModals();
    this.renderHistory();

    // Update database SQLite
    await Api.put(`/weighings/${this.editingLogId}`, {
      lot_id: item.lotId,
      stage: item.stage,
      weight_kg: newWeight,
      notes: reason
    });

    this.closeModals();
    await this.renderHistory();

    App.toast(`Berhasil koreksi bobot ${item.lotId} menjadi ${LotStore.f(newWeight, 1)} kg di database`, 'success');
    Auth.beep(880, 0.1, 'sine');

    window.dispatchEvent(new CustomEvent('lot-updated', { detail: item.lotId }));
    if (window.DashboardUI) DashboardUI.render();
  },

  openDeleteWeighingModal(logId) {
    if (!Auth.can('delete_weighing')) {
      App.toast('Penghapusan data timbangan memerlukan persetujuan Supervisor atau Admin.', 'warning');
      alert('Akses Ditolak: Pembatalan transaksi penimbangan hanya dapat dilakukan oleh Supervisor atau Admin.');
      return;
    }

    let logs = [];
    try {
      logs = JSON.parse(localStorage.getItem('rphu-weighing-logs') || '[]');
    } catch (e) {}

    const item = logs.find(l => l.id === logId);
    if (!item) return;

    this.deletingLogId = logId;
    const modal = document.getElementById('modalDeleteWeighing');
    const desc = document.getElementById('deleteWeighingDesc');
    if (desc) desc.textContent = `${item.lotId} – ${item.stageLabel} (${LotStore.f(item.weight, 1)} kg)`;

    if (modal) modal.classList.add('open');
  },

  async executeDeleteWeighing() {
    if (!this.deletingLogId) return;

    let logs = [];
    try {
      logs = JSON.parse(localStorage.getItem('rphu-weighing-logs') || '[]');
    } catch (e) {}

    const idx = logs.findIndex(l => l.id === this.deletingLogId);
    if (idx !== -1) {
      const removed = logs.splice(idx, 1)[0];
      localStorage.setItem('rphu-weighing-logs', JSON.stringify(logs));

      // Jika lot masih ada, periksa apakah perlu mereset bobot tahap jika ini rekaman terakhir
      const lot = LotStore.getById(removed.lotId);
      if (lot && removed.stage) {
        const remainingForStage = logs.find(l => l.lotId === removed.lotId && l.stage === removed.stage);
        lot[removed.stage] = remainingForStage ? remainingForStage.weight : null;
        LotStore.save();
      }

      await Api.delete(`/weighings/${this.deletingLogId}`);
      App.toast(`Transaksi timbang berhasil dihapus dari database`, 'info');
      Auth.beep(400, 0.1, 'square');
    }

    this.closeModals();
    await this.renderHistory();
    window.dispatchEvent(new CustomEvent('lot-updated'));
    if (window.DashboardUI) DashboardUI.render();
  },

  // ----------------------------------------------------
  // LOT CRUD (CREATE, UPDATE, DELETE LOT)
  // ----------------------------------------------------
  async openAddLotModal() {
    await FarmerStore.init();
    const farmers = FarmerStore.getAll();
    const selFarmer = document.getElementById('addLotFarmer');

    if (selFarmer) {
      selFarmer.innerHTML = farmers.map(f => `
        <option value="${f.name} (${f.region || 'Jawa Barat'})" data-price="${f.default_base_price || 21500}">
          ${f.farmer_code} – ${f.name} (${f.region || '-'})
        </option>
      `).join('');
    }

    const allLots = LotStore.getAll();
    const nextNum = allLots.length + 1;
    const inputId = document.getElementById('addLotId');
    if (inputId) inputId.value = `L-0610-${String(nextNum).padStart(2, '0')}`;

    const form = document.getElementById('formAddLot');
    if (form) {
      document.getElementById('addLotBirds').value = 2500;
      document.getElementById('addLotSendWeight').value = 5125;
      document.getElementById('addLotBasePrice').value = 21500;
      document.getElementById('addLotSellPrice').value = 36000;
    }

    const modal = document.getElementById('modalAddLot');
    if (modal) modal.classList.add('open');
  },

  async handleAddLot() {
    const selFarmer = document.getElementById('addLotFarmer');
    const data = {
      id: document.getElementById('addLotId').value.trim(),
      nama: selFarmer ? selFarmer.value : 'Mitra Peternak',
      ekor: parseInt(document.getElementById('addLotBirds').value) || 0,
      kirim: parseFloat(document.getElementById('addLotSendWeight').value) || 0,
      modal: parseFloat(document.getElementById('addLotBasePrice').value) || 21500,
      jual: parseFloat(document.getElementById('addLotSellPrice').value) || 36000,
      basis: document.getElementById('addLotBasis').value || 'kirim'
    };

    if (!data.id) {
      App.toast('Lot ID wajib diisi!', 'warning');
      return;
    }

    await LotStore.add(data);
    this.closeModals();
    if (window.DashboardUI) DashboardUI.render();
    App.toast(`Lot baru ${data.id} berhasil ditambahkan!`, 'success');
    Auth.beep(880, 0.1, 'sine');
  },

  openEditLotModal(lotId) {
    const lot = LotStore.getById(lotId);
    if (!lot) return;

    this.editingLotId = lotId;
    const modal = document.getElementById('modalEditLot');

    document.getElementById('editLotId').value = lot.id;
    document.getElementById('editLotName').value = lot.nama;
    document.getElementById('editLotBirds').value = lot.ekor;
    document.getElementById('editLotSendWeight').value = lot.kirim;
    document.getElementById('editLotBasePrice').value = lot.modal;
    document.getElementById('editLotSellPrice').value = lot.jual;
    document.getElementById('editLotBasis').value = lot.basis || 'kirim';

    if (modal) modal.classList.add('open');
  },

  async handleEditLot() {
    if (!this.editingLotId) return;

    const data = {
      nama: document.getElementById('editLotName').value.trim(),
      ekor: parseInt(document.getElementById('editLotBirds').value) || 0,
      kirim: parseFloat(document.getElementById('editLotSendWeight').value) || 0,
      modal: parseFloat(document.getElementById('editLotBasePrice').value) || 21500,
      jual: parseFloat(document.getElementById('editLotSellPrice').value) || 36000,
      basis: document.getElementById('editLotBasis').value || 'kirim'
    };

    await LotStore.update(this.editingLotId, data);
    this.closeModals();
    if (window.DashboardUI) DashboardUI.render();
    App.toast(`Data Lot ${this.editingLotId} berhasil diperbarui!`, 'success');
    Auth.beep(880, 0.1, 'sine');
  },

  openDeleteLotModal(lotId) {
    const lot = LotStore.getById(lotId);
    if (!lot) return;

    this.deletingLotId = lotId;
    const modal = document.getElementById('modalDeleteLot');
    const desc = document.getElementById('deleteLotDesc');
    if (desc) desc.textContent = `${lot.id} (${lot.nama})`;

    if (modal) modal.classList.add('open');
  },

  async executeDeleteLot() {
    if (!this.deletingLotId) return;

    const id = this.deletingLotId;
    await LotStore.delete(id);
    this.closeModals();
    if (window.DashboardUI) DashboardUI.render();
    App.toast(`Lot ${id} berhasil dihapus!`, 'info');
    Auth.beep(400, 0.1, 'square');
  }
};

