/**
 * Master Application Shell Controller (app.js)
 * Sistem Timbang & Susut RPHU Modern
 */

const App = {
  // Matriks Menu yang Diizinkan per Peran (Role-Based Menu Filtering)
  ROLE_PERMISSIONS: {
    super_admin: {
      label: 'Super Admin',
      title: 'Kantor Pusat / Direksi',
      allowedPages: [
        'penerimaan-ayam.html',
        'timbang-susut.html',
        'produksi.html',
        'cold-storage.html',
        'penjualan.html',
        'dashboard.html',
        'peternak.html',
        'laporan.html',
        'users.html',
        'log-aktivitas.html'
      ]
    },
    admin: {
      label: 'Supervisor / Admin',
      title: 'Supervisor Operasional RPHU',
      allowedPages: [
        'penerimaan-ayam.html',
        'timbang-susut.html',
        'produksi.html',
        'cold-storage.html',
        'penjualan.html',
        'dashboard.html',
        'peternak.html',
        'laporan.html',
        'users.html',
        'log-aktivitas.html'
      ]
    },
    operator: {
      label: 'Operator Timbang',
      title: 'Stasiun Timbang Lapangan',
      allowedPages: [
        'penerimaan-ayam.html',
        'timbang-susut.html',
        'cold-storage.html'
      ]
    }
  },

  init() {
    Auth.initTheme();
    this.initClock();
    this.initUserHeader();
    this.filterSidebarByRole();
    this.enforceRoleRestrictions();
    this.highlightActiveNav();
    this.initDatabaseStatus();
  },

  initClock() {
    const updateTime = () => {
      const now = new Date();
      const str = now.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      document.querySelectorAll('#jam, #tgl').forEach(el => {
        el.textContent = str;
      });

      const fullDateStr = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const homeDateEl = document.getElementById('homeHeroDate');
      if (homeDateEl) {
        homeDateEl.textContent = `${fullDateStr}, ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      }
    };
    updateTime();
    setInterval(updateTime, 30000);
  },

  initUserHeader() {
    const user = Auth.getCurrentUser();
    const roleKey = user.role || 'operator';
    const roleMeta = Auth.ROLES[roleKey] || Auth.ROLES.operator;

    const stationLabel = document.getElementById('currentStationLabel');
    const userLabel = document.getElementById('currentUserLabel');

    if (stationLabel && user.station) {
      stationLabel.textContent = user.station;
    }
    if (userLabel && user.name) {
      userLabel.textContent = user.name;
    }

    const homeUserEl = document.getElementById('homeHeroUser');
    if (homeUserEl && user.name) {
      homeUserEl.innerHTML = `Petugas: <b>${user.name}</b> <span class="role-badge-header role-${roleKey}" style="margin-left:6px;cursor:default;">${roleMeta.label}</span>`;
    }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => Auth.logout());
    }

    // Pasang Role Badge di Header Pojok Kanan Atas (Statis & Bersih sesuai Akun Login)
    const userProfileEl = document.querySelector('.user-profile');
    if (userProfileEl && !document.getElementById('headerRoleBadge')) {
      const badge = document.createElement('span');
      badge.id = 'headerRoleBadge';
      badge.className = `role-badge-header role-${roleKey}`;
      badge.style.cursor = 'default';
      badge.innerHTML = `<span>${roleMeta.label}</span>`;
      badge.title = `Peran Sesi: ${roleMeta.title}`;
      userProfileEl.insertBefore(badge, userLabel ? userLabel.nextSibling : userProfileEl.firstChild);
    }

    this.initDatabaseStatus();
  },

  /**
   * Filter Menu Sidebar Secara Dinamis Sesuai Role Pengguna
   */
  filterSidebarByRole() {
    const user = Auth.getCurrentUser();
    const roleKey = user.role || 'operator';
    const perms = this.ROLE_PERMISSIONS[roleKey] || this.ROLE_PERMISSIONS.operator;
    const allowed = perms.allowedPages;

    const sidebarNav = document.querySelector('.sidebar nav');
    if (!sidebarNav) return;

    // 1. Tambahkan link Log Aktivitas ke sidebar jika belum ada (untuk Super Admin & Supervisor)
    if (roleKey === 'super_admin' || roleKey === 'admin') {
      let hasLogLink = false;
      sidebarNav.querySelectorAll('a').forEach(a => {
        if ((a.getAttribute('href') || '').includes('log-aktivitas.html')) hasLogLink = true;
      });

      if (!hasLogLink) {
        const logLink = document.createElement('a');
        logLink.href = 'log-aktivitas.html';
        logLink.textContent = 'Log Aktivitas';
        sidebarNav.appendChild(logLink);
      }
    }

    // 2. Filter setiap tautan menu di sidebar
    const links = Array.from(sidebarNav.querySelectorAll('a'));
    links.forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const pageName = href.split('/').pop().split('?')[0];

      // Jika halaman tidak ada di daftar yang diizinkan untuk role ini, HAPUS DARI DOM
      if (!allowed.includes(pageName)) {
        a.remove();
      } else {
        // Label khusus
        if (pageName === 'users.html') {
          const span = a.querySelector('span:last-child');
          if (span) {
            span.textContent = (roleKey === 'admin') ? 'Manajemen Operator' : 'Manajemen User';
          } else {
            a.textContent = (roleKey === 'admin') ? 'Manajemen Operator' : 'Manajemen User';
          }
        }
      }
    });

    // 3. Bersihkan judul bagian navigasi (nav-section-title) yang tidak memiliki link di bawahnya
    const titles = Array.from(sidebarNav.querySelectorAll('.nav-section-title'));
    titles.forEach(title => {
      let nextEl = title.nextElementSibling;
      let hasLink = false;
      while (nextEl && !nextEl.classList.contains('nav-section-title')) {
        if (nextEl.tagName === 'A') {
          hasLink = true;
          break;
        }
        nextEl = nextEl.nextElementSibling;
      }
      if (!hasLink) {
        title.remove();
      }
    });

    // 4. Khusus Operator: Sederhanakan judul bagian menjadi "Operasional Stasiun Timbang"
    if (roleKey === 'operator') {
      const remainingTitle = sidebarNav.querySelector('.nav-section-title');
      if (remainingTitle) {
        remainingTitle.textContent = 'Stasiun Timbang';
      }

      const footer = document.querySelector('.sidebar-footer p');
      if (footer) {
        footer.innerHTML = `<b>Stasiun Timbang Lapangan</b><br>Sistem Timbang RPHU`;
      }
    }
  },

  /**
   * Pembatasan Akses Halaman (Route Guard Berdasarkan Role)
   */
  enforceRoleRestrictions() {
    const user = Auth.getCurrentUser();
    const roleKey = user.role || 'operator';
    const perms = this.ROLE_PERMISSIONS[roleKey] || this.ROLE_PERMISSIONS.operator;
    const allowed = perms.allowedPages;

    const currentPath = window.location.pathname.toLowerCase();
    const currentPage = currentPath.split('/').pop().split('?')[0];

    // Jika user mengakses halaman yang tidak diizinkan untuk rolenya
    if (currentPage && currentPage.endsWith('.html') && !allowed.includes(currentPage)) {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.innerHTML = `
          <div class="access-denied-wrapper" style="text-align:center;padding:40px 20px;">
            <div style="font-size:14px;font-weight:700;color:#dc2626;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">
              Otorisasi Terbatas
            </div>
            <h2 style="font-size:20px;font-weight:700;color:var(--ink);margin:0 0 10px 0;">Menu Tidak Termasuk Jobdesk</h2>
            <div style="display:inline-block;padding:4px 12px;border-radius:20px;background:#dcfce7;color:#15803d;font-weight:700;font-size:12px;margin-bottom:16px;">
              Sesi Login: ${user.name} (${perms.label})
            </div>
            <p style="color:var(--mute);font-size:14px;line-height:1.6;margin:0 0 24px 0;">
              Sesuai dengan SOP RPHU Modern, akun Anda (${perms.label}) hanya memiliki akses ke modul stasiun kerja yang telah ditentukan.<br>
              Menu ini dikhususkan untuk wewenang pengawasan operasional dan administrasi sistem.
            </p>
            <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
              <a href="timbang-susut.html" class="btn btn-primary" style="display:inline-flex;align-items:center;padding:9px 18px;text-decoration:none;">
                Beralih ke Stasiun Timbang
              </a>
              <button type="button" class="btn btn-secondary" onclick="Auth.logout()" style="display:inline-flex;align-items:center;padding:9px 18px;cursor:pointer;">
                Ganti Akun / Keluar
              </button>
            </div>
          </div>
        `;
      }
    }
  },

  async initDatabaseStatus() {
    try {
      const footer = document.querySelector('.sidebar-footer p');
      if (!footer) return;
      const res = await Api.get('/database/status');
      if (res && res.success && res.database) {
        const user = Auth.getCurrentUser();
        if (user.role === 'super_admin' || user.role === 'admin') {
          if (!document.getElementById('sidebarDbInfo')) {
            const span = document.createElement('span');
            span.id = 'sidebarDbInfo';
            span.style.cssText = 'display:block;margin-top:4px;font-size:11px;color:var(--mute);';
            span.textContent = `Database: SQLite (${res.database.tables.users} Users)`;
            footer.appendChild(span);
          }
        }
      }
    } catch (e) {
      // quiet fallback
    }
  },

  highlightActiveNav() {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('.sidebar nav a');
    links.forEach(a => {
      const href = a.getAttribute('href');
      if (href && currentPath.endsWith(href)) {
        a.classList.add('active');
      }
    });
  },

  toast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
