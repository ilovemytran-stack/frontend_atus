// ===== MOTION SIMULATION — điều khiển trang bằng cử chỉ tay qua webcam =====
// Bật/tắt qua mục "Mô phỏng chuyển động" trong sidebar (xem layout.js: Icon.motion + navItems).
// Cử chỉ:
//   - Chụm ngón cái + trỏ .......... click tại vị trí con trỏ ảo
//   - Nắm bàn tay (4 ngón cong) .... đăng xuất (gọi API.logout() thật)
//   - Xòe 3 ngón (cái,trỏ,giữa),     zoom ảnh gần con trỏ nhất
//     ngón áp út+út cong, banh/khép
//   - Bàn tay mở, đưa lên/xuống .... di chuyển con trỏ (mọi hướng)
//   - Vẫy tay mở nhanh lên/xuống ... cuộn trang (chỉ khi đủ nhanh)
//   - Vỗ 2 tay vào nhau ............ thử đóng trang
//
// Yêu cầu HTTPS (hoặc localhost) + quyền camera — getUserMedia() bị chặn trên file://.
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";

const CONFIG = {
  PINCH_THRESHOLD: 0.35,          // khoảng cách ngón cái-trỏ (chuẩn hóa theo cỡ bàn tay) để tính là "chụm"
  EXTEND_RATIO: 1.1,              // đầu ngón phải xa cổ tay hơn khớp mcp bao nhiêu lần để tính là "duỗi"
  SCROLL_VELOCITY_THRESHOLD: 0.15, // tốc độ tối thiểu (đơn vị chuẩn hóa/giây) của cổ tay để kích hoạt cuộn trang
  SCROLL_SENSITIVITY: 5,
  ZOOM_SENSITIVITY: 3.5,
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 3,
  CLAP_DISTANCE_THRESHOLD: 0.22,  // khoảng cách giữa tâm 2 bàn tay để tính là "vỗ tay"
  CLAP_COOLDOWN_MS: 1800,
  FIST_HOLD_MS: 1100,             // phải giữ nắm tay liên tục ngần này mới đăng xuất thật — tránh mất phiên do dính cử chỉ thoáng qua
  CURSOR_SMOOTHING: 0.35,
  HAND_ICON_SMOOTHING: 0.25,
};

/* ---- Toán học landmark bàn tay (MediaPipe: 0 cổ tay, 4 đầu ngón cái, 8 đầu ngón trỏ,
   12 đầu ngón giữa, 16 đầu ngón áp út, 20 đầu ngón út; khớp mcp: 5/9/13/17) ---- */
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function handScale(lm) { return dist(lm[0], lm[9]) || 0.0001; }
function isExtended(lm, tipIdx, mcpIdx) { return dist(lm[tipIdx], lm[0]) > dist(lm[mcpIdx], lm[0]) * CONFIG.EXTEND_RATIO; }

function fingerStates(lm) {
  return {
    thumb: dist(lm[4], lm[17]) > dist(lm[2], lm[17]) * 1.05,
    index: isExtended(lm, 8, 5),
    middle: isExtended(lm, 12, 9),
    ring: isExtended(lm, 16, 13),
    pinky: isExtended(lm, 20, 17),
  };
}

function palmCenter(lm) {
  const idxs = [0, 5, 9, 13, 17];
  let x = 0, y = 0;
  idxs.forEach(i => { x += lm[i].x; y += lm[i].y; });
  return { x: x / idxs.length, y: y / idxs.length };
}

// Thứ tự ưu tiên: fist > pinch > threeOpen > open (mặc định, chỉ di chuyển con trỏ)
function classifyGesture(lm) {
  const f = fingerStates(lm);
  if (!f.index && !f.middle && !f.ring && !f.pinky) return 'fist';
  const pinchDist = dist(lm[4], lm[8]) / handScale(lm);
  if (pinchDist < CONFIG.PINCH_THRESHOLD) return 'pinch';
  if (f.thumb && f.index && f.middle && !f.ring && !f.pinky) return 'threeOpen';
  return 'open';
}

const GESTURE_LABELS = { fist: 'Nắm tay (đăng xuất)', pinch: 'Chụm ngón (click)', threeOpen: '3 ngón mở (zoom)', open: 'Mở tay (di chuyển/cuộn)' };

