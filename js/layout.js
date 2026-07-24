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
    handdraw: wrap('<path d="M7 21c-2-3-3-6-3-9a3 3 0 0 1 6 0v3"/><path d="M10 12V6a1.6 1.6 0 0 1 3.2 0v5"/><path d="M13.2 11V5a1.6 1.6 0 0 1 3.2 0v6"/><path d="M16.4 11.5V7a1.6 1.6 0 0 1 3.2 0v7c0 4-2.5 7-6 7h-1c-2.5 0-3.8-1-5-2.5"/>'),
    cube: wrap('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5L12 12l8-4.5M12 12v9"/>'),
    sparkle: wrap('<path d="M12 2 13.2 9.8 21 11 13.2 12.2 12 20 10.8 12.2 3 11 10.8 9.8Z"/>'),
    send: wrap('<path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9 22 2Z"/>'),
    motion: wrap('<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/>'),
    atelier: wrap('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h13M21 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
    shop: wrap('<path d="M6 8V6a6 6 0 0 1 12 0v2"/><path d="M4 8h16l-1.2 12a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8Z"/>'),
  };
})();

// Lịch sử hội thoại của trợ lý AI (giữ trong bộ nhớ tab, không lưu localStorage)
let aiHistory = [];

class Layout {
  static async init() {
    this.renderSidebar();
    this.renderBottomNav();
    this.renderToastContainer();
    this.setupMobileMenu();
    this.loadNotifCount();
    this.renderAIWidget();
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
      this.checkAnnouncement();
    }
  }

  static renderSidebar() {
    const user = API.getCurrentUser();
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.add('glass', 'glass-sidebar'); // vô hại nếu trang chưa link liquid-glass.css — chỉ là class rỗng
    document.querySelector('.main-content')?.classList.add('has-glass-sidebar'); // đẩy nội dung chính ra đúng khoảng trống của sidebar nổi — làm bằng JS cho chắc, không phụ thuộc selector CSS phức tạp
    const current = location.pathname.split('/').pop();
    const navItems = [
      { href: 'feed.html', icon: Icon.home, label: 'Trang chủ' },
      { href: 'explore.html', icon: Icon.search, label: 'Khám phá' },
      { href: 'videos.html', icon: Icon.film, label: 'Video' },
      { href: 'game.html', icon: Icon.sword, label: 'G.Legendary', gameNew: true },
      { href: 'vboard.html', icon: Icon.handdraw, label: 'VBoard', vboardNew: true },
      { href: '3d.html', icon: Icon.cube, label: '3D', threedNew: true },
      { href: 'atelier.html', icon: Icon.atelier, label: 'Atelier', atelierNew: true },
      { href: 'javascript:void(0)', icon: Icon.motion, label: 'Mô phỏng chuyển động', onclick: 'MotionSimulation.openConfirm()', motionNew: true },
      { href: 'wallet.html', icon: Icon.wallet, label: 'Ví Xu VIP', vipCoinBadge: true },
      { href: 'root-shop.html', icon: Icon.shop, label: 'Cửa hàng', shopNew: true },
      { href: 'messages.html', icon: Icon.message, label: 'Tin nhắn', badge: 'msg' },
      { href: 'notifications.html', icon: Icon.bell, label: 'Thông báo', badge: 'notif' },
      { href: user ? `profile.html?u=${user.username}` : 'login.html', icon: Icon.user, label: 'Trang cá nhân' },
    ];
    if (user?.role === 'admin' || user?.role === 'moderator') {
      navItems.push({ href: 'admin.html', icon: Icon.admin, label: user.role === 'admin' ? 'Quản trị' : 'Điều hành' });
    }
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--electric-cyan, var(--brand))"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z"/></svg></div>
        <span class="sidebar-logo-text">Public</span>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map(i => `
          <a href="${i.href}"${i.onclick ? ` onclick="${i.onclick}"` : ''} class="sidebar-item glass-btn ${current === i.href ? 'active lg-active-glow' : ''} ${i.gameNew ? 'sidebar-item-game' : ''}">
            <span class="sidebar-icon">${i.icon}</span>
            <span class="sidebar-label">${i.label}</span>
            ${i.badge === 'notif' ? '<span class="sidebar-badge" id="notif-badge" style="display:none">0</span>' : ''}
            ${i.vipCoinBadge ? `<span class="sidebar-badge sidebar-badge-gold" id="sidebar-vipcoin">${user?.vipCoin ?? 0}</span>` : ''}
            ${i.gameNew || i.vboardNew || i.threedNew || i.motionNew || i.atelierNew || i.shopNew ? '<span class="sidebar-tag">MỚI</span>' : ''}
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
    nav.classList.add('glass', 'glass-bottomnav');
    const current = location.pathname.split('/').pop();
    const items = [
      { href: 'feed.html', icon: Icon.home, label: 'Home' },
      { href: 'explore.html', icon: Icon.search, label: 'Explore' },
      { href: 'videos.html', icon: Icon.film, label: 'Video' },
      { href: 'atelier.html', icon: Icon.atelier, label: 'Atelier' },
      { href: 'root-shop.html', icon: Icon.shop, label: 'Shop' },
      { href: 'notifications.html', icon: Icon.bell, label: 'Thông báo' },
      { href: user ? `profile.html?u=${user.username}` : 'login.html', icon: user?.avatar ? `<img src="${user.avatar}" class="avatar avatar-xs" alt="">` : Icon.user, label: 'Cá nhân' },
    ];
    nav.innerHTML = items.map(i => `
      <a href="${i.href}" class="bottom-nav-item glass-btn ${current === i.href ? 'active lg-active-glow' : ''}">
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

  // Thông báo hệ thống (popup toàn server) — CHỈ hiện ở trang chủ, không làm phiền các trang khác
  static async checkAnnouncement() {
    const page = location.pathname.split('/').pop();
    if (page !== 'feed.html') return; // "/" và "index.html" giờ là Welcome — không hiện thông báo đè lên phần mở đầu
    try {
      const res = await API.get('/announcements/active');
      const ann = res?.announcement;
      if (!ann) return;
      const hideUntil = Number(localStorage.getItem(`ann_hide_${ann._id}`) || 0);
      if (Date.now() < hideUntil) return;
      this.showAnnouncementModal(ann);
    } catch { /* im lặng bỏ qua nếu lỗi mạng, không chặn tải trang */ }
  }

  static showAnnouncementModal(ann) {
    const wrap = document.createElement('div');
    wrap.className = 'ann-modal-overlay';
    wrap.innerHTML = `
      <div class="ann-modal">
        <canvas class="ann-modal-three" id="annModalThree"></canvas>
        <div class="ann-modal-body">
          <div class="ann-modal-icon">${Icon.bell}</div>
          <h3>Thông báo</h3>
          <p>${String(ann.text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>
          <div class="ann-modal-actions">
            <button class="btn btn-ghost" id="annBtnHide24">Ẩn 24 giờ</button>
            <button class="btn btn-primary" id="annBtnClose">Đóng</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));

    const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 220); };
    wrap.querySelector('#annBtnClose').addEventListener('click', close);
    wrap.querySelector('#annBtnHide24').addEventListener('click', () => {
      localStorage.setItem(`ann_hide_${ann._id}`, String(Date.now() + 24 * 60 * 60 * 1000));
      close();
    });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });

    if (window.initThreeOrb) window.initThreeOrb(document.getElementById('annModalThree'));
  }

  // ===== Trợ lý AI (hỏi-đáp về Public + G.Legendary) =====
  static renderAIWidget() {
    if (document.getElementById('ai-widget')) return; // phòng khi init() bị gọi lại
    const wrap = document.createElement('div');
    wrap.id = 'ai-widget';
    wrap.className = 'ai-widget';
    wrap.innerHTML = `
      <button class="ai-toggle-btn" id="aiToggleBtn" aria-label="Mở trợ lý AI">${Icon.sparkle}</button>
      <div class="ai-panel card" id="aiPanel" hidden>
        <div class="ai-panel-header">
          <span>${Icon.sparkle} Trợ lý G.Legendary</span>
          <button class="btn btn-ghost btn-icon-sm" id="aiCloseBtn" aria-label="Đóng">✕</button>
        </div>
        <div class="ai-messages" id="aiMessages">
          <div class="ai-bubble ai-bubble-assistant">Chào bạn 👋 Hỏi mình về Public hoặc G.Legendary nhé — lớp nhân vật, map, boss, trang bị...</div>
        </div>
        <form class="ai-form" id="aiForm">
          <input class="input" id="aiInput" placeholder="Nhập câu hỏi..." maxlength="2000" autocomplete="off">
          <button type="submit" class="btn btn-primary btn-icon" id="aiSendBtn" aria-label="Gửi">${Icon.send}</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);

    const panel = document.getElementById('aiPanel');
    const togglePanel = () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) document.getElementById('aiInput').focus();
    };
    document.getElementById('aiToggleBtn').addEventListener('click', togglePanel);
    document.getElementById('aiCloseBtn').addEventListener('click', togglePanel);
    document.getElementById('aiForm').addEventListener('submit', (e) => this.handleAISubmit(e));
  }

  static appendAIBubble(role, text) {
    const box = document.getElementById('aiMessages');
    const b = document.createElement('div');
    b.className = `ai-bubble ai-bubble-${role}`;
    b.textContent = text;
    box.appendChild(b);
    box.scrollTop = box.scrollHeight;
    return b;
  }

  static async handleAISubmit(e) {
    e.preventDefault();
    const input = document.getElementById('aiInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    this.appendAIBubble('user', msg);
    const typing = this.appendAIBubble('assistant', '...');
    const sendBtn = document.getElementById('aiSendBtn');
    sendBtn.disabled = true;

    const res = await API.post('/ai/chat', { message: msg, history: aiHistory });
    typing.remove();
    sendBtn.disabled = false;

    if (!res) { Toast.error('Không kết nối được, kiểm tra mạng.'); return; }
    if (!res.success) { this.appendAIBubble('assistant', res.message || 'Có lỗi xảy ra.'); return; }

    this.appendAIBubble('assistant', res.reply);
    aiHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: res.reply });
    aiHistory = aiHistory.slice(-20);
  }
}
