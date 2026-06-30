// ===== LAYOUT / SIDEBAR =====
class Layout {
  static init() {
    this.renderSidebar();
    this.renderBottomNav();
    this.renderToastContainer();
    this.setupMobileMenu();
    this.loadNotifCount();
  }

  static renderSidebar() {
    const user = API.getCurrentUser();
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const current = location.pathname.split('/').pop();
    const navItems = [
      { href: 'index.html', icon: '🏠', label: 'Trang chủ' },
      { href: 'explore.html', icon: '🧭', label: 'Khám phá' },
      { href: 'search.html', icon: '🔍', label: 'Tìm kiếm' },
      { href: 'videos.html', icon: '🎬', label: 'Video' },
      { href: 'messages.html', icon: '💬', label: 'Tin nhắn', badge: 'msg' },
      { href: 'notifications.html', icon: '🔔', label: 'Thông báo', badge: 'notif' },
      { href: user ? `profile.html?u=${user.username}` : 'login.html', icon: '👤', label: 'Trang cá nhân' },
    ];
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">🌐</div>
        <span class="sidebar-logo-text">SocialShop</span>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map(i => `
          <a href="${i.href}" class="sidebar-item ${current === i.href ? 'active' : ''}">
            <span class="sidebar-icon">${i.icon}</span>
            <span class="sidebar-label">${i.label}</span>
            ${i.badge === 'notif' ? '<span class="sidebar-badge" id="notif-badge" style="display:none">0</span>' : ''}
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
          <button class="btn btn-ghost btn-icon" onclick="API.logout()" title="Đăng xuất">🚪</button>
        ` : `<a href="login.html" class="btn btn-primary" style="width:100%">Đăng nhập</a>`}
      </div>`;
  }

  static renderBottomNav() {
    const user = API.getCurrentUser();
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    const current = location.pathname.split('/').pop();
    const items = [
      { href: 'index.html', icon: '🏠', label: 'Home' },
      { href: 'explore.html', icon: '🧭', label: 'Explore' },
      { href: 'search.html', icon: '🔍', label: 'Search' },
      { href: 'videos.html', icon: '🎬', label: 'Video' },
      { href: 'notifications.html', icon: '🔔', label: 'Thông báo' },
      { href: user ? `profile.html?u=${user.username}` : 'login.html', icon: user?.avatar ? `<img src="${user.avatar}" class="avatar avatar-xs" alt="">` : '👤', label: 'Cá nhân' },
    ];
    nav.innerHTML = items.map(i => `
      <a href="${i.href}" class="bottom-nav-item ${current === i.href ? 'active' : ''}">
        <span class="icon">${i.icon}</span>
        <span>${i.label}</span>
      </a>`).join('')
      + (user ? `
      <a href="#" class="bottom-nav-item" onclick="API.logout(); return false;">
        <span class="icon">🚪</span>
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