class MotionSimulation {
  static state = {
    handLandmarker: null,
    running: false,
    lastVideoTime: -1,
    cursorX: window.innerWidth / 2, cursorY: window.innerHeight / 2,
    targetX: window.innerWidth / 2, targetY: window.innerHeight / 2,
    pinchActive: false,
    fistActive: false,
    fistHoldStart: null,
    zoomBaseSpread: null,
    prevWristY: null, prevWristT: 0,
    lastClapTime: 0,
    handIconSmooth: {},
  };

  static init() {
    this.injectDOM();
    this.bindStaticEvents();
  }

  /* Tự tạo modal/palette/cursor và gắn vào <body> — không cần sửa markup từng trang,
     giống cách layout.js tự dựng ai-widget / announcement modal. */
  static injectDOM() {
    if (document.getElementById('msConfirmModal')) return; // phòng khi init() bị gọi lại

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'msConfirmModal';
    modal.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-header">
          <div class="modal-title">Mô phỏng chuyển động</div>
          <button class="modal-close btn btn-ghost btn-icon" id="msConfirmCloseBtn">✕</button>
        </div>
        <p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.6;margin-bottom:20px">
          Điều khiển trang bằng cử chỉ tay qua webcam: di chuyển chuột, click, cuộn trang, zoom ảnh, đăng xuất...
          Cần quyền truy cập camera.
        </p>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary" style="flex:1" id="msConfirmNoBtn">Để sau</button>
          <button class="btn btn-primary" style="flex:1" id="msConfirmYesBtn">Bật</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const palette = document.createElement('div');
    palette.className = 'ms-palette';
    palette.id = 'msPalette';
    palette.innerHTML = `
      <div class="ms-palette-handle" id="msPaletteHandle">
        <span>MOTION SIM</span>
        <button class="btn btn-ghost btn-icon-sm" id="msStopBtn" title="Tắt">✕</button>
      </div>
      <div class="ms-preview">
        <video id="msVideo" autoplay playsinline muted></video>
        <canvas id="msCanvas"></canvas>
      </div>
      <div class="ms-status">
        <div class="ms-status-row"><span>Tay</span><span id="msStatHands">0</span></div>
        <div class="ms-status-row"><span>Cử chỉ</span><span id="msStatGesture">—</span></div>
      </div>`;
    document.body.appendChild(palette);

    const cursor = document.createElement('div');
    cursor.id = 'msCursor';
    cursor.innerHTML = `
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="9" fill="none" stroke="#7C5CFC" stroke-width="1.5" opacity="0.9"/>
        <circle cx="14" cy="14" r="2.5" fill="#7C5CFC"/>
        <line x1="14" y1="2" x2="14" y2="7" stroke="#7C5CFC" stroke-width="1.5"/>
        <line x1="14" y1="21" x2="14" y2="26" stroke="#7C5CFC" stroke-width="1.5"/>
        <line x1="2" y1="14" x2="7" y2="14" stroke="#7C5CFC" stroke-width="1.5"/>
        <line x1="21" y1="14" x2="26" y2="14" stroke="#7C5CFC" stroke-width="1.5"/>
      </svg>`;
    document.body.appendChild(cursor);
  }

