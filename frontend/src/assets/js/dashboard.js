/**
 * Dashboard & Workstation Data Presentation Controller
 */

const DashboardUI = {
  async init() {
    await LotStore.init();
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramLot = urlParams.get('lot');
      if (paramLot && LotStore.getById(paramLot)) {
        LotStore.select(paramLot);
      }
    } catch (e) {}

    this.bindInputs();
    this.render();

    window.addEventListener('lot-selected', () => this.render());
    window.addEventListener('lot-updated', () => this.render());
  },

  bindInputs() {
    const inputModal = document.getElementById('pm');
    const inputJual = document.getElementById('pj');
    const selectDasar = document.getElementById('ds');

    if (inputModal) {
      inputModal.addEventListener('input', () => {
        const lot = LotStore.getSelected();
        if (!lot) return;
        lot.modal = Math.max(0, parseFloat(inputModal.value) || 0);
        LotStore.save();
        this.renderLotSummary();
        this.renderValueTable();
      });
    }

    if (inputJual) {
      inputJual.addEventListener('input', () => {
        const lot = LotStore.getSelected();
        if (!lot) return;
        lot.jual = Math.max(0, parseFloat(inputJual.value) || 0);
        LotStore.save();
        this.renderLotSummary();
        this.renderValueTable();
      });
    }

    if (selectDasar) {
      selectDasar.addEventListener('change', () => {
        const lot = LotStore.getSelected();
        if (!lot) return;
        lot.basis = selectDasar.value;
        LotStore.save();
        this.renderLotSummary();
        this.renderValueTable();
      });
    }
  },

  render() {
    this.renderLotSelect();
    this.renderLotTable();
    this.renderLotSummary();
    this.renderValueTable();
    this.renderKPICards();
    this.renderChart();
  },

  renderLotSelect() {
    const sel = document.getElementById('lot');
    if (!sel) return;
    const lots = LotStore.getAll();
    const selLot = LotStore.getSelected();
    const cur = selLot ? selLot.id : '';

    if (!lots || lots.length === 0) {
      sel.innerHTML = '<option value="">(Belum ada data lot)</option>';
      return;
    }

    sel.innerHTML = lots.map(l => `
      <option value="${l.id}" ${l.id === cur ? 'selected' : ''}>${l.id} – ${l.nama}</option>
    `).join('');
  },

  renderLotTable() {
    const tbody = document.getElementById('rows');
    const tfoot = document.getElementById('foot');
    if (!tbody) return;

    const lots = LotStore.getAll();
    const curId = LotStore.getSelected() ? LotStore.getSelected().id : null;

    if (!lots || lots.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center" style="padding:28px;color:var(--mute);">Belum ada antrian lot penerimaan ayam. Silakan buat lot baru di Penerimaan Ayam atau mulai timbang.</td></tr>';
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    tbody.innerHTML = lots.map(l => {
      const isSel = l.id === curId;
      const t = LotStore.calcTransit(l);
      const y = LotStore.calcYield(l);
      const tt = LotStore.calcTotal(l);

      return `
        <tr data-id="${l.id}" class="${isSel ? 'selected-row' : ''}" tabindex="0">
          <td class="text-left"><code style="font-weight:700;color:var(--ink);">${l.id}</code></td>
          <td class="text-left" style="font-weight:600;color:var(--ink);">${l.nama}</td>
          <td class="text-right">${LotStore.f(l.ekor)} ekor</td>
          <td class="text-right">${LotStore.f(l.kirim)} kg</td>
          <td class="text-right" style="font-weight:600;">${LotStore.f(l.hidup)} kg</td>
          <td class="text-right ${t != null && t > 3.0 ? 'neg' : ''}">${t == null ? '–' : LotStore.f(t, 2) + '%'}</td>
          <td class="text-right">${LotStore.f(l.basah)} kg</td>
          <td class="text-right">${LotStore.f(l.dingin)} kg</td>
          <td class="text-right">${tt == null ? '–' : LotStore.f(tt, 2) + '%'}</td>
          <td class="text-right ${y != null && y >= 68 ? 'pos' : ''}">${y == null ? '–' : LotStore.f(y, 1) + '%'}</td>
          <td class="text-center">
            <div style="display:flex;gap:4px;align-items:center;justify-content:center;">
              <button class="btn-action-sm btn-action-edit" onclick="event.stopPropagation(); if (window.WeighingEngine) WeighingEngine.openEditLotModal('${l.id}')" title="Edit detail lot">
                Edit
              </button>
              <button class="btn-action-sm btn-action-delete" onclick="event.stopPropagation(); if (window.WeighingEngine) WeighingEngine.openDeleteLotModal('${l.id}')" title="Hapus lot">
                Hapus
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Click handler for picking lot row
    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-action-sm')) return;
        LotStore.select(row.dataset.id);
        const selLot = document.getElementById('lot');
        if (selLot) selLot.value = row.dataset.id;
        if (window.WeighingEngine) WeighingEngine.resetRead();
        this.render();
      });
    });

    if (tfoot) {
      const sum = (k) => lots.reduce((a, l) => a + (l[k] || 0), 0);
      tfoot.innerHTML = `
        <tr>
          <td colspan="2">Total Operasional</td>
          <td>${LotStore.f(sum('ekor'))}</td>
          <td>${LotStore.f(sum('kirim'))}</td>
          <td>${LotStore.f(sum('hidup'))}</td>
          <td></td>
          <td>${LotStore.f(sum('basah'))}</td>
          <td>${LotStore.f(sum('dingin'))}</td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }
  },

  renderLotSummary() {
    const detail = document.getElementById('detail');
    const dtTitle = document.getElementById('dt');
    if (!detail) return;

    const l = LotStore.getSelected();
    if (!l) {
      if (dtTitle) dtTitle.textContent = 'Ringkasan Susut Lot';
      detail.innerHTML = '<div style="padding:24px;text-align:center;color:var(--mute);">Belum ada lot aktif yang dipilih atau data lot masih kosong. Silakan buat lot baru di Penerimaan Ayam.</div>';
      return;
    }

    if (dtTitle) dtTitle.textContent = `Ringkasan Lot ${l.id} – ${l.nama}`;

    const t = LotStore.calcTransit(l);
    const c = LotStore.calcChilling(l);
    const tt = LotStore.calcTotal(l);
    const y = LotStore.calcYield(l);
    const dasar = document.getElementById('ds') ? document.getElementById('ds').value : l.basis || 'kirim';
    const v = LotStore.calcFinancial(l, dasar);

    const inputModal = document.getElementById('pm');
    const inputJual = document.getElementById('pj');
    const selectDasar = document.getElementById('ds');

    if (inputModal && document.activeElement !== inputModal) inputModal.value = l.modal;
    if (inputJual && document.activeElement !== inputJual) inputJual.value = l.jual;
    if (selectDasar) selectDasar.value = dasar;

    detail.innerHTML = `
      <div class="summary-card">
        <strong>${t == null ? '–' : LotStore.f(t, 2) + '%'}</strong>
        <span>Susut Transit ${t == null ? '(belum ditimbang)' : `: ${LotStore.f(l.kirim - l.hidup)} kg dari berat kirim`}</span>
      </div>
      <div class="summary-card">
        <strong>${c == null ? '–' : (c >= 0 ? '' : '+') + LotStore.f(c, 2) + '%'}</strong>
        <span>${c == null ? 'Susut Chilling (belum lengkap)' : (c >= 0 ? 'Susut Chilling: ' : 'Peningkatan Bobot: ') + LotStore.f(Math.abs(l.basah - l.dingin)) + ' kg'}</span>
      </div>
      <div class="summary-card">
        <strong>${tt == null ? '–' : LotStore.f(tt, 2) + '%'}</strong>
        <span>Susut total kandang ke karkas dingin. Yield terhadap hidup: ${y == null ? '–' : LotStore.f(y, 1) + '%'}</span>
      </div>
      <div class="summary-card">
        <strong>${LotStore.rp(v.modal)}</strong>
        <span>Modal Pembelian Ayam (${dasar === 'kirim' ? 'Berat Kirim' : 'Berat Tiba'}) × ${LotStore.rp(l.modal)}/kg</span>
      </div>
      <div class="summary-card">
        <strong>${LotStore.rp(v.jual)}</strong>
        <span>Hasil Penjualan Karkas Dingin ${v.jual == null ? '(belum ditimbang)' : ''} × ${LotStore.rp(l.jual)}/kg</span>
      </div>
      <div class="summary-card">
        <strong class="${v.rs != null && v.rs > 0 ? 'neg' : ''}">${LotStore.rp(v.rs)}</strong>
        <span>Kerugian Susut: Transit ${LotStore.rp(v.rt)}, Chilling ${LotStore.rp(v.rc)}</span>
      </div>
      <div class="summary-card" style="grid-column: 1 / -1;">
        <strong class="${v.laba != null && v.laba < 0 ? 'neg' : (v.laba != null ? 'pos' : '')}">${LotStore.rp(v.laba)}</strong>
        <span>Estimasi Laba/Rugi Kotor Lot Ini (Hasil Jual Karkas − Modal Ayam)${v.laba == null ? ', akan terkalkulasi setelah karkas dingin ditimbang' : ''}</span>
      </div>
    `;
  },

  renderValueTable() {
    const vrows = document.getElementById('vrows');
    const vfoot = document.getElementById('vfoot');
    if (!vrows) return;

    const lots = LotStore.getAll();
    if (!lots || lots.length === 0) {
      vrows.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:24px;color:var(--mute);">Belum ada data evaluasi finansial susut.</td></tr>';
      if (vfoot) vfoot.innerHTML = '';
      return;
    }

    const selLot = LotStore.getSelected();
    const curId = selLot ? selLot.id : null;
    const dasar = document.getElementById('ds') ? document.getElementById('ds').value : 'kirim';

    const evaluated = lots.map(l => ({ l, v: LotStore.calcFinancial(l, dasar) }));

    vrows.innerHTML = evaluated.map(({ l, v }) => `
      <tr data-id="${l.id}" class="${l.id === curId ? 'selected-row' : ''}">
        <td><b>${l.id}</b></td>
        <td>${l.nama}</td>
        <td>${LotStore.rp(v.modal)}</td>
        <td>${LotStore.rp(v.jual)}</td>
        <td class="${v.rt != null && v.rt > 0 ? 'neg' : ''}">${LotStore.rp(v.rt)}</td>
        <td class="${v.rc != null && v.rc > 0 ? 'neg' : ''}">${LotStore.rp(v.rc)}</td>
        <td class="${v.rs != null && v.rs > 0 ? 'neg' : ''}">${LotStore.rp(v.rs)}</td>
        <td class="${v.laba != null && v.laba < 0 ? 'neg' : (v.laba != null ? 'pos' : '')}">${LotStore.rp(v.laba)}</td>
      </tr>
    `).join('');

    vrows.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        LotStore.select(row.dataset.id);
        const selLot = document.getElementById('lot');
        if (selLot) selLot.value = row.dataset.id;
        WeighingEngine.resetRead();
        this.render();
      });
    });

    if (vfoot) {
      const tot = (key) => evaluated.reduce((sum, item) => sum + (item.v[key] || 0), 0);
      const totalLaba = tot('jual') - tot('modal');
      vfoot.innerHTML = `
        <tr>
          <td colspan="2">Total Akumulasi</td>
          <td>${LotStore.rp(tot('modal'))}</td>
          <td>${LotStore.rp(tot('jual'))}</td>
          <td class="neg">${LotStore.rp(tot('rt'))}</td>
          <td class="neg">${LotStore.rp(tot('rc'))}</td>
          <td class="neg">${LotStore.rp(tot('rs'))}</td>
          <td class="${totalLaba < 0 ? 'neg' : 'pos'}">${LotStore.rp(totalLaba)}</td>
        </tr>
      `;
    }
  },

  renderKPICards() {
    const elBirds = document.getElementById('kpiBirds');
    const elTransit = document.getElementById('kpiTransit');
    const elYield = document.getElementById('kpiYield');
    const elLoss = document.getElementById('kpiLoss');
    const elTrucks = document.getElementById('kpiTruckCount');

    if (!elBirds && !elTransit) return;

    const lots = LotStore.getAll();
    const totalBirds = lots.reduce((a, l) => a + (l.ekor || 0), 0);
    const sumSend = lots.reduce((a, l) => a + (l.kirim || 0), 0);
    const sumRecv = lots.reduce((a, l) => a + (l.hidup || 0), 0);
    const sumCold = lots.reduce((a, l) => a + (l.dingin || 0), 0);

    const avgTransit = sumSend > 0 && sumRecv > 0 ? ((sumSend - sumRecv) / sumSend) * 100 : 0;
    const avgYield = sumRecv > 0 && sumCold > 0 ? (sumCold / sumRecv) * 100 : 0;

    const evaluated = lots.map(l => LotStore.calcFinancial(l));
    const totalLoss = evaluated.reduce((a, item) => a + (item.rs || 0), 0);

    if (elBirds) elBirds.textContent = LotStore.f(totalBirds) + " Ekor";
    if (elTrucks) elTrucks.textContent = `${lots.length} Truk Pengiriman`;
    if (elTransit) elTransit.textContent = LotStore.f(avgTransit, 2) + "%";
    if (elYield) elYield.textContent = LotStore.f(avgYield, 1) + "%";
    if (elLoss) elLoss.textContent = LotStore.rp(totalLoss);
  },

  renderChart() {
    const container = document.getElementById('chartContainer');
    if (!container) return;
    const lots = LotStore.getAll();
    if (!lots || lots.length === 0) {
      container.innerHTML = `
        <div style="height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--panel-alt);border-radius:var(--radius-sm);border:1px solid var(--line);color:var(--mute);text-align:center;padding:20px;">
          <div style="font-size:14px;font-weight:600;color:var(--ink);margin-bottom:6px;">Belum Ada Data Grafik</div>
          <div style="font-size:12.5px;max-width:340px;line-height:1.5;">Visualisasi perbandingan susut per lot akan otomatis muncul secara real-time saat penimbangan lot ayam hidup dimulai.</div>
        </div>
      `;
      return;
    }

    const calculated = lots.map(l => ({ l, t: LotStore.calcTransit(l) }));
    const maxVal = Math.max(4.0, ...calculated.map(c => c.t || 0));
    const width = 600;
    const height = 220;
    const chartHeight = 150;
    const barWidth = Math.min(36, Math.floor(400 / lots.length));
    const gap = Math.max(12, Math.floor((500 - (lots.length * barWidth)) / (lots.length + 1)));

    const bars = calculated.map(({ l, t }, i) => {
      const x = 70 + (i * (barWidth + gap));
      if (t == null) {
        return `
          <rect x="${x}" y="165" width="${barWidth}" height="5" fill="#94a3b8" rx="2" />
          <text x="${x + barWidth/2}" y="155" fill="var(--mute)" font-size="11" text-anchor="middle">Antri</text>
          <text x="${x + barWidth/2}" y="190" fill="var(--mute)" font-size="11" text-anchor="middle">${l.id}</text>
        `;
      }
      const barH = Math.min(chartHeight, Math.max(4, Math.round((t / maxVal) * chartHeight)));
      const y = 170 - barH;
      const color = t > 3.0 ? '#c8102e' : (t < 1.5 ? '#059669' : '#0b57a4');
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="2" />
        <text x="${x + barWidth/2}" y="${y - 8}" fill="${color}" font-size="11" font-weight="bold" text-anchor="middle">${LotStore.f(t, 2)}%</text>
        <text x="${x + barWidth/2}" y="190" fill="var(--mute)" font-size="11" text-anchor="middle">${l.id}</text>
      `;
    }).join('');

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;background:var(--panel-alt);border-radius:var(--radius-sm);border:1px solid var(--line);">
        <line x1="60" y1="20" x2="570" y2="20" stroke="var(--line)" stroke-dasharray="3,3" />
        <line x1="60" y1="70" x2="570" y2="70" stroke="var(--line)" stroke-dasharray="3,3" />
        <line x1="60" y1="120" x2="570" y2="120" stroke="var(--line)" stroke-dasharray="3,3" />
        <line x1="60" y1="170" x2="570" y2="170" stroke="var(--line)" stroke-width="1.5" />
        <text x="25" y="25" fill="var(--mute)" font-size="11" font-family="sans-serif">${maxVal.toFixed(1)}%</text>
        <text x="25" y="75" fill="var(--mute)" font-size="11" font-family="sans-serif">${(maxVal * 0.66).toFixed(1)}%</text>
        <text x="25" y="125" fill="var(--mute)" font-size="11" font-family="sans-serif">${(maxVal * 0.33).toFixed(1)}%</text>
        <text x="25" y="174" fill="var(--mute)" font-size="11" font-family="sans-serif">0.0%</text>
        ${bars}
      </svg>
      <div style="display:flex;justify-content:center;gap:20px;margin-top:14px;font-size:12.5px;color:var(--mute);">
        <span><b style="color:#059669">■</b> Rendah (&lt;1.5%)</span>
        <span><b style="color:#0b57a4">■</b> Normal (1.5% - 2.5%)</span>
        <span><b style="color:#c8102e">■</b> Tinggi (&gt;3.0% - Warning)</span>
      </div>
    `;
  }
};
