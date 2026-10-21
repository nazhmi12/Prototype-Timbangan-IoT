/**
 * API Service Client for Sistem Timbang RPHU
 * Terhubung langsung ke Backend REST API & Database SQLite/MySQL.
 */

function resolveApiUrl(endpoint) {
  const clean = String(endpoint).replace(/^\/?api\/v1\/?/, '').replace(/^\//, '');
  // Jika dibuka di dev server (port 3000) atau backend langsung (port 8000)
  const base = (window.location.port === '8080')
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';
  return `${base}/${clean}`;
}

const Api = {
  async get(endpoint) {
    try {
      const token = localStorage.getItem('rphu-token');
      const url = resolveApiUrl(endpoint);
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return data || { success: false, message: `HTTP Error ${res.status}` };
      }
      return data;
    } catch (err) {
      console.warn(`[Api.get] Endpoint ${endpoint} offline/unreachable:`, err.message);
      return null;
    }
  },

  async post(endpoint, payload) {
    try {
      const token = localStorage.getItem('rphu-token');
      const url = resolveApiUrl(endpoint);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return data || { success: false, message: `HTTP Error ${res.status}` };
      }
      return data;
    } catch (err) {
      console.warn(`[Api.post] Endpoint ${endpoint} offline/unreachable:`, err.message);
      return null;
    }
  },

  async put(endpoint, payload) {
    try {
      const token = localStorage.getItem('rphu-token');
      const url = resolveApiUrl(endpoint);
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return data || { success: false, message: `HTTP Error ${res.status}` };
      }
      return data;
    } catch (err) {
      console.warn(`[Api.put] Endpoint ${endpoint} offline/unreachable:`, err.message);
      return null;
    }
  },

  async delete(endpoint) {
    try {
      const token = localStorage.getItem('rphu-token');
      const url = resolveApiUrl(endpoint);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return data || { success: false, message: `HTTP Error ${res.status}` };
      }
      return data;
    } catch (err) {
      console.warn(`[Api.delete] Endpoint ${endpoint} offline/unreachable:`, err.message);
      return null;
    }
  },

  async checkDatabaseStatus() {
    return await this.get('/database/status');
  }
};

// Aliases agar kompatibel di seluruh kode (Api dan API)
window.Api = Api;
window.API = Api;