  static bindStaticEvents() {
    document.getElementById('msConfirmYesBtn').addEventListener('click', async () => { this.closeConfirm(); await this.start(); });
    document.getElementById('msConfirmNoBtn').addEventListener('click', () => this.closeConfirm());
    document.getElementById('msConfirmCloseBtn').addEventListener('click', () => this.closeConfirm());
    document.getElementById('msStopBtn').addEventListener('click', () => this.stop());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.state.running) this.stop(); });
    this.makeDraggable(document.getElementById('msPaletteHandle'), document.getElementById('msPalette'));
    window.addEventListener('resize', () => { if (this.state.running) this.resizeCanvas(); });
  }

  static openConfirm() { document.getElementById('msConfirmModal').classList.add('active'); }
  static closeConfirm() { document.getElementById('msConfirmModal').classList.remove('active'); }

  static async start() {
    const palette = document.getElementById('msPalette');
    palette.classList.add('visible');
    this.setStatus(0, 'Đang khởi động…');
    try {
      const video = document.getElementById('msVideo');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      video.srcObject = stream;
      await video.play();

      if (!this.state.handLandmarker) {
        this.setStatus(0, 'Đang tải mô hình…');
        this.state.handLandmarker = await this.createHandLandmarker();
      }

      this.resizeCanvas();
      document.getElementById('msCursor').classList.add('visible');
      this.state.running = true;
      requestAnimationFrame(() => this.loop());
    } catch (err) {
      console.error('MotionSimulation: khởi động camera/model thất bại', err);
      Toast.error('Không dùng được camera — kiểm tra quyền truy cập camera của trình duyệt.');
      palette.classList.remove('visible');
    }
  }

  static stop() {
    this.state.running = false;
    const video = document.getElementById('msVideo');
    if (video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
    document.getElementById('msPalette').classList.remove('visible');
    document.getElementById('msCursor').classList.remove('visible');
    this.state.pinchActive = this.state.fistActive = false;
    this.state.zoomBaseSpread = null;
    this.state.prevWristY = null;
  }

  static async createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
    const modelAssetPath = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
    try {
      return await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2 });
    } catch (e) {
      console.warn('MotionSimulation: GPU delegate lỗi, chuyển sang CPU', e);
      return await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath, delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2 });
    }
  }

  static resizeCanvas() {
    const canvas = document.getElementById('msCanvas');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  /* Vòng lặp chính: nhận diện khi có khung hình mới, làm mượt + vẽ mỗi tick */
  static loop() {
    const s = this.state;
    if (!s.running) return;
    const now = performance.now();
    const video = document.getElementById('msVideo');

    if (video.currentTime !== s.lastVideoTime) {
      s.lastVideoTime = video.currentTime;
      const result = s.handLandmarker.detectForVideo(video, now);
      this.processResult(result.landmarks || [], now);
    }

    s.cursorX += (s.targetX - s.cursorX) * CONFIG.CURSOR_SMOOTHING;
    s.cursorY += (s.targetY - s.cursorY) * CONFIG.CURSOR_SMOOTHING;
    document.getElementById('msCursor').style.transform = `translate(${s.cursorX}px, ${s.cursorY}px)`;

    requestAnimationFrame(() => this.loop());
  }

  static processResult(hands, now) {
    const s = this.state;
    this.drawPaletteOverlay(hands);

    if (hands.length === 0) {
      this.setStatus(0, '—');
      s.pinchActive = s.fistActive = false;
      s.zoomBaseSpread = null;
      s.prevWristY = null;
      return;
    }

    const primary = hands[0];
    const gesture = classifyGesture(primary);

    // Con trỏ luôn bám theo đầu ngón trỏ — lên/xuống/trái/phải/chéo đều được vì đây là
    // ánh xạ vị trí liên tục, không phải các vùng rời rạc. Trục x đảo ngược để khớp
    // video soi gương (transform: scaleX(-1) trong CSS).
    const tip = primary[8];
    s.targetX = (1 - tip.x) * window.innerWidth;
    s.targetY = tip.y * window.innerHeight;

    if (gesture === 'pinch') {
      if (!s.pinchActive) { s.pinchActive = true; this.simulateClick(s.cursorX, s.cursorY); }
    } else s.pinchActive = false;

    if (gesture === 'fist') {
      if (s.fistHoldStart === null) s.fistHoldStart = now;
      const held = now - s.fistHoldStart;
      if (held >= CONFIG.FIST_HOLD_MS) {
        if (!s.fistActive) { s.fistActive = true; this.triggerLogout(); }
      } else {
        this.setStatus(hands.length, `Giữ nắm tay để đăng xuất… ${Math.ceil((CONFIG.FIST_HOLD_MS - held) / 100) / 10}s`);
      }
    } else {
      s.fistActive = false;
      s.fistHoldStart = null;
    }

    if (gesture === 'threeOpen') this.handleZoom(primary, s.cursorX, s.cursorY);
    else s.zoomBaseSpread = null;

    // Cuộn trang: chỉ xét khi tay đang ở trạng thái "mở" và di chuyển đủ nhanh
    // (vẫy tay), tách riêng khỏi lúc đang chụm/nắm/zoom để tránh chồng chéo cử chỉ.
    if (gesture === 'open') this.handleScroll(primary[0].y, now);
    else s.prevWristY = null;

    if (hands.length === 2) {
      const d = dist(palmCenter(hands[0]), palmCenter(hands[1]));
      if (d < CONFIG.CLAP_DISTANCE_THRESHOLD && now - s.lastClapTime > CONFIG.CLAP_COOLDOWN_MS) {
        s.lastClapTime = now;
        this.triggerClose();
      }
    }

    if (!(gesture === 'fist' && now - s.fistHoldStart < CONFIG.FIST_HOLD_MS)) {
      this.setStatus(hands.length, GESTURE_LABELS[gesture] || gesture);
    }
  }

  static simulateClick(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    ['mousedown', 'mouseup', 'click'].forEach(type => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
    });
  }

  static handleZoom(lm, cx, cy) {
    const s = this.state;
    const scale = handScale(lm);
    const spread = (dist(lm[4], lm[8]) + dist(lm[8], lm[12]) + dist(lm[4], lm[12])) / 3 / scale;
    if (s.zoomBaseSpread === null) { s.zoomBaseSpread = spread; return; }
    const delta = spread - s.zoomBaseSpread;
    s.zoomBaseSpread = spread;

    let el = document.elementFromPoint(cx, cy);
    while (el && el !== document.body && el.tagName !== 'IMG') el = el.parentElement;
    if (!el || el === document.body) return; // không có ảnh dưới con trỏ — bỏ qua

    const next = Math.min(CONFIG.ZOOM_MAX, Math.max(CONFIG.ZOOM_MIN, parseFloat(el.dataset.msScale || '1') + delta * CONFIG.ZOOM_SENSITIVITY));
    el.dataset.msScale = next;
    el.style.transition = 'transform 0.05s linear';
    el.style.transform = `scale(${next})`;
  }

  static handleScroll(wristY, now) {
    // Chênh lệch giữa 2 khung hình liên tiếp (không dùng cửa sổ trượt gộp nhiều khung
    // hình) — mỗi khung hình đóng góp độc lập nên tốc độ cuộn không bị cộng dồn/lệch.
    const s = this.state;
    if (s.prevWristY === null) { s.prevWristY = wristY; s.prevWristT = now; return; }
    const dt = (now - s.prevWristT) / 1000;
    if (dt <= 0) return;
    const dy = wristY - s.prevWristY;
    s.prevWristY = wristY; s.prevWristT = now;
    if (Math.abs(dy) / dt > CONFIG.SCROLL_VELOCITY_THRESHOLD) {
      window.scrollBy(0, dy * window.innerHeight * CONFIG.SCROLL_SENSITIVITY);
    }
  }

  static triggerClose() {
    Toast.info('👏 Phát hiện vỗ tay — nếu trình duyệt chặn tự đóng tab, hãy đóng thủ công.');
    // Trình duyệt chỉ cho phép script tự đóng tab/cửa sổ do chính nó mở ra bằng script,
    // nên với tab người dùng tự mở, lệnh dưới đây thường không có tác dụng — đó là giới
    // hạn bảo mật của trình duyệt, không phải lỗi của code.
    window.close();
  }

  static triggerLogout() {
    Toast.info('✊ Phát hiện nắm tay — đang đăng xuất...');
    this.stop();
    API.logout();
  }

  /* "2 hình bàn tay" bám theo chuyển động thật, vẽ đè lên khung camera trong palette */
  static drawPaletteOverlay(hands) {
    const canvas = document.getElementById('msCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    hands.slice(0, 2).forEach((lm, i) => {
      const c = palmCenter(lm);
      const x = (1 - c.x) * w, y = c.y * h;
      const smooth = this.state.handIconSmooth;
      const sPos = smooth[i] || (smooth[i] = { x, y });
      sPos.x += (x - sPos.x) * CONFIG.HAND_ICON_SMOOTHING;
      sPos.y += (y - sPos.y) * CONFIG.HAND_ICON_SMOOTHING;
      ctx.save();
      ctx.translate(sPos.x, sPos.y);
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(124,92,252,.9)';
      ctx.shadowBlur = 8;
      ctx.fillText('🖐️', 0, 0);
      ctx.restore();
    });
  }

  static makeDraggable(handleEl, panelEl) {
    let dragging = false, startX, startY, startLeft, startTop;
    const down = (e) => {
      dragging = true;
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX; startY = pt.clientY;
      const rect = panelEl.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - startX, dy = pt.clientY - startY;
      panelEl.style.left = Math.max(0, Math.min(window.innerWidth - 40, startLeft + dx)) + 'px';
      panelEl.style.top = Math.max(0, Math.min(window.innerHeight - 40, startTop + dy)) + 'px';
      panelEl.style.right = 'auto';
    };
    const up = () => { dragging = false; };
    handleEl.addEventListener('mousedown', down);
    handleEl.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
  }

  static setStatus(handCount, gestureLabel) {
    document.getElementById('msStatHands').textContent = handCount;
    document.getElementById('msStatGesture').textContent = gestureLabel;
  }
}

document.addEventListener('DOMContentLoaded', () => MotionSimulation.init());
window.MotionSimulation = MotionSimulation; // để onclick="MotionSimulation.openConfirm()" trong layout.js gọi được
