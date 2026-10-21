/**
 * Modul Produksi Karkas & Parting / Cutting Line RPHU
 * Sistem Timbang & Susut RPHU Modern
 */

const ProductionStore = {
  STORAGE_KEY: 'rphu-production-cuttings',

  CUT_TYPES: {
    'parting_4': { label: 'Parting 4 Potong (2 Dada + 2 Paha)', stdYield: 98.0 },
    'parting_8': { label: 'Parting 8 Potong (Standar Resto / QSR)', stdYield: 97.0 },
    'parting_10': { label: 'Parting 10 Potong (Katering & Horeka)', stdYield: 96.5 },
    'boneless_fillet': { label: 'Boneless Fillet (BLD Dada & BLP Paha)', stdYield: 64.0 },
    'mixed_cuts': { label: 'Potongan Campur Retail (Wings, Drumstick, Paha Atas)', stdYield: 95.0 }
  },

  cuttings: [],

  async init() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.cuttings = JSON.parse(stored);
      }
      // Fetch from API
      const res = await Api.get('/production/cuttings');
      if (res && res.success && Array.isArray(res.data)) {
        this.cuttings = res.data;
        this.save();
      }
    } catch (e) {
      console.warn('Gagal inisialisasi ProductionStore:', e);
    }
  },

  getAll() {
    return this.cuttings;
  },

  getById(id) {
    return this.cuttings.find(c => String(c.id) === String(id) || c.cutting_code === String(id));
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cuttings));
    } catch (e) {}
  },

  async add(data) {
    const inputKg = parseFloat(data.input_carcass_kg) || 0;
    const mainKg = parseFloat(data.output_main_kg) || 0;
    const byKg = parseFloat(data.output_byproduct_kg) || 0;
    const totalOut = mainKg + byKg;
    const lossKg = Math.max(0, +(inputKg - totalOut).toFixed(2));
    const yieldPct = inputKg > 0 ? +((mainKg / inputKg) * 100).toFixed(2) : 0;

    const nextId = (this.cuttings.reduce((max, c) => Math.max(max, parseInt(c.id) || 0), 0)) + 1;
    const cuttingCode = data.cutting_code || `CUT-202610-${String(nextId).padStart(3, '0')}`;

    const newRecord = {
      id: nextId,
      cutting_code: cuttingCode,
      lot_id: data.lot_id,
      cut_type: data.cut_type,
      input_carcass_kg: inputKg,
      output_main_kg: mainKg,
      output_byproduct_kg: byKg,
      cutting_loss_kg: lossKg,
      yield_cutting_pct: yieldPct,
      cuts_breakdown: data.cuts_breakdown || {},
      package_count: parseInt(data.package_count) || 0,
      room_temperature: parseFloat(data.room_temperature) || 12.0,
      operator_name: data.operator_name || (JSON.parse(localStorage.getItem('rphu-user') || '{}').name || 'Operator Produksi'),
      notes: data.notes || '',
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    this.cuttings.unshift(newRecord);
    this.save();

    // Call API non-blocking
    try {
      await Api.post('/production/cuttings', newRecord);
    } catch (e) {}

    return newRecord;
  },

  getSummary() {
    const totalInput = this.cuttings.reduce((sum, c) => sum + (parseFloat(c.input_carcass_kg) || 0), 0);
    const totalOutput = this.cuttings.reduce((sum, c) => sum + (parseFloat(c.output_main_kg) || 0), 0);
    const totalBy = this.cuttings.reduce((sum, c) => sum + (parseFloat(c.output_byproduct_kg) || 0), 0);
    const totalLoss = this.cuttings.reduce((sum, c) => sum + (parseFloat(c.cutting_loss_kg) || 0), 0);
    const totalPackages = this.cuttings.reduce((sum, c) => sum + (parseInt(c.package_count) || 0), 0);
    const avgLossPct = totalInput > 0 ? (totalLoss / totalInput * 100) : 0;
    const avgYieldPct = totalInput > 0 ? (totalOutput / totalInput * 100) : 0;

    return {
      totalInput,
      totalOutput,
      totalBy,
      totalLoss,
      totalPackages,
      avgLossPct,
      avgYieldPct,
      batchCount: this.cuttings.length
    };
  }
};

