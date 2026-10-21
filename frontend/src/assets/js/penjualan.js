/**
 * Modul Penjualan & Penerbitan Surat Jalan (Delivery Order / DO) Karkas
 * Sistem Timbang & Susut RPHU Modern
 */

const SuratJalanStore = {
  STORAGE_KEY: 'rphu-surat-jalan',

  getDefaultData() {
    return [];
  },

  async init() {
    try {
      const res = await Api.get('/sales/delivery-orders');
      if (res && res.success && Array.isArray(res.data)) {
        this.save(res.data);
      }
    } catch (e) {}
  getAll() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Gagal membaca surat jalan dari localStorage', e);
    }
    const def = this.getDefaultData();
    this.save(def);
    return def;
  },

  getById(id) {
    const list = this.getAll();
    return list.find(s => s.id === id || s.invoice_no === id);
  },

  save(list) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  },

  add(item) {
    const list = this.getAll();
    list.unshift(item);
    this.save(list);
    try {
      Api.post('/sales/delivery-orders', item);
    } catch (e) {}
    return item;
  },

  delete(id) {
    let list = this.getAll();
    list = list.filter(s => s.id !== id);
    this.save(list);
  },

  updateStatus(id, newStatus) {
    const list = this.getAll();
    const item = list.find(s => s.id === id);
    if (item) {
      item.status = newStatus;
      item.status_label = newStatus === 'delivered' ? 'Selesai Terkirim' : (newStatus === 'in_transit' ? 'Truk Berangkat' : 'Siap Muat');
      this.save(list);
    }
  }
};

