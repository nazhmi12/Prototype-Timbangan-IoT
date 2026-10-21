/**
 * Lot & Farmer Management Module (Full CRUD & Calculations)
 */

const FarmerStore = {
  farmers: [],

  async init() {
    try {
      const stored = localStorage.getItem('rphu-farmers-data');
      if (stored) {
        this.farmers = JSON.parse(stored);
      }
      // Sync from API if available
      const remote = await Api.get('/farmers');
      if (remote && remote.data && Array.isArray(remote.data)) {
        this.farmers = remote.data;
        this.save();
      }
    } catch (e) {}
  },

  save() {
    try {
      localStorage.setItem('rphu-farmers-data', JSON.stringify(this.farmers));
    } catch (e) {}
  },

  getAll() {
    return this.farmers;
  },

  getById(id) {
    return this.farmers.find(f => String(f.id) === String(id) || f.farmer_code === String(id));
  },

  async add(data) {
    const newId = (this.farmers.reduce((max, f) => Math.max(max, f.id || 0), 0)) + 1;
    const newCode = data.farmer_code || `PTK-${String(newId).padStart(3, '0')}`;
    let newFarmer = {
      id: newId,
      farmer_code: newCode,
      name: data.name || "Peternak Baru",
      region: data.region || "Jawa Barat",
      phone: data.phone || "-",
      default_base_price: parseFloat(data.default_base_price) || 21000,
      avg_shrinkage_pct: parseFloat(data.avg_shrinkage_pct) || 1.50,
      status: data.status || "active",
      notes: data.notes || "Mitra baru"
    };

    try {
      const res = await Api.post('/farmers', newFarmer);
      if (res && res.data) {
        newFarmer = res.data;
      }
    } catch (e) {
      console.warn('API post /farmers failed, fallback to local', e);
    }

    const existingIdx = this.farmers.findIndex(f => f.id === newFarmer.id || f.farmer_code === newFarmer.farmer_code);
    if (existingIdx !== -1) {
      this.farmers[existingIdx] = newFarmer;
    } else {
      this.farmers.push(newFarmer);
    }
    this.save();
    return newFarmer;
  },

  async update(id, data) {
    const farmer = this.getById(id);
    if (!farmer) return null;

    Object.assign(farmer, data);
    this.save();

    try {
      const res = await Api.put(`/farmers/${id}`, farmer);
      if (res && res.data) {
        Object.assign(farmer, res.data);
        this.save();
      }
    } catch (e) {
      console.warn('API put /farmers failed', e);
    }
    return farmer;
  },

  async delete(id) {
    const idx = this.farmers.findIndex(f => String(f.id) === String(id) || f.farmer_code === String(id));
    if (idx === -1) return false;

    this.farmers.splice(idx, 1);
    this.save();

    try {
      await Api.delete(`/farmers/${id}`);
    } catch (e) {
      console.warn('API delete /farmers failed', e);
    }
    return true;
  }
};

