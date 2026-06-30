// ===== API UTILITY =====
const API_URL = 'https://YOUR-BACKEND.onrender.com/api'; // ← Thay URL backend của bạn

class API {
  static getToken() { return localStorage.getItem('ss_token'); }
  static setToken(t) { localStorage.setItem('ss_token', t); }
  static removeToken() { localStorage.removeItem('ss_token'); localStorage.removeItem('ss_refresh'); localStorage.removeItem('ss_user'); }

  static async request(path, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

    try {
      let res = await fetch(`${API_URL}${path}`, { ...options, headers });

      // Auto refresh token
      if (res.status === 401) {
        const refresh = localStorage.getItem('ss_refresh');
        if (refresh) {
          const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) });
          const rd = await r.json();
          if (rd.success) {
            this.setToken(rd.token);
            headers['Authorization'] = `Bearer ${rd.token}`;
            res = await fetch(`${API_URL}${path}`, { ...options, headers });
          } else { this.logout(); return null; }
        }
      }

      const data = await res.json();
      if (!data.success && data.message) console.warn('[API]', data.message);
      return data;
    } catch (err) {
      console.error('[API Error]', err);
      return null;
    }
  }

  static get(path) { return this.request(path); }
  static post(path, body, isForm = false) { return this.request(path, { method: 'POST', body: isForm ? body : JSON.stringify(body) }); }
  static put(path, body, isForm = false) { return this.request(path, { method: 'PUT', body: isForm ? body : JSON.stringify(body) }); }
  static delete(path) { return this.request(path, { method: 'DELETE' }); }

  static logout() {
    this.post('/auth/logout').finally(() => {
      this.removeToken();
      window.location.href = '/login.html';
    });
  }

  static getCurrentUser() {
    const u = localStorage.getItem('ss_user');
    return u ? JSON.parse(u) : null;
  }

  static saveUser(user) {
    localStorage.setItem('ss_user', JSON.stringify(user));
  }

  static isLoggedIn() { return !!this.getToken(); }

  static requireAuth() {
    if (!this.isLoggedIn()) { window.location.href = '/login.html'; return false; }
    return true;
  }
}

// ===== TOAST =====
const Toast = {
  show(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || (() => {
      const d = document.createElement('div'); d.id = 'toast-container'; document.body.appendChild(d); return d;
    })();
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => { requestAnimationFrame(() => toast.classList.add('show')); });
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, duration);
  },
  success: (m, d) => Toast.show(m, 'success', d),
  error: (m, d) => Toast.show(m, 'error', d),
  info: (m, d) => Toast.show(m, 'info', d),
};

// ===== HELPERS =====
const timeAgo = (date) => {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff/60)} phút`;
  if (diff < 86400) return `${Math.floor(diff/3600)} giờ`;
  if (diff < 604800) return `${Math.floor(diff/86400)} ngày`;
  return new Date(date).toLocaleDateString('vi-VN');
};

const formatNum = (n) => {
  if (!n) return '0';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toString();
};

const avatarURL = (user) => user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || user?.username || '?')}&background=7C5CFC&color=fff&bold=true&size=200`;

const debounce = (fn, delay) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };

const loadingBtn = (btn, loading) => {
  if (loading) { btn.classList.add('btn-loading'); btn.disabled = true; }
  else { btn.classList.remove('btn-loading'); btn.disabled = false; }
};
