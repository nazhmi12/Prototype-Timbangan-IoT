/**
 * Authentication, RBAC (Role-Based Access Control), Theme & Audio Synthesis Manager
 * Sistem Timbang & Susut RPHU Modern
 */

const Auth = {
  // Matriks Peran & Identitas Resmi
  ROLES: {
    super_admin: {
      key: 'super_admin',
      label: 'Super Admin',
      title: 'Kantor Pusat / Direksi',
      badgeClass: 'role-super-admin',
      color: '#e11d48',
      bg: '#ffe4e6',
      border: '#fecdd3',
      icon: '',
      summary: 'Otoritas Tertinggi: Manajemen Seluruh Pengguna, Pengawasan Keuangan & Susut Nasional, Audit Trail, Hak Akses Penuh.'
    },
    admin: {
      key: 'admin',
      label: 'Supervisor / Admin',
      title: 'Supervisor Operasional RPHU',
      badgeClass: 'role-admin',
      color: '#0284c7',
      bg: '#e0f2fe',
      border: '#bae6fd',
      icon: '',
      summary: 'Pengawasan Operasional: Verifikasi Kedatangan Truk, Manajemen Peternak, Otorisasi Koreksi Timbang, Manajemen Operator.'
    },
    operator: {
      key: 'operator',
      label: 'Operator Timbang',
      title: 'Petugas Stasiun Timbang',
      badgeClass: 'role-operator',
      color: '#15803d',
      bg: '#dcfce7',
      border: '#bbf7d0',
      icon: '',
      summary: 'Eksekusi Lapangan: Penimbangan Ayam Hidup, Karkas Basah, Karkas Dingin, Monitoring IoT Digital Scale, Cetak Tiket Timbang.'
    }
  },

  // Profil Akun Default
  DEMO_PROFILES: {
    super_admin: {
      user_id: 'superadmin',
      name: 'Ir. Budi Santoso',
      role: 'super_admin',
      station: 'Kantor Pusat / Direksi',
      shift: 'Pagi',
      is_protected: true
    },
    admin: {
      user_id: 'admin_rphu',
      name: 'Siti Rahma',
      role: 'admin',
      station: 'Kantor Operasional RPHU',
      shift: 'Pagi',
      is_protected: false
    },
    operator: {
      user_id: 'operator_01',
      name: 'Ahmad Fauzi',
      role: 'operator',
      station: 'Timbang 1',
      shift: 'Pagi',
      is_protected: false
    }
  },

  // Rincian Jobdesk Resmi Setiap Role
  JOBDESK: {
    super_admin: {
      title: 'Super Administrator (Direksi / IT Pusat)',
      level: 'Otoritas Tertinggi (Level 1)',
      badge: 'Super Admin',
      color: '#e11d48',
      responsibilities: [
        'Manajemen Pengguna Penuh: Berhak menambah, mengedit, dan menghapus akun Operator maupun Admin User.',
        'Proteksi Akun Permanen: Akun Super Admin dilindungi oleh SQL Database Trigger (kebal dari penghapusan).',
        'Pengawasan Finansial & KPI: Mengakses analisis kerugian susut nasional, margin profit, dan ringkasan eksekutif.',
        'Audit Trail & Rekonsiliasi: Memverifikasi histori penimbangan, kepatuhan harga kontrak, dan selisih pembayaran peternak.',
        'Akses Sistem Tanpa Batas: Memiliki izin membuka dan mengoperasikan 100% seluruh modul dan halaman aplikasi.'
      ],
      allowedPages: ['dashboard.html', 'penerimaan-ayam.html', 'timbang-susut.html', 'produksi.html', 'cold-storage.html', 'penjualan.html', 'peternak.html', 'laporan.html', 'users.html']
    },
    admin: {
      title: 'Administrator Operasional (Supervisor RPHU)',
      level: 'Pengawas Lapangan & Kontrak (Level 2)',
      badge: 'Admin User',
      color: '#0284c7',
      responsibilities: [
        'Manajemen Kedatangan Truk & Lot: Mendaftarkan lot ayam baru, verifikasi surat jalan (DO), dan menentukan basis bayar (Kirim/Terima).',
        'Manajemen Mitra Peternak: Mendaftarkan mitra peternak baru, memantau riwayat deviasi susut, dan mengatur harga kontrak dasar per kg.',
        'Otorisasi & Koreksi Timbang: Memvalidasi rekaman deviasi berat dan memiliki wewenang membatalkan/menghapus transaksi salah timbang.',
        'Manajemen Pengguna Terbatas: Hanya dapat mengelola akun level Operator Timbang (tidak dapat membuat/menghapus Admin & Super Admin).',
        'Pengawasan Cold Storage & Penjualan: Memonitor pergerakan stok karkas dingin dan menerbitkan pesanan penjualan karkas.'
      ],
      allowedPages: ['dashboard.html', 'penerimaan-ayam.html', 'timbang-susut.html', 'produksi.html', 'cold-storage.html', 'penjualan.html', 'peternak.html', 'laporan.html', 'users.html']
    },
    operator: {
      title: 'Operator Timbang (Petugas Stasiun)',
      level: 'Pelaksana Penimbangan Lapangan (Level 3)',
      badge: 'Operator Timbang',
      color: '#15803d',
      responsibilities: [
        'Eksekusi Penimbangan Fisik: Menimbang Ayam Hidup (Dermaga), Karkas Basah (Selesai Potong), dan Karkas Dingin (Selesai Chilling).',
        'Pengoperasian Indikator Digital: Melakukan Tare keranjang, Zeroing timbangan, dan membaca telemetri live IoT (ESP32-HX711).',
        'Penerimaan Bongkar: Memeriksa antrian truk di dermaga dan mengeksekusi penimbangan bongkar secara akurat.',
        'Cetak Bukti Timbang: Mencetak struk timbang dan label barcode lot karkas untuk traceability.',
        'Proteksi & Pembatasan: Akses Manajemen Pengguna DILOCK TOTAL. Tidak dapat mengubah harga kontrak mitra maupun menghapus data timbangan tanpa otorisasi supervisor.'
      ],
      allowedPages: ['timbang-susut.html', 'penerimaan-ayam.html', 'cold-storage.html']
    }
  },

  initTheme() {
    let mode = null;
    try {
      mode = localStorage.getItem('rphu-theme');
    } catch (e) {}

    if (mode !== 'light' && mode !== 'dark') {
      mode = 'light';
    }
    this.applyTheme(mode);

    document.querySelectorAll('.seg-toggle, .seg').forEach(container => {
      container.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.m) return;
        this.applyTheme(btn.dataset.m);
        try {
          localStorage.setItem('rphu-theme', btn.dataset.m);
        } catch (x) {}
      });
    });
  },

  applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    document.querySelectorAll('[data-m]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.m === mode ? 'true' : 'false');
    });
  },

  getCurrentUser() {
    try {
      const stored = localStorage.getItem('rphu-auth-user');
      if (stored && stored.startsWith('{')) {
        const u = JSON.parse(stored);
        if (u.name) u.name = u.name.replace(/\s*\([^)]*\)\s*$/, '');
        return u;
      }
      const legacy = localStorage.getItem('rphu-user');
      if (legacy) {
        if (legacy.startsWith('{')) {
          const u = JSON.parse(legacy);
          if (u.name) u.name = u.name.replace(/\s*\([^)]*\)\s*$/, '');
          return u;
        } else if (legacy === 'superadmin' || legacy === 'root') {
          return this.DEMO_PROFILES.super_admin;
        } else if (legacy === 'admin_rphu' || legacy === 'admin') {
          return this.DEMO_PROFILES.admin;
        } else if (legacy === 'operator_01' || legacy === 'operator') {
          return this.DEMO_PROFILES.operator;
        }
      }
    } catch (e) {}
    return {
      user_id: 'superadmin',
      name: 'Ir. Budi Santoso',
      role: 'super_admin',
      station: localStorage.getItem('rphu-station') || 'Kantor Pusat / Direksi',
      shift: localStorage.getItem('rphu-shift') || 'Pagi',
      is_protected: true
    };
  },

  getRole() {
    const u = this.getCurrentUser();
    return (u && u.role) ? u.role : 'operator';
  },

  isSuperAdmin() {
    return this.getRole() === 'super_admin';
  },

  isAdmin() {
    return this.getRole() === 'admin';
  },

  isOperator() {
    return this.getRole() === 'operator';
  },

  /**
   * Cek Izin Wewenang (RBAC Evaluator)
   */
  can(action, context = {}) {
    const role = this.getRole();

    // Super Admin memiliki seluruh izin tanpa kecuali
    if (role === 'super_admin') return true;

    switch (action) {
      // Manajemen Pengguna
      case 'access_users_page':
        return role === 'super_admin' || role === 'admin';
      case 'create_user':
        return role === 'super_admin' || role === 'admin';
      case 'assign_role_super_admin':
      case 'assign_role_admin':
        return role === 'super_admin'; // Admin biasa hanya boleh buat Operator
      case 'assign_role_operator':
        return role === 'super_admin' || role === 'admin';
      case 'delete_user':
        if (context.targetRole === 'super_admin' || context.is_protected) return false;
        if (context.targetRole === 'admin') return role === 'super_admin'; // Admin biasa tidak bisa hapus sesama Admin
        return role === 'super_admin' || role === 'admin';

      // Penimbangan & Integritas Data
      case 'execute_weighing':
      case 'record_weight':
      case 'record_cutting':
        return true; // Semua role bisa timbang dan catat pemotongan produksi
      case 'delete_weighing':
      case 'correct_weighing':
        return role === 'super_admin' || role === 'admin'; // Operator tidak boleh sembarangan hapus timbangan

      // Manajemen Kontrak & Harga Peternak
      case 'manage_farmers':
      case 'edit_contract_price':
      case 'create_lot':
      case 'set_payment_basis':
        return role === 'super_admin' || role === 'admin'; // Operator hanya read-only

      // Halaman Sistem
      case 'access_page': {
        const page = (context.page || '').toLowerCase();
        if (role === 'operator') {
          return ['penerimaan-ayam.html', 'timbang-susut.html', 'cold-storage.html'].some(p => page.includes(p));
        }
        return true;
      }

      default:
        return false;
    }
  },

  setCurrentUser(user) {
    try {
      localStorage.setItem('rphu-auth-user', JSON.stringify(user));
      if (user.station) localStorage.setItem('rphu-station', user.station);
      if (user.shift) localStorage.setItem('rphu-shift', user.shift);
    } catch (e) {}
  },

  /**
   * Beralih Peran Cepat (Untuk Pengujian & Evaluasi Jobdesk)
   */
  quickSwitchRole(roleKey) {
    const profile = this.DEMO_PROFILES[roleKey] || this.DEMO_PROFILES.operator;
    this.setCurrentUser(profile);
    this.beep(850, 0.08);

    // Kirim notifikasi toast global jika App tersedia
    if (typeof App !== 'undefined' && App.toast) {
      App.toast(`Beralih ke peran: ${profile.name} (${Auth.ROLES[roleKey].label})`, 'info');
    }

    // Periksa apakah halaman saat ini diizinkan untuk peran baru
    const currentPath = window.location.pathname.toLowerCase();
    if (roleKey === 'operator' && currentPath.includes('users.html')) {
      setTimeout(() => {
        window.location.href = 'timbang-susut.html';
      }, 500);
      return;
    }

    setTimeout(() => {
      window.location.reload();
    }, 400);
  },

  logout() {
    try {
      localStorage.removeItem('rphu-token');
      localStorage.removeItem('rphu-auth-user');
    } catch (e) {}
    window.location.href = '../login.html';
  },

  // Web Audio API Synthesizer (Realistic Industrial Scale Beeper)
  beep(frequency = 880, duration = 0.08, type = 'sine') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context might be restricted before interaction
    }
  }
};