const LotStore = {
  lots: [],

  selectedId: null,

  async init() {
    try {
      const stored = localStorage.getItem('rphu-lots-data');
      if (stored !== null) {
        this.lots = JSON.parse(stored);
      }
      const remote = await Api.get('/lots');
      if (remote && remote.data && Array.isArray(remote.data)) {
        this.lots = remote.data;
        this.save();
      }
      const urlParams = new URLSearchParams(window.location.search);
      const paramLot = urlParams.get('lot');
      if (paramLot && this.lots && this.lots.find(l => l.id === paramLot)) {
        this.selectedId = paramLot;
      } else if (this.lots && this.lots.length > 0) {
        if (!this.selectedId || !this.lots.find(l => l.id === this.selectedId)) {
          this.selectedId = this.lots[0].id;
        }
      } else {
        this.selectedId = null;
      }
    } catch (e) {}
  },

  save() {
    try {
      localStorage.setItem('rphu-lots-data', JSON.stringify(this.lots));
    } catch (e) {}
  },

  getAll() {
    return this.lots || [];
  },

  getSelected() {
    if (!this.lots || this.lots.length === 0) return null;
    return this.lots.find(l => l.id === this.selectedId) || this.lots[0] || null;
  },

  getById(id) {
    if (!this.lots) return null;
    return this.lots.find(l => l.id === id);
  },

  select(id) {
    this.selectedId = id;
  },

  async add(data) {
    const nextNum = ((this.lots || []).reduce((max, l) => {
      const match = String(l.id).match(/(\d+)$/);
      return Math.max(max, match ? parseInt(match[1]) : 0);
    }, 0)) + 1;

    let newLot = {
      id: data.id || `L-0610-${String(nextNum).padStart(2, '0')}`,
      nama: data.nama || "Lot Baru",
      farmer_id: data.farmer_id || null,
      ekor: parseInt(data.ekor) || 0,
      kirim: parseFloat(data.kirim) || 0.0,
      hidup: data.hidup != null ? parseFloat(data.hidup) : null,
      basah: data.basah != null ? parseFloat(data.basah) : null,
      dingin: data.dingin != null ? parseFloat(data.dingin) : null,
      modal: parseFloat(data.modal) || 21500,
      jual: parseFloat(data.jual) || 36000,
      basis: data.basis || "kirim",
      status: data.status || "waiting"
    };

    try {
      const res = await Api.post('/lots', newLot);
      if (res && res.data) {
        newLot = res.data;
      }
    } catch (e) {
      console.warn('API post /lots failed, saved locally', e);
    }

    if (!this.lots) this.lots = [];
    const existingIdx = this.lots.findIndex(l => l.id === newLot.id);
    if (existingIdx !== -1) {
      this.lots[existingIdx] = newLot;
    } else {
      this.lots.push(newLot);
    }
    this.selectedId = newLot.id;
    this.save();

    return newLot;
  },

  async update(id, data) {
    const lot = this.getById(id);
    if (!lot) return null;

    Object.assign(lot, data);
    this.save();

    Api.put(`/lots/${id}`, lot);
    return lot;
  },

  async delete(id) {
    if (!this.lots) return false;
    const idx = this.lots.findIndex(l => l.id === id);
    if (idx === -1) return false;

    this.lots.splice(idx, 1);
    if (this.selectedId === id) {
      this.selectedId = this.lots.length > 0 ? this.lots[0].id : null;
    }
    this.save();

    Api.delete(`/lots/${id}`);
    return true;
  },

  // Rumus Matematis Susut
  calcTransit(l) {
    if (!l || l.hidup == null || l.kirim == null || l.kirim <= 0) return null;
    return ((l.kirim - l.hidup) / l.kirim) * 100;
  },

  calcChilling(l) {
    if (!l || l.dingin == null || l.basah == null || l.basah <= 0) return null;
    return ((l.basah - l.dingin) / l.basah) * 100;
  },

  calcTotal(l) {
    if (!l || l.dingin == null || l.kirim == null || l.kirim <= 0) return null;
    return ((l.kirim - l.dingin) / l.kirim) * 100;
  },

  calcYield(l) {
    if (!l || l.dingin == null || l.hidup == null || l.hidup <= 0) return null;
    return (l.dingin / l.hidup) * 100;
  },

  calcFinancial(l, dasar = null) {
    if (!l) return { modal: null, jual: null, rt: null, rc: null, rs: null, laba: null };
    const basis = dasar || l.basis || "kirim";
    const kgModal = basis === "kirim" ? l.kirim : l.hidup;
    const modal = kgModal != null && l.modal != null ? Math.round(kgModal * l.modal) : null;
    const jual = l.dingin != null && l.jual != null ? Math.round(l.dingin * l.jual) : null;

    const rt = (l.hidup != null && l.kirim != null && basis === "kirim" && l.modal != null)
      ? Math.round((l.kirim - l.hidup) * l.modal)
      : 0;

    const rc = (l.dingin != null && l.basah != null && l.jual != null)
      ? Math.round(Math.max(0, l.basah - l.dingin) * l.jual)
      : null;

    const rs = (rt == null && rc == null) ? null : ((rt || 0) + (rc || 0));
    const laba = (modal != null && jual != null) ? (jual - modal) : null;

    return { modal, jual, rt, rc, rs, laba };
  },

  f(n, d = 0) {
    if (n == null) return "–";
    return Number(n).toLocaleString("id-ID", {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  },

  rp(n) {
    if (n == null) return "–";
    const sign = n < 0 ? "−" : "";
    return `${sign}Rp ${this.f(Math.abs(Math.round(n)))}`;
  }
};
