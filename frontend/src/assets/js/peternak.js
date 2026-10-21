/**
 * Peternak (Farmer) Management Controller - Full CRUD & Scorecard
 * Sistem Timbang & Susut RPHU Modern
 */

const FarmerUI = {
  activeSearchQuery: '',
  editingFarmerId: null,

  async init() {
    this.bindEvents();
    await FarmerStore.init();
    this.render();
  },

  bindEvents() {
    const btnOpenAdd = document.getElementById('btnOpenAddFarmer');
    const searchInput = document.getElementById('searchFarmer');
    const formAdd = document.getElementById('formAddFarmer');
    const formEdit = document.getElementById('formEditFarmer');
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');

    if (btnOpenAdd) {
      btnOpenAdd.addEventListener('click', () => this.openAddModal());
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.activeSearchQuery = e.target.value.toLowerCase().trim();
        this.renderTable();
      });
    }

    if (formAdd) {
      formAdd.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAddFarmer();
      });
    }

    if (formEdit) {
      formEdit.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleEditFarmer();
      });
    }

    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => {
        this.executeDeleteFarmer();
      });
    }

    // Modal close buttons (data-close-modal)
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModals();
      });
    });

    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModals();
      });
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModals();
    });
  },

  render() {
    this.renderKPIs();
    this.renderTable();
  },

  renderKPIs() {
    const farmers = FarmerStore.getAll();
    const totalCount = farmers.length;
    const activeCount = farmers.filter(f => f.status === 'active').length;
    
    // Average shrinkage
    const validShrinkage = farmers.filter(f => f.avg_shrinkage_pct != null);
    const avgShrink = validShrinkage.length > 0
      ? validShrinkage.reduce((acc, f) => acc + parseFloat(f.avg_shrinkage_pct), 0) / validShrinkage.length
      : 0;

    // Best performer (lowest shrinkage)
    const sorted = [...farmers].sort((a, b) => (a.avg_shrinkage_pct || 99) - (b.avg_shrinkage_pct || 99));
    const best = sorted[0];
    const needEval = farmers.filter(f => (f.avg_shrinkage_pct || 0) > 3.0 || f.status === 'evaluation').length;

    const elTotal = document.getElementById('kpiFarmerTotal');
    const elAvg = document.getElementById('kpiFarmerAvgShrink');
    const elBest = document.getElementById('kpiFarmerBest');
    const elEval = document.getElementById('kpiFarmerNeedEval');

    if (elTotal) elTotal.textContent = `${totalCount} Mitra (${activeCount} Aktif)`;
    if (elAvg) elAvg.textContent = `${avgShrink.toFixed(2)}%`;
    if (elBest) elBest.textContent = best ? `${best.name} (${best.avg_shrinkage_pct}%)` : '–';
    if (elEval) elEval.textContent = `${needEval} Mitra`;
  },

  renderTable() {
    const tbody = document.getElementById('farmerTableBody');
    if (!tbody) return;

    let farmers = FarmerStore.getAll();

    // Search filter
    if (this.activeSearchQuery) {
      farmers = farmers.filter(f => 
        (f.name && f.name.toLowerCase().includes(this.activeSearchQuery)) ||
        (f.farmer_code && f.farmer_code.toLowerCase().includes(this.activeSearchQuery)) ||
        (f.region && f.region.toLowerCase().includes(this.activeSearchQuery)) ||
        (f.phone && f.phone.toLowerCase().includes(this.activeSearchQuery))
      );
    }

    // Sort by performance (lowest shrinkage first)
    const sorted = [...farmers].sort((a, b) => (a.avg_shrinkage_pct || 99) - (b.avg_shrinkage_pct || 99));

    if (sorted.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:36px;color:var(--mute);">
            Belum ada mitra peternak terdaftar di database.<br>
            <span style="font-size:12px;margin-top:6px;display:inline-block;">Klik tombol <b>"Tambah Mitra Peternak"</b> di atas untuk mendaftarkan mitra pertama.</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = sorted.map((f, idx) => {
      const rank = `#${idx + 1}`;
      const isHighLoss = (f.avg_shrinkage_pct || 0) > 3.0;
      const statusClass = f.status === 'active' 
        ? (isHighLoss ? 'station-pill style-warning' : 'station-pill style-success') 
        : 'station-pill style-danger';

      const statusBadge = isHighLoss 
        ? `<span class="badge badge-danger">Perlu Evaluasi</span>`
        : (f.avg_shrinkage_pct <= 1.5 
          ? `<span class="badge badge-success">Sangat Baik</span>`
          : `<span class="badge badge-info">Optimal</span>`);

      return `
        <tr style="${isHighLoss ? 'background:rgba(239, 68, 68, 0.04);' : ''}">
          <td class="text-center" style="font-weight:700;color:var(--mute);">${rank}</td>
          <td class="text-left"><code style="font-family:var(--font-mono);font-weight:700;color:var(--blue);">${f.farmer_code}</code></td>
          <td class="text-left"><b style="color:var(--ink);">${f.name}</b></td>
          <td class="text-left">${f.region || '-'}</td>
          <td class="text-left">${f.phone || '-'}</td>
          <td class="text-right" style="font-family:var(--font-mono);">${LotStore.rp(f.default_base_price || 21000)}/kg</td>
          <td class="text-right ${isHighLoss ? 'neg' : 'pos'}">
            <b>${f.avg_shrinkage_pct != null ? f.avg_shrinkage_pct.toFixed(2) + '%' : '–'}</b>
          </td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center">
            <div style="display:flex;gap:6px;align-items:center;justify-content:center;">
              <button class="btn-action-sm btn-action-edit" onclick="FarmerUI.openEditModal(${f.id})" title="Edit data peternak">
                Edit
              </button>
              <button class="btn-action-sm btn-action-delete" onclick="FarmerUI.openDeleteModal(${f.id}, '${f.name.replace(/'/g, "\\'")}')" title="Hapus peternak">
                Hapus
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddModal() {
    const modal = document.getElementById('modalAddFarmer');
    const form = document.getElementById('formAddFarmer');
    if (form) form.reset();

    const alertBox = document.getElementById('addFarmerAlert');
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.textContent = '';
    }
    
    // Auto generate next code
    const all = FarmerStore.getAll();
    const nextNum = all.length + 1;
    const inputCode = document.getElementById('addFarmerCode');
    if (inputCode) inputCode.value = `PTK-${String(nextNum).padStart(3, '0')}`;

    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const nameInput = document.getElementById('addFarmerName');
      if (nameInput) nameInput.focus();
    }, 80);
  },

  openEditModal(id) {
    const farmer = FarmerStore.getById(id);
    if (!farmer) return;

    this.editingFarmerId = id;
    const modal = document.getElementById('modalEditFarmer');
    
    document.getElementById('editFarmerId').value = farmer.id;
    document.getElementById('editFarmerCode').value = farmer.farmer_code;
    document.getElementById('editFarmerName').value = farmer.name;
    document.getElementById('editFarmerRegion').value = farmer.region || '';
    document.getElementById('editFarmerPhone').value = farmer.phone || '';
    document.getElementById('editFarmerPrice').value = farmer.default_base_price || 21000;
    document.getElementById('editFarmerShrinkage').value = farmer.avg_shrinkage_pct || 1.5;
    document.getElementById('editFarmerStatus').value = farmer.status || 'active';
    document.getElementById('editFarmerNotes').value = farmer.notes || '';

    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  openDeleteModal(id, name) {
    this.deletingFarmerId = id;
    const modal = document.getElementById('modalDeleteFarmer');
    const nameEl = document.getElementById('deleteFarmerName');
    if (nameEl) nameEl.textContent = name;
    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    document.body.style.overflow = '';
    this.editingFarmerId = null;
    this.deletingFarmerId = null;
  },

  async handleAddFarmer() {
    const btn = document.getElementById('btnSubmitAddFarmer') || document.querySelector('#formAddFarmer button[type="submit"]');
    const alertBox = document.getElementById('addFarmerAlert');
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.textContent = '';
    }

    const name = document.getElementById('addFarmerName').value.trim();
    if (!name) {
      if (alertBox) {
        alertBox.textContent = 'Nama peternak wajib diisi!';
        alertBox.style.display = 'block';
      } else {
        App.toast('Nama peternak wajib diisi!', 'warning');
      }
      return;
    }

    const data = {
      farmer_code: document.getElementById('addFarmerCode').value.trim(),
      name: name,
      region: document.getElementById('addFarmerRegion').value.trim() || 'Jawa Barat',
      phone: document.getElementById('addFarmerPhone').value.trim() || '-',
      default_base_price: parseFloat(document.getElementById('addFarmerPrice').value) || 21000,
      avg_shrinkage_pct: parseFloat(document.getElementById('addFarmerShrinkage').value) || 1.5,
      status: document.getElementById('addFarmerStatus').value || 'active',
      notes: document.getElementById('addFarmerNotes').value.trim() || '-'
    };

    const originalText = btn ? btn.innerHTML : 'Simpan Mitra';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Menyimpan ke Database...</span>';
    }

    try {
      await FarmerStore.add(data);
      this.closeModals();
      this.render();
      App.toast(`Berhasil menambahkan mitra ${data.name}!`, 'success');
      if (window.Auth && Auth.beep) Auth.beep(880, 0.1, 'sine');
    } catch (err) {
      if (alertBox) {
        alertBox.textContent = 'Gagal menyimpan mitra ke database.';
        alertBox.style.display = 'block';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  },

  async handleEditFarmer() {
    if (!this.editingFarmerId) return;

    const data = {
      farmer_code: document.getElementById('editFarmerCode').value.trim(),
      name: document.getElementById('editFarmerName').value.trim(),
      region: document.getElementById('editFarmerRegion').value.trim(),
      phone: document.getElementById('editFarmerPhone').value.trim(),
      default_base_price: parseFloat(document.getElementById('editFarmerPrice').value) || 21000,
      avg_shrinkage_pct: parseFloat(document.getElementById('editFarmerShrinkage').value) || 1.5,
      status: document.getElementById('editFarmerStatus').value,
      notes: document.getElementById('editFarmerNotes').value.trim()
    };

    if (!data.name) {
      App.toast('Nama peternak wajib diisi!', 'warning');
      return;
    }

    await FarmerStore.update(this.editingFarmerId, data);
    this.closeModals();
    this.render();
    App.toast(`Data peternak ${data.name} berhasil diperbarui!`, 'success');
    if (window.Auth && Auth.beep) Auth.beep(880, 0.1, 'sine');
  },

  async executeDeleteFarmer() {
    if (!this.deletingFarmerId) return;

    const id = this.deletingFarmerId;
    const farmer = FarmerStore.getById(id);
    const name = farmer ? farmer.name : 'Mitra';

    await FarmerStore.delete(id);
    this.closeModals();
    this.render();
    App.toast(`Mitra ${name} berhasil dihapus dari sistem!`, 'info');
    if (window.Auth && Auth.beep) Auth.beep(400, 0.1, 'square');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  FarmerUI.init();
});