const PenjualanUI = {
  currentViewingId: null,

  async init() {
    await SuratJalanStore.init();
    this.bindEvents();
    this.populateLotDropdown();
    this.renderTable();
    this.updateKPIs();
  },

  bindEvents() {
    // Tombol buka modal Buat Surat Jalan
    const btnOpen = document.getElementById('btnOpenModalSuratJalan');
    if (btnOpen) {
      btnOpen.onclick = () => this.openCreateModal();
    }

    // Modal Close
    document.querySelectorAll('[data-close-modal]').forEach(b => {
      b.onclick = () => this.closeModals();
    });

    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.onclick = (e) => {
        if (e.target === modal) this.closeModals();
      };
    });

    // Auto calculate Total Tagihan
    const inputWeight = document.getElementById('sjWeightKg');
    const inputPrice = document.getElementById('sjPricePerKg');
    const displayTotal = document.getElementById('sjTotalDisplay');

    const recalc = () => {
      const w = parseFloat(inputWeight?.value) || 0;
      const p = parseFloat(inputPrice?.value) || 0;
      const total = w * p;
      if (displayTotal) {
        displayTotal.value = LotStore.rp(total);
      }
    };

    if (inputWeight) inputWeight.oninput = recalc;
    if (inputPrice) inputPrice.oninput = recalc;

    // Form Submit
    const form = document.getElementById('formSuratJalan');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        this.handleSaveSuratJalan();
      };
    }

    // Search table
    const searchInput = document.getElementById('searchSuratJalan');
    if (searchInput) {
      searchInput.oninput = (e) => this.renderTable(e.target.value.toLowerCase().trim());
    }

    // Tombol Cetak dari Modal Preview
    const btnPrintDoc = document.getElementById('btnPrintSuratJalanDoc');
    if (btnPrintDoc) {
      btnPrintDoc.onclick = () => window.print();
    }
  },

  populateLotDropdown() {
    const sel = document.getElementById('sjLotId');
    if (!sel) return;

    let lots = [];
    if (typeof LotStore !== 'undefined') {
      lots = LotStore.getAll();
    }

    // Filter lot yang punya karkas dingin atau aktif
    sel.innerHTML = lots.map(l => {
      const dinginText = l.dingin ? `${LotStore.f(l.dingin, 0)} kg dingin` : 'Proses Chilling';
      return `<option value="${l.id}">${l.id} – ${l.nama} (${dinginText})</option>`;
    }).join('');

    if (!lots.length) {
      sel.innerHTML = `
        <option value="L-0610-01">L-0610-01 – Pak Sumarno (3.438 kg dingin)</option>
        <option value="L-0610-04">L-0610-04 – CV Sinar Kandang (3.911 kg basah)</option>
      `;
    }
  },

  openCreateModal() {
    const modal = document.getElementById('modalSuratJalan');
    const form = document.getElementById('formSuratJalan');
    if (form) form.reset();

    // Auto ID Surat Jalan
    const all = SuratJalanStore.getAll();
    const nextNum = all.length + 1;
    const sjId = `SJ-202610-${String(nextNum).padStart(3, '0')}`;
    const invId = `INV-2026-${String(nextNum).padStart(3, '0')}`;

    const elNum = document.getElementById('sjNumber');
    if (elNum) elNum.value = sjId;

    const elInv = document.getElementById('sjInvoice');
    if (elInv) elInv.value = invId;

    const todayStr = new Date().toISOString().substring(0, 10);
    const elDate = document.getElementById('sjDate');
    if (elDate) elDate.value = todayStr;

    // Default values
    const elPrice = document.getElementById('sjPricePerKg');
    if (elPrice) elPrice.value = 36000;

    const elTemp = document.getElementById('sjChillerTemp');
    if (elTemp) elTemp.value = 2.8;

    const elTotal = document.getElementById('sjTotalDisplay');
    if (elTotal) elTotal.value = 'Rp 0';

    this.populateLotDropdown();
    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const elCust = document.getElementById('sjCustomer');
      if (elCust) elCust.focus();
    }, 80);
  },

  closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    document.body.style.overflow = '';
  },

  async handleSaveSuratJalan() {
    const id = (document.getElementById('sjNumber')?.value || '').trim();
    const invoice_no = (document.getElementById('sjInvoice')?.value || '').trim();
    const date = document.getElementById('sjDate')?.value || new Date().toISOString().substring(0, 10);
    const customer = (document.getElementById('sjCustomer')?.value || '').trim();
    const destination = (document.getElementById('sjDestination')?.value || '').trim();
    const lot_id = document.getElementById('sjLotId')?.value || 'L-0610-01';
    const product_name = document.getElementById('sjProduct')?.value || 'Karkas Ayam Segar Dingin';
    const birds = parseInt(document.getElementById('sjBirds')?.value) || 0;
    const boxes = parseInt(document.getElementById('sjBoxes')?.value) || 0;
    const weight_kg = parseFloat(document.getElementById('sjWeightKg')?.value) || 0;
    const price_per_kg = parseFloat(document.getElementById('sjPricePerKg')?.value) || 36000;
    const total_amount = weight_kg * price_per_kg;
    const truck_plate = (document.getElementById('sjTruckPlate')?.value || '').trim();
    const driver_name = (document.getElementById('sjDriver')?.value || '').trim();
    const chiller_temp = parseFloat(document.getElementById('sjChillerTemp')?.value) || 3.0;
    const notes = (document.getElementById('sjNotes')?.value || '').trim();

    if (!customer || !weight_kg || weight_kg <= 0) {
      alert('Harap isi Nama Pelanggan dan Bobot Karkas (kg) dengan benar!');
      return;
    }

    const newSJ = {
      id,
      invoice_no,
      date,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      customer,
      destination,
      lot_id,
      product_name,
      birds,
      boxes,
      weight_kg,
      price_per_kg,
      total_amount,
      truck_plate,
      driver_name,
      chiller_temp,
      status: 'in_transit',
      status_label: 'Truk Berangkat',
      notes
    };

    SuratJalanStore.add(newSJ);

    // Catat ke Audit Log database SQLite
    try {
      if (typeof API !== 'undefined') {
        const currentUser = Auth.getCurrentUser();
        await API.post('/api/v1/logs', {
          user_id: currentUser.user_id,
          action_type: 'SURAT_JALAN_CREATED',
          target_table: 'sales_orders',
          target_id: id,
          old_value: null,
          new_value: `Penerbitan Surat Jalan ${id} (${customer}, ${LotStore.f(weight_kg, 1)} kg senilai ${LotStore.rp(total_amount)})`,
          ip_address: '127.0.0.1'
        });
      }
    } catch (e) {}

    Auth.beep(900, 0.12);
    App.toast(`Surat Jalan ${id} untuk ${customer} berhasil diterbitkan!`, 'success');

    this.closeModals();
    this.renderTable();
    this.updateKPIs();

    // Langsung tawarkan cetak dokumen
    setTimeout(() => {
      this.openPrintModal(id);
    }, 400);
  },

  renderTable(query = '') {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;

    let list = SuratJalanStore.getAll();
    if (query) {
      list = list.filter(s =>
        s.id.toLowerCase().includes(query) ||
        s.customer.toLowerCase().includes(query) ||
        s.lot_id.toLowerCase().includes(query) ||
        (s.truck_plate && s.truck_plate.toLowerCase().includes(query)) ||
        (s.driver_name && s.driver_name.toLowerCase().includes(query))
      );
    }

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--mute);">Tidak ada surat jalan yang cocok dengan pencarian.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((s, idx) => {
      let statusBadge = '';
      if (s.status === 'delivered') {
        statusBadge = '<span class="badge badge-success">Terkirim</span>';
      } else {
        statusBadge = '<span class="badge badge-info">Truk Berangkat</span>';
      }

      return `
        <tr>
          <td class="text-left">
            <b style="font-family:var(--font-mono);color:var(--blue);font-size:12.5px;">${s.id}</b>
            <div style="font-size:11px;color:var(--mute);">${s.date} · ${s.time || ''}</div>
          </td>
          <td class="text-left">
            <b style="color:var(--ink);font-size:13px;">${s.customer}</b>
            <div style="font-size:11.5px;color:var(--mute);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.destination || 'Ambil Sendiri di Pabrik'}</div>
          </td>
          <td class="text-left">
            <code style="background:var(--panel-alt);border:1px solid var(--line);padding:2px 6px;border-radius:3px;font-weight:700;">${s.lot_id}</code>
            <div style="font-size:11.5px;color:var(--mute);">${s.product_name}</div>
          </td>
          <td class="text-right" style="font-weight:700;font-family:var(--font-mono);font-size:13.5px;">
            ${LotStore.f(s.weight_kg, 1)} kg
            <div style="font-size:11.5px;color:var(--mute);font-family:var(--font-base);font-weight:400;">${s.birds ? LotStore.f(s.birds, 0) + ' ekor' : ''} ${s.boxes ? '(' + s.boxes + ' box)' : ''}</div>
          </td>
          <td class="text-right" style="font-family:var(--font-mono);font-size:12.5px;">${LotStore.rp(s.price_per_kg)}/kg</td>
          <td class="text-right" style="font-weight:700;font-family:var(--font-mono);color:var(--green);font-size:13.5px;">${LotStore.rp(s.total_amount)}</td>
          <td class="text-center">
            ${statusBadge}
            <div style="font-size:11px;color:var(--mute);margin-top:2px;">${s.truck_plate || '-'} · ${s.chiller_temp ? s.chiller_temp + '°C' : ''}</div>
          </td>
          <td class="text-center">
            <div style="display:inline-flex;gap:4px;justify-content:center;">
              <button class="btn-action-sm btn-action-edit" onclick="PenjualanUI.openPrintModal('${s.id}')" title="Cetak Surat Jalan Resmi">
                Cetak
              </button>
              <button class="btn-action-sm btn-action-delete" onclick="PenjualanUI.handleDeleteSuratJalan('${s.id}')" title="Hapus Surat Jalan">
                Hapus
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateKPIs() {
    const list = SuratJalanStore.getAll();
    const totalRealisasi = list.reduce((acc, s) => acc + (s.total_amount || 0), 0);
    const totalKg = list.reduce((acc, s) => acc + (s.weight_kg || 0), 0);
    const uniqueCustomers = new Set(list.map(s => s.customer)).size;

    const elTotalRev = document.getElementById('kpiTotalRealisasi');
    const elPrice = document.getElementById('kpiTotalKgJual');
    const elBuyers = document.getElementById('kpiMitraBuyer');

    if (elTotalRev) elTotalRev.textContent = LotStore.rp(totalRealisasi);
    if (elPrice) elPrice.textContent = `${LotStore.f(totalKg, 0)} kg Karkas`;
    if (elBuyers) elBuyers.textContent = `${uniqueCustomers} Pelanggan Aktif`;
  },

  openPrintModal(id) {
    const sj = SuratJalanStore.getById(id);
    if (!sj) return;

    this.currentViewingId = id;
    const modal = document.getElementById('modalPrintSuratJalan');

    // Isi template dokumen cetak
    document.getElementById('docSjNumber').textContent = sj.id;
    document.getElementById('docInvNumber').textContent = sj.invoice_no || '-';
    document.getElementById('docSjDate').textContent = `${sj.date} Pukul ${sj.time || '08:00'} WIB`;
    document.getElementById('docCustomerName').textContent = sj.customer;
    document.getElementById('docCustomerAddress').textContent = sj.destination || 'Gudang Pembeli';
    document.getElementById('docTruckPlate').textContent = sj.truck_plate || '-';
    document.getElementById('docDriverName').textContent = sj.driver_name || '-';
    document.getElementById('docChillerTemp').textContent = `${sj.chiller_temp || '3.0'} °C (Standar Rantai Dingin: Max 4°C)`;

    // Rincian Barang
    document.getElementById('docProductName').textContent = sj.product_name || 'Karkas Ayam Segar Dingin';
    document.getElementById('docLotOrigin').textContent = sj.lot_id || 'L-0610-01';
    document.getElementById('docQtyBoxes').textContent = `${sj.boxes || '-'} Keranjang`;
    document.getElementById('docQtyBirds').textContent = `${LotStore.f(sj.birds || 0, 0)} Ekor`;
    document.getElementById('docNetWeight').textContent = `${LotStore.f(sj.weight_kg, 1)} kg`;
    document.getElementById('docUnitPrice').textContent = LotStore.rp(sj.price_per_kg);
    document.getElementById('docTotalPrice').textContent = LotStore.rp(sj.total_amount);
    const footEl = document.getElementById('docTotalPriceFoot');
    if (footEl) footEl.textContent = LotStore.rp(sj.total_amount);

    document.getElementById('docNotes').textContent = sj.notes || 'Barang telah dicek dan diserahterimakan dalam kondisi segar rantai dingin tertutup.';

    // Kolom Tanda Tangan
    const user = Auth.getCurrentUser();
    document.getElementById('docSignAdmin').textContent = user.name || 'Supervisor RPHU';
    document.getElementById('docSignDriver').textContent = sj.driver_name || 'Pengemudi Ekspedisi';
    document.getElementById('docSignBuyer').textContent = sj.customer;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  handleDeleteSuratJalan(id) {
    if (!confirm(`Hapus Surat Jalan '${id}' dari sistem?`)) return;

    SuratJalanStore.delete(id);
    App.toast(`Surat Jalan ${id} berhasil dihapus`, 'info');
    Auth.beep(450, 0.1, 'square');
    this.renderTable();
    this.updateKPIs();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PenjualanUI.init();
});
