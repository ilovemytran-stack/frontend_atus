// ===== ICONS (inline SVG, stroke-based, inherits currentColor) =====
const Icon = (() => {
  const wrap = (path) => `<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  return {
    home: wrap('<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>'),
    search: wrap('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    film: wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/>'),
    message: wrap('<path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1 4.8A7.96 7.96 0 0 1 21 12Z"/>'),
    bell: wrap('<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    user: wrap('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
    logout: wrap('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
    admin: wrap('<path d="M12 2l8 4v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-4Z"/><path d="M9 12l2 2 4-4"/>'),
    sword: wrap('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>'),
    wallet: wrap('<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.4"/>'),
  };
})();


class Layout {
  static async init() {
    this.renderSidebar();
    this.renderBottomNav();
    this.renderToastContainer();
    this.setupMobileMenu();
    this.loadNotifCount();
    // Đồng bộ lại role/thông tin user mới nhất từ server (phòng khi bị đổi role
    // trực tiếp trong DB, hoặc bị khóa tài khoản) rồi render lại nếu có thay đổi.
    if (API.isLoggedIn()) {
      const before = JSON.stringify(API.getCurrentUser());
      const { user: fresh, banned, message } = await API.refreshUser();
      if (banned) {
        Toast.error(message || 'Tài khoản của bạn đã bị khóa.');
        API.removeToken();
        setTimeout(() => window.location.href = 'login.html', 1200);
        return;
      }
      if (JSON.stringify(fresh) !== before) {
        this.renderSidebar();
        this.renderBottomNav();
      }
    }
  }

  static renderSidebar() {
    const user = API.getCurrentUser();
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const current = location.pathname.split('/').pop();
    const navItems = [
      { href: 'index.html', icon: Icon.home, label: 'Trang chủ' },
      { href: 'explore.html', icon: Icon.search, label: 'Khám phá' },
      { href: 'videos.html', icon: Icon.film, label: 'Video' },
      { href: 'game.html', icon: Icon.sword, label: 'G.Legendary', gameNew: true },
      { href: 'wallet.html', icon: Icon.wallet, label: 'Ví Xu VIP' },
      { href: 'messages.html', icon: Icon.message, label: 'Tin nhắn', badge: 'msg' },
      { href: 'notifications.html', icon: Icon.bell, label: 'Thông báo', badge: 'notif' },
      { href: user ? `profile.html?u=${user.username}` : 'login.html', icon: Icon.user, label: 'Trang cá nhân' },
    ];
    if (user?.role === 'admin' || user?.role === 'moderator') {
      navItems.push({ href: 'admin.html', icon: Icon.admin, label: user.role === 'admin' ? 'Quản trị' : 'Điều hành' });
    }
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">🌐</div>
        <span class="sidebar-logo-text">Public</span>
      </div>
      ${user ? `<a href="wallet.html" class="sidebar-wallet-chip">
        <span class="sidebar-icon">${Icon.wallet}</span>
        <span>Xu VIP: <b id="sidebar-vipcoin">${user.vipCoin ?? 0}</b></span>
      </a>` : ''}
      <nav class="sidebar-nav">
        ${navItems.map(i => `
          <a href="${i.href}" class="sidebar-item ${current === i.href ? 'active' : ''} ${i.gameNew ? 'sidebar-item-game' : ''}">
            <span class="sidebar-icon">${i.icon}</span>
            <span class="sidebar-label">${i.label}</span>
            ${i.badge === 'notif' ? '<span class="sidebar-badge" id="notif-badge" style="display:none">0</span>' : ''}
            ${i.gameNew ? '<span class="sidebar-tag">MỚI</span>' : ''}
          </a>`).join('')}
      </nav>
      <div class="sidebar-actions">
        <button class="btn btn-primary sidebar-post-btn" onclick="openCreateModal()">+ Đăng bài</button>
      </div>
      <div class="sidebar-user ${user ? '' : 'sidebar-user-guest'}">
        ${user ? `
          <img src="${avatarURL(user)}" class="avatar avatar-sm" alt="">
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${user.displayName || user.username}</div>
            <div class="sidebar-user-handle">@${user.username}</div>
          </div>
          <button class="btn btn-ghost btn-icon" onclick="API.logout()" title="Đăng xuất">${Icon.logout}</button>
        ` : `<a href="login.html" class="btn btn-primary" style="width:100%">Đăng nhập</a>`}
      </div>`;
  }

  static renderBottomNav() {
    const user = API.getCurrentUser();
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    const current = location.pathname.split('/').pop();
    const items = [
      { href: 'index.html', icon: Icon.home, label: 'Home' },
      { href: 'explore.html', icon: Icon.search, label: 'Explore' },
      { href: 'videos.html', icon: Icon.film, label: 'Video' },
      { href: 'notifications.html', icon: Icon.bell, label: 'Thông báo' },
      { href: user ? `profile.html?u=${user.username}` : 'login.html', icon: user?.avatar ? `<img src="${user.avatar}" class="avatar avatar-xs" alt="">` : Icon.user, label: 'Cá nhân' },
    ];
    nav.innerHTML = items.map(i => `
      <a href="${i.href}" class="bottom-nav-item ${current === i.href ? 'active' : ''}">
        <span class="icon">${i.icon}</span>
        <span>${i.label}</span>
      </a>`).join('')
      + (user ? `
      <a href="#" class="bottom-nav-item" onclick="API.logout(); return false;">
        <span class="icon">${Icon.logout}</span>
        <span>Đăng xuất</span>
      </a>` : '');
  }

  static renderToastContainer() {
    if (!document.getElementById('toast-container')) {
      const d = document.createElement('div'); d.id = 'toast-container'; document.body.appendChild(d);
    }
  }

  static setupMobileMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!menuBtn || !sidebar) return;
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    });
    if (overlay) overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  static async loadNotifCount() {
    if (!API.isLoggedIn()) return;
    const res = await API.get('/notifications?limit=1');
    if (res?.success && res.unreadCount > 0) {
      const badge = document.getElementById('notif-badge');
      if (badge) { badge.textContent = res.unreadCount > 99 ? '99+' : res.unreadCount; badge.style.display = 'flex'; }
    }
  }
}