const ProduksiUI = {
  async init() {
    await LotStore.init();
    await ProductionStore.init();

    this.renderKPIs();
    this.renderLotTable();
    this.renderCuttingTable();
    this.bindEvents();
    this.checkUrlParams();
  },

  renderKPIs() {
    const lots = LotStore.getAll();
    const sumCuttings = ProductionStore.getSummary();

    // 1. Total Karkas Basah Hari Ini
    const totalBasah = lots.reduce((acc, l) => acc + (parseFloat(l.basah) || 0), 0);
    const totalHidup = lots.reduce((acc, l) => acc + (parseFloat(l.hidup) || 0), 0);
    const yieldBasahAvg = totalHidup > 0 ? (totalBasah / totalHidup * 100) : 70.27;

    const kpiYieldEl = document.getElementById('kpiYield');
    if (kpiYieldEl) {
      kpiYieldEl.textContent = `${yieldBasahAvg.toFixed(2)}%`;
    }

    const kpiBasahEl = document.getElementById('kpiTotalBasah');
    if (kpiBasahEl) {
      kpiBasahEl.textContent = `${LotStore.f(totalBasah, 0)} kg`;
    }

    // 2. Total Hasil Cutting Siap Kemas
    const kpiCuttingEl = document.getElementById('kpiTotalCutting');
    if (kpiCuttingEl) {
      kpiCuttingEl.textContent = `${LotStore.f(sumCuttings.totalOutput, 1)} kg`;
    }

    const kpiPackEl = document.getElementById('kpiTotalPack');
    if (kpiPackEl) {
      kpiPackEl.textContent = `${LotStore.f(sumCuttings.totalPackages, 0)} Pack`;
    }
  },

  renderLotTable() {
    const tbody = document.getElementById('productionLotTableBody');
    if (!tbody) return;

    const lots = LotStore.getAll();
    if (!lots.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--mute);">Belum ada data lot pemotongan.</td></tr>';
      return;
    }

    tbody.innerHTML = lots.map(l => {
      let hidupStr = l.hidup != null ? `${LotStore.f(l.hidup, 0)} kg` : '–';
      let basahStr = l.basah != null ? `${LotStore.f(l.basah, 0)} kg` : '–';
      let yieldStr = '–';
      let statusBadge = '';
      let aksiBtn = '';

      if (l.basah != null && l.basah > 0) {
        const y = l.hidup > 0 ? (l.basah / l.hidup * 100) : 0;
        yieldStr = `<span class="pos" style="font-weight:700;">${y.toFixed(2)}%</span>`;
        statusBadge = `<span class="badge badge-success">Selesai Eviscerasi</span>`;
        
        // Aksi: Jika sudah ada bobot dingin, bisa langsung Catat Cutting
        if (l.dingin != null && l.dingin > 0) {
          aksiBtn = `
            <div style="display:flex;gap:6px;align-items:center;justify-content:center;">
              <a href="cold-storage.html" class="btn btn-sm">Chiller</a>
              <button class="btn btn-primary btn-sm" onclick="ProduksiUI.openCreateCuttingModal('${l.id}')">
                Catat Cutting
              </button>
            </div>
          `;
        } else {
          aksiBtn = `<a href="cold-storage.html" class="btn btn-sm">
            Masuk Chiller
          </a>`;
        }
      } else if (l.hidup != null && l.hidup > 0) {
        statusBadge = `<span class="badge badge-info">Shackle Line</span>`;
        aksiBtn = `<a href="timbang-susut.html?lot=${l.id}&stage=basah" class="btn btn-primary btn-sm">
          Timbang Basah
        </a>`;
      } else {
        statusBadge = `<span class="badge badge-warning">Menunggu Bongkar</span>`;
        aksiBtn = `<a href="penerimaan-ayam.html" class="btn btn-sm">Ke Penerimaan</a>`;
      }

      return `
        <tr>
          <td class="text-left"><code style="font-weight:700;color:var(--ink);">${l.id}</code></td>
          <td class="text-left" style="font-weight:600;color:var(--ink);">${l.nama}</td>
          <td class="text-right">${LotStore.f(l.ekor, 0)} ekor</td>
          <td class="text-right">${hidupStr}</td>
          <td class="text-right" style="font-weight:600;">${basahStr}</td>
          <td class="text-right">${yieldStr}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center">${aksiBtn}</td>
        </tr>
      `;
    }).join('');
  },

  renderCuttingTable() {
    const tbody = document.getElementById('cuttingTableBody');
    if (!tbody) return;

    const list = ProductionStore.getAll();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--mute);">Belum ada pencatatan hasil cutting / parting karkas hari ini. Silakan klik tombol <b>"+ Catat Hasil Cutting"</b> di atas.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(c => {
      const typeDef = ProductionStore.CUT_TYPES[c.cut_type] || { label: c.cut_type };
      const lossPct = c.input_carcass_kg > 0 ? (c.cutting_loss_kg / c.input_carcass_kg * 100) : 0;
      const isNormalLoss = lossPct <= 2.5;

      // Breakdown preview text
      let bkdText = '';
      if (c.cuts_breakdown && typeof c.cuts_breakdown === 'object') {
        const entries = Object.entries(c.cuts_breakdown).filter(([k, v]) => parseFloat(v) > 0);
        bkdText = entries.map(([k, v]) => `<span style="display:inline-block;background:var(--panel-alt);padding:2px 6px;border-radius:4px;font-size:11px;margin:2px 2px 2px 0;border:1px solid var(--line);"><b>${k.toUpperCase()}:</b> ${v} kg</span>`).join(' ');
      }

      return `
        <tr>
          <td class="text-left"><code style="font-weight:700;color:var(--ink);">${c.cutting_code}</code></td>
          <td class="text-left"><a href="cold-storage.html" style="font-weight:600;color:var(--blue);text-decoration:none;">${c.lot_id}</a></td>
          <td class="text-left">
            <div style="font-weight:600;color:var(--ink);">${typeDef.label}</div>
            <div style="margin-top:3px;">${bkdText}</div>
          </td>
          <td class="text-right" style="font-weight:600;">${LotStore.f(c.input_carcass_kg, 1)} kg</td>
          <td class="text-right" style="font-weight:700;color:var(--green);">${LotStore.f(c.output_main_kg, 1)} kg</td>
          <td class="text-right">${LotStore.f(c.output_byproduct_kg, 1)} kg</td>
          <td class="text-right">
            <span class="${isNormalLoss ? 'pos' : 'neg'}" style="font-weight:600;">
              ${LotStore.f(c.cutting_loss_kg, 1)} kg (${lossPct.toFixed(2)}%)
            </span>
          </td>
          <td class="text-center">
            <span class="badge badge-neutral">${c.package_count} Pack (${c.yield_cutting_pct}%)</span>
          </td>
          <td class="text-center">
            <div style="display:flex;gap:4px;align-items:center;justify-content:center;">
              <button class="btn btn-sm" onclick="ProduksiUI.openLabelModal('${c.id}')" title="Cetak Label Kemasan & Barcode">
                Label
              </button>
              <button class="btn btn-sm" onclick="ProduksiUI.openDetailModal('${c.id}')" title="Rincian Potongan">
                Detail
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  bindEvents() {
    const btnOpenCutting = document.getElementById('btnOpenCuttingModal');
    if (btnOpenCutting) {
      btnOpenCutting.addEventListener('click', () => this.openCreateCuttingModal());
    }

    // Modal submit listener
    const formCutting = document.getElementById('formCuttingKarkas');
    if (formCutting) {
      formCutting.addEventListener('submit', (e) => this.handleSaveCutting(e));
    }

    // Live auto-calculation on cut inputs
    const inputsToWatch = ['cutInputKg', 'cutBld', 'cutBlp', 'cutWings', 'cutDrum', 'cutKerongkong', 'cutHatiAmpela', 'cutKulit'];
    inputsToWatch.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.recalcCuttingLive());
      }
    });

    // Lot select change listener
    const selLot = document.getElementById('cutLotId');
    if (selLot) {
      selLot.addEventListener('change', () => {
        const lotId = selLot.value;
        const lot = LotStore.getById(lotId);
        const inputKgEl = document.getElementById('cutInputKg');
        if (lot && inputKgEl) {
          const availKg = lot.dingin || lot.basah || 500.0;
          inputKgEl.value = availKg;
          this.recalcCuttingLive();
        }
      });
    }
  },

  checkUrlParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const lot = params.get('lot');
      const action = params.get('action');
      if (lot && (action === 'cut' || action === 'cutting')) {
        setTimeout(() => {
          this.openCreateCuttingModal(lot);
        }, 300);
      }
    } catch (e) {}
  },

  openCreateCuttingModal(preselectedLotId = null) {
    if (!Auth.can('record_weight') && !Auth.can('create_lot')) {
      App.toast('Otorisasi: Anda tidak memiliki akses input pemotongan produksi.', 'warning');
      return;
    }

    const modal = document.getElementById('cuttingModal');
    if (!modal) return;

    // Populate lots that have carcass
    const selLot = document.getElementById('cutLotId');
    if (selLot) {
      const lots = LotStore.getAll();
      const readyLots = lots.filter(l => (l.dingin != null && l.dingin > 0) || (l.basah != null && l.basah > 0));
      const targetLots = readyLots.length ? readyLots : lots;

      selLot.innerHTML = targetLots.map(l => {
        const avail = l.dingin ? `${l.dingin} kg (Dingin)` : (l.basah ? `${l.basah} kg (Basah)` : '');
        return `<option value="${l.id}" ${l.id === preselectedLotId ? 'selected' : ''}>${l.id} - ${l.nama} ${avail ? `[${avail}]` : ''}</option>`;
      }).join('');

      // Auto-set initial input weight
      const chosenLot = LotStore.getById(selLot.value) || targetLots[0];
      const inputKgEl = document.getElementById('cutInputKg');
      if (chosenLot && inputKgEl && !inputKgEl.value) {
        inputKgEl.value = chosenLot.dingin || chosenLot.basah || 500;
      }
    }

    // Generate cutting code
    const list = ProductionStore.getAll();
    const codeEl = document.getElementById('cutCode');
    if (codeEl) {
      codeEl.value = `CUT-202610-${String(list.length + 1).padStart(3, '0')}`;
    }

    this.recalcCuttingLive();
    modal.classList.add('open');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  },

  closeModal(modalId) {
    if (modalId) {
      const m = document.getElementById(modalId);
      if (m) {
        m.classList.remove('open');
        m.classList.remove('show');
      }
    } else {
      document.querySelectorAll('.modal-backdrop').forEach(m => {
        m.classList.remove('open');
        m.classList.remove('show');
      });
    }
    document.body.style.overflow = '';
  },

  recalcCuttingLive() {
    const inputKg = parseFloat(document.getElementById('cutInputKg')?.value) || 0;
    const bld = parseFloat(document.getElementById('cutBld')?.value) || 0;
    const blp = parseFloat(document.getElementById('cutBlp')?.value) || 0;
    const wings = parseFloat(document.getElementById('cutWings')?.value) || 0;
    const drum = parseFloat(document.getElementById('cutDrum')?.value) || 0;
    const kerongkong = parseFloat(document.getElementById('cutKerongkong')?.value) || 0;
    const hati = parseFloat(document.getElementById('cutHatiAmpela')?.value) || 0;
    const kulit = parseFloat(document.getElementById('cutKulit')?.value) || 0;

    const mainOut = +(bld + blp + wings + drum).toFixed(2);
    const byOut = +(kerongkong + hati + kulit).toFixed(2);
    const totalOut = +(mainOut + byOut).toFixed(2);
    const lossKg = Math.max(0, +(inputKg - totalOut).toFixed(2));
    const lossPct = inputKg > 0 ? (lossKg / inputKg * 100) : 0;
    const yieldPct = inputKg > 0 ? (mainOut / inputKg * 100) : 0;

    // Update UI elements
    const calcMainEl = document.getElementById('calcOutputMain');
    const calcByEl = document.getElementById('calcOutputBy');
    const calcLossEl = document.getElementById('calcLoss');
    const calcYieldEl = document.getElementById('calcYield');

    if (calcMainEl) calcMainEl.textContent = `${mainOut.toFixed(1)} kg`;
    if (calcByEl) calcByEl.textContent = `${byOut.toFixed(1)} kg`;
    if (calcLossEl) {
      calcLossEl.textContent = `${lossKg.toFixed(1)} kg (${lossPct.toFixed(2)}%)`;
      calcLossEl.style.color = lossPct <= 2.5 ? 'var(--green)' : 'var(--amber)';
    }
    if (calcYieldEl) {
      calcYieldEl.textContent = `${yieldPct.toFixed(2)}%`;
    }
  },

  async handleSaveCutting(e) {
    e.preventDefault();

    const code = document.getElementById('cutCode')?.value || 'CUT-000';
    const lotId = document.getElementById('cutLotId')?.value || 'L-0610-01';
    const cutType = document.getElementById('cutType')?.value || 'parting_8';
    const inputKg = parseFloat(document.getElementById('cutInputKg')?.value) || 0;

    const bld = parseFloat(document.getElementById('cutBld')?.value) || 0;
    const blp = parseFloat(document.getElementById('cutBlp')?.value) || 0;
    const wings = parseFloat(document.getElementById('cutWings')?.value) || 0;
    const drum = parseFloat(document.getElementById('cutDrum')?.value) || 0;
    const kerongkong = parseFloat(document.getElementById('cutKerongkong')?.value) || 0;
    const hati = parseFloat(document.getElementById('cutHatiAmpela')?.value) || 0;
    const kulit = parseFloat(document.getElementById('cutKulit')?.value) || 0;

    const mainKg = +(bld + blp + wings + drum).toFixed(2);
    const byKg = +(kerongkong + hati + kulit).toFixed(2);

    if (inputKg <= 0 || mainKg <= 0) {
      App.toast('Mohon lengkapi bobot bahan baku karkas dan hasil potongan utama!', 'warning');
      return;
    }

    const pkgCount = parseInt(document.getElementById('cutPackageCount')?.value) || Math.round(mainKg / 2.0);
    const roomTemp = parseFloat(document.getElementById('cutRoomTemp')?.value) || 12.0;
    const notes = document.getElementById('cutNotes')?.value || '';

    const newCutData = {
      cutting_code: code,
      lot_id: lotId,
      cut_type: cutType,
      input_carcass_kg: inputKg,
      output_main_kg: mainKg,
      output_byproduct_kg: byKg,
      package_count: pkgCount,
      room_temperature: roomTemp,
      notes: notes,
      cuts_breakdown: {
        fillet_bld: bld,
        fillet_blp: blp,
        sayap_wings: wings,
        paha_drumstick: drum,
        kerongkong: kerongkong,
        hati_ampela: hati,
        kulit: kulit
      }
    };

    const saved = await ProductionStore.add(newCutData);
    App.toast(`Batch cutting ${saved.cutting_code} berhasil disimpan!`, 'success');

    this.closeModal('cuttingModal');
    this.renderKPIs();
    this.renderCuttingTable();
  },

  openDetailModal(id) {
    const cut = ProductionStore.getById(id);
    if (!cut) return;

    const modal = document.getElementById('detailCuttingModal');
    const content = document.getElementById('detailCuttingContent');
    if (!modal || !content) return;

    const typeDef = ProductionStore.CUT_TYPES[cut.cut_type] || { label: cut.cut_type };
    const lossPct = cut.input_carcass_kg > 0 ? (cut.cutting_loss_kg / cut.input_carcass_kg * 100) : 0;

    let bkdRows = '';
    if (cut.cuts_breakdown && typeof cut.cuts_breakdown === 'object') {
      bkdRows = Object.entries(cut.cuts_breakdown)
        .filter(([k, v]) => parseFloat(v) > 0)
        .map(([k, v]) => `
          <tr>
            <td style="text-transform:capitalize;">${k.replace('_', ' ')}</td>
            <td style="text-align:right;font-weight:700;">${LotStore.f(parseFloat(v), 2)} kg</td>
          </tr>
        `).join('');
    }

    content.innerHTML = `
      <div style="background:var(--zebra);padding:14px;border-radius:8px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:12px;color:var(--mute);">KODE BATCH CUTTING</span>
            <h3 style="margin:2px 0;font-size:18px;color:var(--ink);">${cut.cutting_code}</h3>
          </div>
          <span class="badge badge-success">Terverifikasi Produksi</span>
        </div>
        <div style="font-size:12.5px;color:var(--ink-secondary);margin-top:6px;">
          Lot Asal: <b>${cut.lot_id}</b> | Jenis: <b>${typeDef.label}</b> | Waktu: <b>${cut.created_at}</b>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
        <div style="background:var(--panel-alt);border:1px solid var(--line);padding:10px;border-radius:6px;text-align:center;">
          <div style="font-size:11px;color:var(--mute);">Bahan Baku</div>
          <div style="font-size:16px;font-weight:700;">${LotStore.f(cut.input_carcass_kg, 1)} kg</div>
        </div>
        <div style="background:var(--panel-alt);border:1px solid var(--line);padding:10px;border-radius:6px;text-align:center;">
          <div style="font-size:11px;color:var(--mute);">Produk Utama</div>
          <div style="font-size:16px;font-weight:700;color:var(--green);">${LotStore.f(cut.output_main_kg, 1)} kg</div>
        </div>
        <div style="background:var(--panel-alt);border:1px solid var(--line);padding:10px;border-radius:6px;text-align:center;">
          <div style="font-size:11px;color:var(--mute);">By-Product</div>
          <div style="font-size:16px;font-weight:700;">${LotStore.f(cut.output_byproduct_kg, 1)} kg</div>
        </div>
        <div style="background:var(--panel-alt);border:1px solid var(--line);padding:10px;border-radius:6px;text-align:center;">
          <div style="font-size:11px;color:var(--mute);">Cutting Loss</div>
          <div style="font-size:16px;font-weight:700;color:var(--amber);">${LotStore.f(cut.cutting_loss_kg, 1)} kg (${lossPct.toFixed(2)}%)</div>
        </div>
      </div>

      <h4 style="margin:12px 0 6px;font-size:13px;text-transform:uppercase;color:var(--mute);">Rincian Hasil Timbang Potongan</h4>
      <table style="width:100%;margin-bottom:16px;">
        <thead>
          <tr style="background:var(--zebra);">
            <th class="text-left">Komponen Potongan</th>
            <th class="text-right">Bobot Bersih</th>
          </tr>
        </thead>
        <tbody>
          ${bkdRows || '<tr><td colspan="2" style="text-align:center;">Data rincian tidak tersedia.</td></tr>'}
        </tbody>
      </table>

      <div style="font-size:12.5px;color:var(--mute);display:flex;justify-content:space-between;border-top:1px dashed var(--line);padding-top:10px;">
        <span>Suhu Ruang Parting: <b>${cut.room_temperature}°C</b></span>
        <span>Operator: <b>${cut.operator_name}</b></span>
        <span>Total Kemasan: <b>${cut.package_count} Pack</b></span>
      </div>
    `;

    modal.classList.add('open');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  },

  openLabelModal(id) {
    const cut = ProductionStore.getById(id);
    if (!cut) return;

    const modal = document.getElementById('labelModal');
    const container = document.getElementById('labelPrintContainer');
    if (!modal || !container) return;

    const typeDef = ProductionStore.CUT_TYPES[cut.cut_type] || { label: cut.cut_type };
    const now = new Date();
    const expDate = new Date();
    expDate.setDate(now.getDate() + 3); // Chilled +3 hari

    const tglProduksi = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const tglExp = expDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

    container.innerHTML = `
      <div style="border:2px solid #0f172a;padding:16px;border-radius:8px;background:#ffffff;color:#0f172a;max-width:380px;margin:0 auto;font-family:sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:8px;">
          <div>
            <div style="font-weight:900;font-size:16px;letter-spacing:1px;color:#0b57a4;">RPHU MODERN</div>
            <div style="font-size:10px;font-weight:700;color:#64748b;">POULTRY PROCESSING</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:700;border:1px solid #16a34a;color:#16a34a;padding:2px 6px;border-radius:4px;display:inline-block;">
              HALAL ID0041000000000
            </div>
            <div style="font-size:9px;color:#64748b;margin-top:2px;">NKV: RPHU-3216-001</div>
          </div>
        </div>

        <div style="text-align:center;margin:8px 0;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Produk Karkas Ayam Segar</div>
          <div style="font-size:16px;font-weight:800;color:#0f172a;margin-top:2px;">${typeDef.label}</div>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px;border-radius:6px;margin:10px 0;font-size:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:#64748b;">Kode Batch:</span>
            <b style="font-family:monospace;font-size:13px;">${cut.cutting_code}</b>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:#64748b;">Lot Penerimaan:</span>
            <b>${cut.lot_id}</b>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:#64748b;">Tgl Produksi:</span>
            <b>${tglProduksi}</b>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#64748b;">Baik Digunakan Sebelum:</span>
            <b style="color:#dc2626;">${tglExp}</b>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 8px;">
          <div>
            <div style="font-size:10px;color:#64748b;">BERAT TOTAL BATCH</div>
            <div style="font-size:20px;font-weight:900;color:#0f172a;">${LotStore.f(cut.output_main_kg, 1)} <span style="font-size:13px;">kg</span></div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:#64748b;">ISI KEMASAN</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;">${cut.package_count} <span style="font-size:12px;">Pack</span></div>
          </div>
        </div>

        <!-- Simulated Barcode SVG -->
        <div style="text-align:center;margin-top:10px;padding-top:8px;border-top:1px dashed #cbd5e1;">
          <svg width="220" height="42" viewBox="0 0 220 42">
            <rect x="10" y="0" width="3" height="32" fill="#000"/>
            <rect x="16" y="0" width="2" height="32" fill="#000"/>
            <rect x="22" y="0" width="5" height="32" fill="#000"/>
            <rect x="30" y="0" width="2" height="32" fill="#000"/>
            <rect x="36" y="0" width="4" height="32" fill="#000"/>
            <rect x="44" y="0" width="2" height="32" fill="#000"/>
            <rect x="50" y="0" width="6" height="32" fill="#000"/>
            <rect x="60" y="0" width="2" height="32" fill="#000"/>
            <rect x="66" y="0" width="3" height="32" fill="#000"/>
            <rect x="74" y="0" width="5" height="32" fill="#000"/>
            <rect x="84" y="0" width="3" height="32" fill="#000"/>
            <rect x="92" y="0" width="4" height="32" fill="#000"/>
            <rect x="100" y="0" width="2" height="32" fill="#000"/>
            <rect x="106" y="0" width="6" height="32" fill="#000"/>
            <rect x="116" y="0" width="3" height="32" fill="#000"/>
            <rect x="124" y="0" width="2" height="32" fill="#000"/>
            <rect x="130" y="0" width="5" height="32" fill="#000"/>
            <rect x="140" y="0" width="3" height="32" fill="#000"/>
            <rect x="148" y="0" width="4" height="32" fill="#000"/>
            <rect x="156" y="0" width="2" height="32" fill="#000"/>
            <rect x="162" y="0" width="6" height="32" fill="#000"/>
            <rect x="172" y="0" width="3" height="32" fill="#000"/>
            <rect x="180" y="0" width="4" height="32" fill="#000"/>
            <rect x="188" y="0" width="2" height="32" fill="#000"/>
            <rect x="194" y="0" width="5" height="32" fill="#000"/>
            <rect x="204" y="0" width="3" height="32" fill="#000"/>
            <text x="110" y="42" font-family="monospace" font-size="10" text-anchor="middle" fill="#475569">*${cut.cutting_code}*</text>
          </svg>
          <div style="font-size:9.5px;color:#64748b;margin-top:4px;">
            Simpan pada suhu dingin (0°C s/d 4°C) atau beku (≤ −18°C)
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  },

  printLabelContent() {
    window.print();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ProduksiUI.init();
});
