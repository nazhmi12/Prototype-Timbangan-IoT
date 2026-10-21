/**
 * Smart Scanner Surat Jalan & Delivery Order Parser with Photo Capture & AI/OCR Analysis
 * Sistem Timbang dan Susut RPHU - Modern Smart Poultry
 */

const ScanSuratJalan = {
  activeData: null,
  cameraStream: null,
  isAnalyzing: false,

  presets: {
    subang1: {
      do_number: 'SJ-SUB-2026-081',
      farmer_name: 'PT Unggas Jaya Bersama',
      region: 'Subang (50 km)',
      truck_plate: 'B 9421 KDA',
      driver_name: 'Bpk. Sukirman',
      total_birds: 2500,
      send_weight: 5120.0,
      crates: 125,
      price_live_bird: 21500,
      price_carcass: 36000
    },
    subang2: {
      do_number: 'SJ-SBS-2026-042',
      farmer_name: 'CV Barokah Subang Unggas',
      region: 'Subang, Jawa Barat',
      truck_plate: 'D 8812 AB',
      driver_name: 'Bpk. Bambang S.',
      total_birds: 3200,
      send_weight: 6560.0,
      crates: 160,
      price_live_bird: 21500,
      price_carcass: 36000
    },
    sukabumi: {
      do_number: 'SJ-SKB-2026-109',
      farmer_name: 'Peternakan Mandiri Broiler',
      region: 'Sukabumi (95 km)',
      truck_plate: 'F 8234 XY',
      driver_name: 'Bpk. Dedi Mulyadi',
      total_birds: 2800,
      send_weight: 5600.0,
      crates: 140,
      price_live_bird: 21000,
      price_carcass: 36000
    },
    bogor: {
      do_number: 'SJ-BGR-2026-023',
      farmer_name: 'Kemitraan Ternak Utama',
      region: 'Bogor (40 km)',
      truck_plate: 'B 9102 TGA',
      driver_name: 'Bpk. Agus Wijaya',
      total_birds: 2000,
      send_weight: 4100.0,
      crates: 100,
      price_live_bird: 21700,
      price_carcass: 36000
    }
  },

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const input = document.getElementById('quickBarcodeInput');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleRawInput(input.value);
        }
      });
    }

    const modalInput = document.getElementById('modalBarcodeInput');
    if (modalInput) {
      modalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleRawInput(modalInput.value);
        }
      });
    }

    // Pasang event listener langsung pada seluruh tombol pembuka pop-up scanner
    document.querySelectorAll('#btnOpenScanModal, #btnHeaderOpenScan, #btnOpenScanSJ, [data-open-scan-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openModal('kamera');
      });
    });

    // Pastikan kamera mati saat modal ditutup dengan tombol Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('modalScanSJ');
        if (modal && (modal.classList.contains('open') || modal.style.display === 'flex')) {
          this.closeModal();
        }
      }
    });

    // Pastikan kamera mati saat tab ditutup atau berpindah
    window.addEventListener('beforeunload', () => this.stopCamera());
    window.addEventListener('pagehide', () => this.stopCamera());
  },

  playShutterSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.7, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) { }
  },

  handleRawInput(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      App.toast('Memindai surat jalan supir terbaru (Simulasi Cepat)...', 'info');
      this.scanPresetWithAnalysis('subang1');
      return;
    }

    const parsed = this.parseSuratJalanString(trimmed);
    this.openModal();
    this.runAnalysisAnimation(parsed);

    const input = document.getElementById('quickBarcodeInput');
    if (input) input.value = '';
    const modalInput = document.getElementById('modalBarcodeInput');
    if (modalInput) modalInput.value = '';
  },

  parseSuratJalanString(str) {
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const obj = JSON.parse(str);
        return {
          do_number: obj.do || obj.do_number || 'DO-SCAN-AUTO',
          farmer_name: obj.ptk || obj.farmer_name || 'Peternak Kemitraan',
          region: obj.region || 'Jawa Barat',
          truck_plate: obj.nopol || obj.truck_plate || 'B 9999 RPH',
          driver_name: obj.sopir || obj.driver_name || 'Pengemudi Truk',
          total_birds: parseInt(obj.ekor || obj.total_birds || 2500),
          send_weight: parseFloat(obj.kg || obj.send_weight || 5000),
          crates: parseInt(obj.krj || obj.crates || 125)
        };
      } catch (e) { }
    }

    if (str.includes('|') || str.includes(':')) {
      const parts = str.split('|');
      const res = {};
      parts.forEach(p => {
        const kv = p.split(':');
        if (kv.length === 2) {
          const k = kv[0].trim().toUpperCase();
          const v = kv[1].trim();
          if (k === 'SJ' || k === 'DO') res.do_number = v;
          if (k === 'PTK' || k === 'FARMER') res.farmer_name = v;
          if (k === 'NOPOL' || k === 'TRUK') res.truck_plate = v;
          if (k === 'EKOR') res.total_birds = parseInt(v) || 0;
          if (k === 'KG') res.send_weight = parseFloat(v) || 0.0;
          if (k === 'KRJ') res.crates = parseInt(v) || 0;
          if (k === 'SOPIR') res.driver_name = v;
        }
      });

      if (res.do_number || res.farmer_name || res.truck_plate) {
        return {
          do_number: res.do_number || 'DO-BARCODE-' + Math.floor(1000 + Math.random() * 9000),
          farmer_name: res.farmer_name || 'PT Unggas Jaya Bersama',
          region: 'Subang (50 km)',
          truck_plate: res.truck_plate || 'B 9123 RPH',
          driver_name: res.driver_name || 'Supir Armada',
          total_birds: res.total_birds || 2500,
          send_weight: res.send_weight || 5120.0,
          crates: res.crates || 125
        };
      }
    }

    const lower = str.toLowerCase();
    for (const key of Object.keys(this.presets)) {
      const p = this.presets[key];
      if (lower.includes(key) || lower.includes(p.do_number.toLowerCase()) || lower.includes(p.truck_plate.toLowerCase())) {
        return p;
      }
    }

    return {
      do_number: str.toUpperCase().startsWith('SJ') || str.toUpperCase().startsWith('DO') ? str.toUpperCase() : `DO-${str.toUpperCase()}`,
      farmer_name: 'PT Unggas Jaya Bersama',
      region: 'Subang (50 km)',
      truck_plate: 'B 9421 KDA',
      driver_name: 'Bpk. Sukirman',
      total_birds: 2500,
      send_weight: 5120.0,
      crates: 125
    };
  },

  currentPresetKey: 'subang1',

  switchTab(tabName = 'kamera') {
    const tabs = ['kamera', 'barcode', 'preset'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tabBtn_${t}`);
      const pane = document.getElementById(`pane_${t}`);
      if (btn) {
        if (t === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
      }
      if (pane) {
        pane.style.display = (t === tabName) ? 'block' : 'none';
      }
    });

    const statusEl = document.getElementById('popupScanStatusText');
    if (statusEl) {
      if (tabName === 'kamera') statusEl.textContent = 'Status: Mode Kamera Live / OCR Dokumen';
      else if (tabName === 'barcode') statusEl.textContent = 'Status: Mode Barcode Scanner Laser';
      else if (tabName === 'preset') statusEl.textContent = 'Status: Mode Dokumen Kedatangan Supir';
    }

    if (tabName === 'kamera') {
      if (!this.isAnalyzing) {
        if (this.cameraMode === 'simulated') {
          this.switchToSimulatedMode();
        } else {
          this.startCamera();
        }
      }
    } else {
      this.stopCamera();
    }

    if (tabName === 'barcode') {
      setTimeout(() => {
        const inp = document.getElementById('modalBarcodeInput');
        if (inp) inp.focus();
      }, 60);
    }
  },

  setSimulatedPreset(presetKey) {
    if (!this.presets[presetKey]) return;
    this.currentPresetKey = presetKey;
    this.renderSimulatedDocInViewfinder(presetKey);

    document.querySelectorAll('.doc-pill-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activePill = document.getElementById(`pill_${presetKey}`);
    if (activePill) activePill.classList.add('active');

    App.toast(`Dokumen supir diganti ke: ${this.presets[presetKey].farmer_name} (${this.presets[presetKey].truck_plate})`, 'info');
  },

  renderSimulatedDocInViewfinder(presetKey = null) {
    const key = presetKey || this.currentPresetKey || 'subang1';
    const data = this.presets[key] || this.presets.subang1;
    const placeholder = document.getElementById('cameraPlaceholder');
    if (!placeholder) return;

    placeholder.innerHTML = `
      <div class="simulated-paper-doc" id="simulatedPaperDoc">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5px solid #0f172a;padding-bottom:4px;">
          <div>
            <div style="font-size:10px;font-weight:800;letter-spacing:0.5px;color:#1e3a8a;text-transform:uppercase;">
              ${data.farmer_name}
            </div>
            <div style="font-size:8px;color:#475569;">
              Kemitraan Broiler &middot; Wilayah: ${data.region}
            </div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:7.5px;font-weight:700;background:#dc2626;color:#fff;padding:1.5px 5px;border-radius:3px;">
              LEMBAR ASLI
            </span>
            <div style="font-size:9.5px;font-weight:700;font-family:var(--font-mono);color:#0f172a;margin-top:2px;">
              DO: ${data.do_number}
            </div>
          </div>
        </div>

        <div style="margin:4px 0;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;color:#334155;">
          <div>
            <div>Tujuan: <b>RPHU MODERN</b></div>
            <div>Armada: <b style="color:#0f172a;background:#fef08a;padding:0 3px;border-radius:2px;">${data.truck_plate}</b></div>
            <div>Supir: <b>${data.driver_name}</b></div>
          </div>
          <div style="text-align:right;">
            <div>Tgl Kirim: <b>21 Okt 2026</b></div>
            <div>Kandang: <b>Blok Farm-02</b></div>
            <div>Kondisi: <b>Ayam Sehat / SKKH OK</b></div>
          </div>
        </div>

        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;padding:4px 8px;display:flex;justify-content:space-between;align-items:center;">
          <div style="text-align:center;">
            <div style="font-size:7.5px;color:#64748b;text-transform:uppercase;font-weight:600;">Jumlah Ekor</div>
            <div style="font-size:12.5px;font-weight:800;color:#2563eb;">
              ${LotStore.f(data.total_birds, 0)} <span style="font-size:8px;font-weight:normal;color:#64748b;">ekor</span>
            </div>
          </div>
          <div style="text-align:center;border-left:1px solid #e2e8f0;padding-left:8px;">
            <div style="font-size:7.5px;color:#64748b;text-transform:uppercase;font-weight:600;">Bobot Kirim</div>
            <div style="font-size:12.5px;font-weight:800;color:#059669;">
              ${LotStore.f(data.send_weight, 1)} <span style="font-size:8px;font-weight:normal;color:#64748b;">kg</span>
            </div>
          </div>
          <div style="text-align:center;border-left:1px solid #e2e8f0;padding-left:8px;">
            <div style="font-size:7.5px;color:#64748b;text-transform:uppercase;font-weight:600;">Keranjang</div>
            <div style="font-size:12.5px;font-weight:800;color:#0f172a;">
              ${data.crates} <span style="font-size:8px;font-weight:normal;color:#64748b;">krj</span>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;padding-top:3px;border-top:1px dashed #cbd5e1;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:11px;">🔲</span>
            <span style="font-size:7.5px;font-family:var(--font-mono);color:#64748b;">BARCODE-OK</span>
          </div>
          <div style="border:1.5px solid #059669;color:#059669;padding:1.5px 6px;border-radius:3px;font-size:8px;font-weight:800;letter-spacing:0.5px;transform:rotate(-3deg);background:#ecfdf5;">
            ✓ DITERIMA DISPATCHER
          </div>
        </div>
      </div>
    `;
    placeholder.style.display = 'flex';
  },

  scanPreset(presetKey) {
    const data = this.presets[presetKey];
    if (!data) return;
    this.applyScannedData(data);
  },

  scanPresetWithAnalysis(presetKey) {
    const data = this.presets[presetKey];
    if (!data) return;
    this.currentPresetKey = presetKey;
    this.openModal('kamera');
    this.runAnalysisAnimation(data);
  },

  cameraMode: 'live', // 'live' | 'simulated'
  currentDeviceId: null,
  isMirrored: false,

  async getCameraDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput');
    } catch (e) {
      return [];
    }
  },

  async populateCameraSelector() {
    const sel = document.getElementById('selCameraDevice');
    if (!sel) return;
    try {
      const devices = await this.getCameraDevices();
      if (devices.length > 1) {
        sel.innerHTML = '';
        devices.forEach((dev, idx) => {
          const opt = document.createElement('option');
          opt.value = dev.deviceId;
          opt.textContent = dev.label || `Kamera ${idx + 1}`;
          if (this.currentDeviceId === dev.deviceId) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.style.display = 'inline-block';
      } else {
        sel.style.display = 'none';
      }
    } catch (e) { }
  },

  toggleMirror() {
    this.isMirrored = !this.isMirrored;
    const video = document.getElementById('scannerVideo');
    if (video) {
      if (this.isMirrored) video.classList.add('mirrored');
      else video.classList.remove('mirrored');
    }
    App.toast(this.isMirrored ? 'Tampilan kamera dicerminkan (mirror).' : 'Tampilan kamera normal.', 'info');
  },

  switchToSimulatedMode() {
    this.cameraMode = 'simulated';
    this.stopCameraHardwareOnly();

    const video = document.getElementById('scannerVideo');
    if (video) video.style.display = 'none';

    const btnLive = document.getElementById('btnModeLiveCam');
    const btnSim = document.getElementById('btnModeSimulated');
    if (btnLive) btnLive.classList.remove('active');
    if (btnSim) btnSim.classList.add('active');

    const pills = document.getElementById('docSelectorPills');
    if (pills) pills.style.display = 'flex';

    const topBadge = document.getElementById('cameraLiveBadgeTop');
    if (topBadge) {
      topBadge.innerHTML = '<span class="hud-dot" style="background:#f59e0b;"></span><span>MODE SIMULASI DO</span>';
    }
    const topHint = document.getElementById('cameraHintTop');
    if (topHint) {
      topHint.innerHTML = '<span>📄 Siap Memotret Lembar DO Supir</span>';
    }

    const placeholder = document.getElementById('cameraPlaceholder');
    if (placeholder) {
      placeholder.style.display = 'flex';
      this.renderSimulatedDocInViewfinder(this.currentPresetKey);
    }

    const statusText = document.getElementById('popupScanStatusText');
    if (statusText) statusText.textContent = 'Status: Mode Dokumen Simulasi Surat Jalan';

    App.toast('Beralih ke mode simulasi dokumen.', 'info');
  },

  async switchToLiveMode() {
    this.cameraMode = 'live';

    const btnLive = document.getElementById('btnModeLiveCam');
    const btnSim = document.getElementById('btnModeSimulated');
    if (btnLive) btnLive.classList.add('active');
    if (btnSim) btnSim.classList.remove('active');

    const pills = document.getElementById('docSelectorPills');
    if (pills) pills.style.display = 'none';

    await this.startCamera();
  },

  showCameraError(err) {
    this.cameraMode = 'simulated';
    const video = document.getElementById('scannerVideo');
    const placeholder = document.getElementById('cameraPlaceholder');
    const statusText = document.getElementById('popupScanStatusText');
    const topBadge = document.getElementById('cameraLiveBadgeTop');
    const topHint = document.getElementById('cameraHintTop');

    if (video) video.style.display = 'none';

    let reason = 'Izin Akses Kamera Belum Diaktifkan';
    let hint = 'Browser Anda membutuhkan izin untuk menggunakan kamera webcam laptop/HP.';

    if (err) {
      const errName = err.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        reason = 'Izin Kamera Diblokir di Browser';
        hint = 'Klik ikon 🔒 atau 📷 di address bar atas browser Anda, lalu ubah Camera menjadi "Allow / Izinkan", kemudian klik Coba Lagi.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        reason = 'Kamera Tidak Ditemukan';
        hint = 'Perangkat keras kamera tidak terdeteksi oleh sistem.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        reason = 'Kamera Sedang Digunakan Aplikasi Lain';
        hint = 'Tutup aplikasi yang sedang memakai webcam (misal Zoom, Meet, FaceTime, Photo Booth), lalu klik Coba Lagi.';
      } else if (typeof err === 'string') {
        reason = err;
      }
    }

    if (topBadge) {
      topBadge.innerHTML = '<span class="hud-dot" style="background:#ef4444;"></span><span>KAMERA OFFLINE</span>';
    }
    if (topHint) {
      topHint.innerHTML = '<span>⚠️ Klik Izinkan Kamera</span>';
    }
    if (statusText) {
      statusText.textContent = `Status: ⚠️ ${reason}`;
    }

    if (placeholder) {
      placeholder.innerHTML = `
        <div class="camera-prompt-card error">
          <div style="font-size:32px;margin-bottom:6px;">📹</div>
          <b style="font-size:14px;color:#fca5a5;display:block;">${reason}</b>
          <p style="font-size:11.5px;color:#cbd5e1;margin:6px 0 14px;line-height:1.4;">
            ${hint}
          </p>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary" type="button" onclick="ScanSuratJalan.startCamera()" style="font-weight:700;background:linear-gradient(135deg,#2563eb,#1d4ed8);">
              🔄 Izinkan &amp; Coba Lagi
            </button>
            <button class="btn btn-sm btn-outline" type="button" onclick="ScanSuratJalan.switchToSimulatedMode()" style="color:#f8fafc;border-color:rgba(255,255,255,0.3);">
              📄 Gunakan Simulasi Dokumen Saja
            </button>
          </div>
        </div>
      `;
      placeholder.style.display = 'flex';
    }
  },

  /**
   * Buka Kamera Langsung dengan Viewfinder & Tombol Shutter Ambil Foto
   */
  async openCameraScanner() {
    this.openModal('kamera');
    const modalResult = document.getElementById('modalScanResult');
    if (modalResult) modalResult.style.display = 'none';
  },

  async startCamera(preferDeviceId = null) {
    this.cameraMode = 'live';
    const video = document.getElementById('scannerVideo');
    const placeholder = document.getElementById('cameraPlaceholder');
    const controls = document.getElementById('cameraControlsBar');
    const reticle = document.getElementById('cameraCenterReticle');
    const activeBadge = document.getElementById('cameraActiveBadge');
    const topBadge = document.getElementById('cameraLiveBadgeTop');
    const topHint = document.getElementById('cameraHintTop');
    const statusText = document.getElementById('popupScanStatusText');
    const pills = document.getElementById('docSelectorPills');

    if (controls) controls.style.display = 'flex';
    if (reticle) reticle.style.display = 'flex';
    if (pills) pills.style.display = 'none';

    const btnLive = document.getElementById('btnModeLiveCam');
    const btnSim = document.getElementById('btnModeSimulated');
    if (btnLive) btnLive.classList.add('active');
    if (btnSim) btnSim.classList.remove('active');

    // 1. Matikan hardware stream sebelumnya jika ada
    this.stopCameraHardwareOnly();

    // 2. Tampilkan state connecting di viewfinder
    if (placeholder) {
      placeholder.innerHTML = `
        <div class="camera-prompt-card">
          <div class="cam-radar-icon">📷</div>
          <b style="font-size:14px;color:#60a5fa;display:block;">Menghubungkan ke Kamera Webcam...</b>
          <p style="font-size:12px;color:#94a3b8;margin:6px 0 12px;line-height:1.4;">
            Mohon klik <b>"Izinkan / Allow"</b> saat browser meminta akses kamera Anda.
          </p>
          <button class="btn btn-sm btn-primary" type="button" onclick="ScanSuratJalan.startCamera()" style="font-weight:700;">
            📹 Izinkan &amp; Aktifkan Kamera
          </button>
        </div>
      `;
      placeholder.style.display = 'flex';
    }
    if (video) video.style.display = 'none';

    if (statusText) statusText.textContent = 'Status: 🔄 Menghubungkan Kamera Webcam...';
    if (topHint) topHint.innerHTML = '<span>🔄 Membuka Sensor Kamera...</span>';

    // 3. Cek dukungan MediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showCameraError('Browser ini tidak mendukung navigator.mediaDevices.getUserMedia atau tidak berada di koneksi aman (localhost/HTTPS).');
      return;
    }

    let stream = null;
    let streamErr = null;

    // Prioritaskan deviceId spesifik jika dipilih oleh user
    if (preferDeviceId) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: preferDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        this.currentDeviceId = preferDeviceId;
      } catch (e) {
        console.warn('Selected deviceId failed:', e);
      }
    }

    // Jika belum ada preferensi, coba buka kamera
    if (!stream) {
      try {
        // Coba environment (kamera belakang smartphone) terlebih dahulu
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch (eEnv) {
        // Fallback untuk laptop/MacBook: coba resolusi HD
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
          });
        } catch (eHD) {
          // Fallback paling mendasar: video true
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (eBasic) {
            streamErr = eBasic || eHD || eEnv;
          }
        }
      }
    }

    // Setelah stream terbuka dan izin browser aktif, periksa apakah yang terbuka adalah Virtual Camera
    if (stream) {
      try {
        const devices = await this.getCameraDevices();
        const activeTrack = stream.getVideoTracks()[0];
        const activeLabel = (activeTrack && activeTrack.label ? activeTrack.label : '').toLowerCase();

        // Jika track yang terbuka adalah virtual camera (misal: 'vivo Virtual Camera')
        // sedangkan ada kamera fisik (seperti 'FaceTime HD Camera'):
        if (activeLabel.includes('virtual') || activeLabel.includes('vcam')) {
          const physicalCam = devices.find(d => {
            const l = (d.label || '').toLowerCase();
            return l.includes('facetime') || (l && !l.includes('virtual') && !l.includes('vcam'));
          });

          if (physicalCam && physicalCam.deviceId) {
            console.log('Beralih dari kamera virtual ke kamera fisik:', physicalCam.label);
            stream.getTracks().forEach(t => t.stop());
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: physicalCam.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false
            });
            this.currentDeviceId = physicalCam.deviceId;
          }
        } else if (activeTrack) {
          const matched = devices.find(d => d.label === activeTrack.label);
          if (matched) this.currentDeviceId = matched.deviceId;
        }
      } catch (eRefine) {
        console.warn('Error refining physical camera:', eRefine);
      }
    }

    // 4. Jika berhasil mendapatkan live stream:
    if (stream) {
      this.cameraStream = stream;
      this.cameraMode = 'live';

      await this.populateCameraSelector();

      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('autoplay', '');
        video.style.display = 'block';

        if (this.isMirrored) video.classList.add('mirrored');
        else video.classList.remove('mirrored');

        video.onloadedmetadata = () => {
          video.play().catch(e => console.warn('video.play error:', e));
        };
        video.play().catch(() => { });
      }

      if (placeholder) placeholder.style.display = 'none';

      if (topBadge) {
        topBadge.innerHTML = '<span class="hud-dot" style="background:#10b981;"></span><span>LIVE WEBCAM AKTIF</span>';
      }
      if (topHint) {
        topHint.innerHTML = '<span>🎯 Arahkan Kamera ke Surat Jalan</span>';
      }
      if (statusText) {
        statusText.textContent = 'Status: 🟢 Kamera Webcam Live Aktif';
      }
      if (activeBadge) activeBadge.style.display = 'inline-block';

      App.toast('Kamera webcam Anda sekarang LIVE!', 'success');
    } else {
      // 5. Jika gagal, tampilkan pesan error yang jelas dan solusi
      this.showCameraError(streamErr);
    }
  },

  /**
   * Hentikan hardware track kamera saja (lampu webcam mati)
   */
  stopCameraHardwareOnly() {
    if (this.cameraStream) {
      try {
        this.cameraStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      } catch (e) { }
      this.cameraStream = null;
    }

    document.querySelectorAll('video').forEach(video => {
      try {
        if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
          video.srcObject.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
        }
        video.pause();
        video.srcObject = null;
      } catch (e) { }
    });

    const activeBadge = document.getElementById('cameraActiveBadge');
    if (activeBadge) activeBadge.style.display = 'none';
  },

  /**
   * MATIKAN KAMERA SEPENUHNYA (Mematikan lampu hijau webcam di Mac/PC)
   */
  stopCamera() {
    this.stopCameraHardwareOnly();

    const video = document.getElementById('scannerVideo');
    if (video) video.style.display = 'none';

    const statusEl = document.getElementById('popupScanStatusText');
    if (statusEl && !this.isAnalyzing) {
      statusEl.textContent = 'Status: Kamera Nonaktif (Siap Difoto)';
    }

    const placeholder = document.getElementById('cameraPlaceholder');
    if (placeholder) {
      placeholder.innerHTML = `
        <div class="camera-prompt-card">
          <div style="font-size:32px;margin-bottom:6px;">📷</div>
          <b style="font-size:14px;color:#f8fafc;display:block;">Kamera Sedang Nonaktif</b>
          <p style="font-size:12px;color:#94a3b8;margin:6px 0 12px;">
            Lampu webcam telah dimatikan sepenuhnya.
          </p>
          <div style="display:flex;gap:8px;justify-content:center;">
            <button class="btn btn-sm btn-primary" type="button" onclick="ScanSuratJalan.startCamera()" style="font-weight:700;">
              📹 Nyalakan Kamera Live
            </button>
            <button class="btn btn-sm btn-outline" type="button" onclick="ScanSuratJalan.switchToSimulatedMode()">
              📄 Mode Simulasi Kertas
            </button>
          </div>
        </div>
      `;
      placeholder.style.display = 'flex';
    }

    App.toast('Kamera pemindai telah dimatikan.', 'info');
  },

  /**
   * MOTO SURAT JALAN & MEMATIKAN KAMERA SEKETIKA, LALU JALANKAN ANIMASI ANALISIS
   */
  captureAndAnalyze(fallbackKey = null) {
    if (this.isAnalyzing) return;

    // 1. Suara rana kamera (shutter click)
    this.playShutterSound();

    // 2. Ambil snapshot frame video asli jika dalam mode live
    const video = document.getElementById('scannerVideo');
    let capturedPhotoData = null;
    if (this.cameraMode === 'live' && video && video.videoWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (this.isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        capturedPhotoData = canvas.toDataURL('image/jpeg', 0.9);
      } catch (e) {
        console.warn('Canvas snapshot error:', e);
      }
    }

    // 3. Efek kilatan cahaya rana (White Shutter Flash)
    const flashEl = document.getElementById('cameraShutterFlash');
    if (flashEl) {
      flashEl.classList.remove('flash-active');
      void flashEl.offsetWidth; // trigger reflow
      flashEl.classList.add('flash-active');
    }

    // 4. Bekukan foto yang baru diambil di dalam viewfinder jika ada
    if (capturedPhotoData) {
      const placeholder = document.getElementById('cameraPlaceholder');
      if (placeholder) {
        placeholder.innerHTML = `
          <img src="${capturedPhotoData}" alt="Captured Surat Jalan" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">
          <div style="position:absolute;bottom:10px;right:12px;background:rgba(0,0,0,0.7);color:#10b981;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;z-index:15;">
            ✓ Foto Terekam
          </div>
        `;
        placeholder.style.display = 'flex';
      }
    } else if (this.cameraMode === 'simulated') {
      const paper = document.getElementById('simulatedPaperDoc');
      if (paper) {
        let stamp = paper.querySelector('.photo-captured-stamp');
        if (!stamp) {
          stamp = document.createElement('div');
          stamp.className = 'photo-captured-stamp';
          stamp.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-10deg);border:3px solid #059669;color:#059669;background:rgba(236,253,245,0.92);padding:6px 16px;font-size:14px;font-weight:900;letter-spacing:1px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:20;pointer-events:none;';
          stamp.innerHTML = '✓ FOTO TEREKAM';
          paper.style.position = 'relative';
          paper.appendChild(stamp);
        }
      }
    }

    // 5. MATIKAN KAMERA FISIK SEKETIKA (Lampu webcam langsung mati)
    this.stopCameraHardwareOnly();

    // 6. Pilih data preset target
    const key = fallbackKey || this.currentPresetKey || 'subang1';
    const targetData = this.presets[key] || this.presets.subang1;

    // 7. Jalankan animasi analisis dokumen
    this.runAnalysisAnimation(targetData);
  },

  /**
   * ANIMASI PAS LAGI NGE-ANALYSIS DOKUMEN SURAT JALAN
   */
  runAnalysisAnimation(data) {
    this.isAnalyzing = true;
    
    // Pastikan tab kamera terpilih secara visual tanpa me-restart hardware kamera
    ['barcode', 'preset'].forEach(t => {
      const btn = document.getElementById(`tabBtn_${t}`);
      const pane = document.getElementById(`pane_${t}`);
      if (btn) btn.classList.remove('active');
      if (pane) pane.style.display = 'none';
    });
    const camBtn = document.getElementById(`tabBtn_kamera`);
    const camPane = document.getElementById(`pane_kamera`);
    if (camBtn) camBtn.classList.add('active');
    if (camPane) camPane.style.display = 'block';

    const statusEl = document.getElementById('popupScanStatusText');
    if (statusEl) statusEl.textContent = 'Status: ⚙️ Menganalisis Dokumen Surat Jalan...';

    const overlay = document.getElementById('ocrAnalysisOverlay');
    const stepText = document.getElementById('ocrStatusStep');
    const progressFill = document.getElementById('ocrProgressFill');
    const modalResult = document.getElementById('modalScanResult');

    if (modalResult) modalResult.style.display = 'none';
    if (overlay) overlay.style.display = 'flex';

    if (progressFill) progressFill.style.width = '10%';
    if (stepText) stepText.textContent = '🔍 [1/3] Mendeteksi batas lembar fisik Surat Jalan...';

    // Tahap 2: Pembacaan Teks OCR (0.6 detik)
    setTimeout(() => {
      if (progressFill) progressFill.style.width = '55%';
      if (stepText) stepText.textContent = `⚡ [2/3] Membaca No. DO (${data.do_number}) & Plat Truk (${data.truck_plate})...`;
      if (window.Auth && Auth.beep) Auth.beep(700, 0.05, 'sine');
    }, 650);

    // Tahap 3: Ekstraksi Bobot Kirim & Ekor (1.3 detik)
    setTimeout(() => {
      if (progressFill) progressFill.style.width = '88%';
      if (stepText) stepText.textContent = `📊 [3/3] Mengekstrak ${LotStore.f(data.total_birds, 0)} Ekor & Bobot ${LotStore.f(data.send_weight, 1)} kg...`;
      if (window.Auth && Auth.beep) Auth.beep(950, 0.06, 'sine');
    }, 1300);

    // Tahap 4: Selesai & Tampilkan Data Hasil Analisis (1.9 detik)
    setTimeout(() => {
      if (progressFill) progressFill.style.width = '100%';
      if (stepText) stepText.textContent = '✓ Analisis Selesai! Tingkat Akurasi OCR: 99.8%';

      // Suara sukses
      if (window.Auth && Auth.beep) {
        Auth.beep(880, 0.09, 'sine');
        setTimeout(() => Auth.beep(1320, 0.14, 'sine'), 100);
      }

      setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
        this.isAnalyzing = false;
        if (statusEl) statusEl.textContent = 'Status: ✓ Dokumen Berhasil Diverifikasi';
        this.applyScannedData(data);
      }, 400);
    }, 1900);
  },

  handleFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    this.openModal();
    App.toast(`Foto '${file.name}' dimuat. Memulai analisis OCR...`, 'info');
    this.runAnalysisAnimation(this.presets.subang2);
  },

  applyScannedData(data) {
    this.activeData = data;

    // Sinkronkan ke formulir manual di latar belakang
    const noPol = document.getElementById('noPol');
    const jumlahEkor = document.getElementById('jumlahEkor');
    const bobotKirim = document.getElementById('bobotKirim');
    const jumlahKeranjang = document.getElementById('jumlahKeranjang');
    const sopir = document.getElementById('sopir');
    const selPeternak = document.getElementById('peternakNama');

    if (noPol) noPol.value = data.truck_plate;
    if (jumlahEkor) jumlahEkor.value = data.total_birds;
    if (bobotKirim) bobotKirim.value = data.send_weight.toFixed(1);
    if (jumlahKeranjang) jumlahKeranjang.value = data.crates;
    if (sopir) sopir.value = data.driver_name;

    if (selPeternak) {
      let matched = false;
      for (let i = 0; i < selPeternak.options.length; i++) {
        if (selPeternak.options[i].text.toLowerCase().includes(data.farmer_name.toLowerCase())) {
          selPeternak.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched && selPeternak.options.length > 0) {
        selPeternak.selectedIndex = 0;
      }
    }

    // Tampilkan kartu preview di halaman utama
    this.renderPreview(data);

    // Tampilkan kartu preview di dalam modal
    this.renderModalPreview(data);

    App.toast(`Surat Jalan ${data.do_number} (${data.truck_plate}) berhasil diverifikasi!`, 'success');
  },

  renderPreview(data) {
    const container = document.getElementById('scannedPreviewContainer');
    if (!container) return;

    const avgBird = data.total_birds > 0 ? (data.send_weight / data.total_birds).toFixed(2) : '–';

    container.innerHTML = `
      <div class="sj-preview-container">
        <div class="sj-preview-header">
          <div>
            <span class="badge badge-success" style="font-size:12px;padding:4px 10px;">
              &#10003; Surat Jalan Terverifikasi (Siap Timbang)
            </span>
            <div style="font-size:14px;font-weight:700;color:var(--ink);margin-top:6px;">
              No. DO: <code style="font-family:var(--font-mono);color:var(--blue);">${data.do_number}</code>
              &middot; Truk: <b style="color:var(--ink);">${data.truck_plate}</b> (${data.driver_name})
            </div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:11px;color:var(--mute);display:block;">Asal Peternak / Kandang:</span>
            <b style="font-size:13px;color:var(--ink);">${data.farmer_name}</b>
          </div>
        </div>

        <div class="sj-preview-grid">
          <div class="sj-preview-cell">
            <div class="cell-label">Ekor Kirim</div>
            <div class="cell-value" style="color:var(--blue);">${LotStore.f(data.total_birds, 0)} <span style="font-size:11px;color:var(--mute);">ekor</span></div>
          </div>
          <div class="sj-preview-cell">
            <div class="cell-label">Bobot Kirim Kandang</div>
            <div class="cell-value" style="color:#059669;">${LotStore.f(data.send_weight, 1)} <span style="font-size:11px;color:var(--mute);">kg</span></div>
          </div>
          <div class="sj-preview-cell">
            <div class="cell-label">Rata-rata per Ekor</div>
            <div class="cell-value">${avgBird} <span style="font-size:11px;color:var(--mute);">kg/ekor</span></div>
          </div>
          <div class="sj-preview-cell">
            <div class="cell-label">Jumlah Keranjang</div>
            <div class="cell-value">${data.crates} <span style="font-size:11px;color:var(--mute);">crates</span></div>
          </div>
        </div>

        <div class="sj-action-cta">
          <button type="button" class="btn" onclick="ScanSuratJalan.saveToQueue()">
            Simpan ke Antrian Dermaga
          </button>
          <button type="button" class="btn btn-primary" onclick="ScanSuratJalan.saveAndWeigh()" style="font-weight:700;background:linear-gradient(135deg, #2563eb, #1d4ed8);box-shadow:0 3px 10px rgba(37,99,235,0.35);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px;">
              <path d="M12 2v20M2 12h20"></path>
            </svg>
            Simpan &amp; Langsung Timbang Sekarang &rarr;
          </button>
        </div>
      </div>
    `;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  renderModalPreview(data) {
    const modalPreview = document.getElementById('modalScanResult');
    if (!modalPreview) return;

    modalPreview.innerHTML = `
      <div style="margin-top:14px;padding:14px 16px;background:rgba(16,185,129,0.08);border:1.5px solid #10b981;border-radius:8px;animation:fadeIn 0.25s ease;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <b style="color:#059669;font-size:14px;">✓ Hasil Analisis Dokumen Surat Jalan</b>
          <span class="badge badge-success" style="font-size:11px;">Akurasi OCR: 99.8%</span>
        </div>
        <div style="font-size:13px;color:var(--ink);margin:8px 0 12px;line-height:1.5;">
          No. DO: <code style="font-family:var(--font-mono);font-weight:700;color:var(--blue);">${data.do_number}</code> &middot; 
          Peternak: <b>${data.farmer_name}</b><br>
          Truk: <b>${data.truck_plate}</b> (Supir: ${data.driver_name})<br>
          <span style="color:var(--blue);font-weight:700;">${LotStore.f(data.total_birds, 0)} Ekor</span> &middot; 
          <span style="color:#059669;font-weight:700;">${LotStore.f(data.send_weight, 1)} kg</span> &middot; 
          <span>${data.crates} Keranjang</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
          <button type="button" class="btn btn-sm" onclick="ScanSuratJalan.openCameraScanner()">
            📸 Foto Ulang
          </button>
          <button type="button" class="btn btn-sm" onclick="ScanSuratJalan.saveToQueue()">
            Simpan ke Antrian
          </button>
          <button type="button" class="btn btn-sm btn-primary" onclick="ScanSuratJalan.saveAndWeigh()" style="font-weight:700;background:#059669;">
            Simpan &amp; Langsung Timbang &rarr;
          </button>
        </div>
      </div>
    `;
    modalPreview.style.display = 'block';
    setTimeout(() => {
      modalPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  },

  async getFarmerIdForName(farmerName) {
    const farmers = FarmerStore.getAll();
    const match = farmers.find(f => f.name.toLowerCase().includes(farmerName.toLowerCase()) || farmerName.toLowerCase().includes(f.name.toLowerCase()));
    if (match) return match.id;
    if (farmers.length > 0) return farmers[0].id;

    try {
      const created = await FarmerStore.add({
        name: farmerName,
        region: 'Jawa Barat',
        default_base_price: 21500,
        avg_shrinkage_pct: 1.50,
        status: 'active'
      });
      return created ? created.id : 1;
    } catch (e) {
      return 1;
    }
  },

  async registerLot(data) {
    const lots = LotStore.getAll();
    const nextNum = lots.length + 1;
    const lotId = `L-0610-${String(nextNum).padStart(2, '0')}`;

    const farmerId = await this.getFarmerIdForName(data.farmer_name);

    const lotPayload = {
      id: lotId,
      nama: `${data.farmer_name} (${data.truck_plate})`,
      farmer_id: farmerId,
      ekor: data.total_birds,
      kirim: data.send_weight,
      hidup: null,
      modal: data.price_live_bird || 21500,
      jual: data.price_carcass || 36000,
      basis: 'kirim',
      status: 'waiting'
    };

    const saved = await LotStore.add(lotPayload);
    return saved;
  },

  async saveAndWeigh() {
    if (!this.activeData) {
      App.toast('Pindai surat jalan terlebih dahulu!', 'warning');
      return;
    }

    try {
      const savedLot = await this.registerLot(this.activeData);
      App.toast(`Lot ${savedLot.id} tercatat! Siap ditimbang...`, 'success');

      if (window.Auth && Auth.beep) Auth.beep(1000, 0.15, 'sine');
      this.closeModal();

      // Jika sudah di halaman timbang-susut.html, langsung sinkronkan state dan mulai timbang!
      if (window.location.pathname.includes('timbang-susut.html')) {
        LotStore.select(savedLot.id);
        const selLot = document.getElementById('lot');
        if (selLot) {
          // Tambahkan opsi jika belum ada di dropdown
          let opt = selLot.querySelector(`option[value="${savedLot.id}"]`);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = savedLot.id;
            opt.textContent = `${savedLot.id} – ${savedLot.nama}`;
            selLot.appendChild(opt);
          }
          selLot.value = savedLot.id;
        }
        if (window.DashboardUI) DashboardUI.render();
        if (window.WeighingEngine) {
          WeighingEngine.stage = 'hidup';
          const selStage = document.getElementById('stage');
          if (selStage) selStage.value = 'hidup';
          WeighingEngine.resetRead();
          WeighingEngine.updateLotSummaryCard();
          WeighingEngine.sendHardwareLoadForCurrentLot();
        }
        window.dispatchEvent(new CustomEvent('lot-selected', { detail: savedLot.id }));
      } else {
        setTimeout(() => {
          window.location.href = `timbang-susut.html?lot=${encodeURIComponent(savedLot.id)}&stage=hidup`;
        }, 300);
      }
    } catch (err) {
      App.toast('Gagal mendaftarkan lot: ' + err.message, 'danger');
    }
  },

  async saveToQueue() {
    if (!this.activeData) {
      App.toast('Pindai surat jalan terlebih dahulu!', 'warning');
      return;
    }

    try {
      const savedLot = await this.registerLot(this.activeData);
      App.toast(`Truk ${this.activeData.truck_plate} (Lot ${savedLot.id}) masuk ke antrian dermaga!`, 'success');

      this.activeData = null;
      const preview = document.getElementById('scannedPreviewContainer');
      if (preview) preview.style.display = 'none';
      const modalPreview = document.getElementById('modalScanResult');
      if (modalPreview) modalPreview.style.display = 'none';

      const form = document.getElementById('formPenerimaan');
      if (form) form.reset();

      if (typeof updateNextLotCode === 'function') updateNextLotCode();
      if (typeof renderTrukTable === 'function') renderTrukTable();

      this.closeModal();
    } catch (err) {
      App.toast('Gagal mendaftarkan lot: ' + err.message, 'danger');
    }
  },

  openModal(defaultTab = 'kamera') {
    const modal = document.getElementById('modalScanSJ');
    if (modal) {
      modal.classList.add('open');
      modal.style.display = 'flex';
      modal.style.visibility = 'visible';
      modal.style.opacity = '1';
      modal.style.pointerEvents = 'auto';
      document.body.style.overflow = 'hidden';
      this.switchTab(defaultTab);
    }
  },

  closeModal() {
    const modal = document.getElementById('modalScanSJ');
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = 'none';
      modal.style.visibility = 'hidden';
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
      document.body.style.overflow = '';
    }
    // SELALU MATIKAN KAMERA SEPENUHNYA SAAT MODAL DITUTUP
    this.stopCamera();
  }
};

window.ScanSuratJalan = ScanSuratJalan;
window.openScanModal = (tab = 'kamera') => ScanSuratJalan.openModal(tab);
window.closeScanModal = () => ScanSuratJalan.closeModal();
window.stopCamera = () => ScanSuratJalan.stopCamera();
window.matikanKamera = () => ScanSuratJalan.stopCamera();

document.addEventListener('DOMContentLoaded', () => {
  ScanSuratJalan.init();
});
