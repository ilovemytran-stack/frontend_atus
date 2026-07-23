// ============================================================================
// VBoard (web) — chuyển thể từ vboard-main/cam_draw.py (OpenCV + MediaPipe Python)
// sang MediaPipe Tasks Vision chạy thẳng trên trình duyệt (getUserMedia + Canvas2D).
// Cùng logic nhận diện cử chỉu: 1 ngón trỏ = vẽ, trỏ+giữa = xoá, có làm mượt con trỏ.
// ============================================================================
(function () {
  const PALETTE = [
    { name: 'Xanh lá', color: '#37AF00' },
    { name: 'Xanh dương', color: '#0087BE' },
    { name: 'Hồng', color: '#BE0078' },
    { name: 'Cam', color: '#BE5F00' },
    { name: 'Trắng', color: '#E6E6E6' },
  ];
  const SMOOTH_FACTOR = 0.36;
  const FINGER_UP_GAP_RATIO = 0.02;   // tỉ lệ theo chiều cao canvas, tương đương ~20px @540p bản gốc
  const FINGER_EXT_RATIO = 0.58;
  const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

  const state = {
    colorIdx: 0,
    brushSize: 8,
    eraserSize: 38,
    prevPoint: null,
    mode: 'IDLE',
    running: false,
    landmarker: null,
    lastFpsTime: performance.now(),
    frames: 0,
    fps: 0,
  };

  let video, canvas, ctx, stage;
  let els = {};

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Cổng y hệt classify_gesture() bản Python, chỉ đổi đơn vị pixel Python -> toạ độ pixel canvas web.
  function classifyGesture(lm, canvasH) {
    const gap = canvasH * FINGER_UP_GAP_RATIO;
    const idxUp = lm[8].y < lm[6].y - gap;
    const midUp = lm[12].y < lm[10].y - gap;
    const palmSize = Math.max(dist(lm[0], lm[9]), dist(lm[5], lm[17]), 0.001);
    const idxExt = dist(lm[8], lm[5]) > palmSize * FINGER_EXT_RATIO;
    if (idxUp && midUp) return 'ERASING';
    if (idxUp || idxExt) return 'DRAWING';
    return 'IDLE';
  }

  function toPixels(lm, w, h) {
    return lm.map((p) => ({ x: p.x * w, y: p.y * h }));
  }

  function updateHud() {
    els.modeTag.textContent = state.mode;
    els.modeTag.className = 'vboard-mode-tag ' + (state.mode === 'DRAWING' ? 'drawing' : state.mode === 'ERASING' ? 'erasing' : '');
    els.hudDot.style.background = PALETTE[state.colorIdx].color;
    els.fpsTag.textContent = 'FPS: ' + state.fps.toFixed(0);
    els.brushTag.textContent = state.mode === 'ERASING' ? `Xoá ${state.eraserSize}px` : `Cọ ${state.brushSize}px`;
  }

  function drawFrame(landmarks) {
    const w = canvas.width, h = canvas.height;
    if (!landmarks) {
      state.prevPoint = null;
      state.mode = 'IDLE';
      updateHud();
      return;
    }
    const pts = toPixels(landmarks, w, h);
    state.mode = classifyGesture(pts, h);

    const target = pts[8]; // đầu ngón trỏ
    const cursor = state.prevPoint
      ? { x: state.prevPoint.x * (1 - SMOOTH_FACTOR) + target.x * SMOOTH_FACTOR, y: state.prevPoint.y * (1 - SMOOTH_FACTOR) + target.y * SMOOTH_FACTOR }
      : { x: target.x, y: target.y };

    if (state.mode === 'DRAWING') {
      if (state.prevPoint) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = PALETTE[state.colorIdx].color;
        ctx.lineWidth = state.brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(state.prevPoint.x, state.prevPoint.y);
        ctx.lineTo(cursor.x, cursor.y);
        ctx.stroke();
      }
      state.prevPoint = cursor;
    } else if (state.mode === 'ERASING') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, state.eraserSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      state.prevPoint = null;
    } else {
      state.prevPoint = null;
    }
    updateHud();
  }

  async function loop() {
    if (!state.running) return;
    if (video.readyState >= 2) {
      const result = state.landmarker.detectForVideo(video, performance.now());
      const lm = result.landmarks && result.landmarks[0] ? result.landmarks[0] : null;
      drawFrame(lm);
      state.frames++;
      const now = performance.now();
      if (now - state.lastFpsTime > 500) {
        state.fps = (state.frames * 1000) / (now - state.lastFpsTime);
        state.frames = 0;
        state.lastFpsTime = now;
      }
    }
    requestAnimationFrame(loop);
  }

  async function startCamera() {
    els.overlayText.textContent = 'Đang khởi động camera và mô hình nhận diện tay…';
    els.startBtn.disabled = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 540, facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      await new Promise((resolve) => { video.onloadedmetadata = resolve; });
      await video.play();
      canvas.width = video.videoWidth || 960;
      canvas.height = video.videoHeight || 540;

      if (typeof vision === 'undefined') throw new Error('Không tải được thư viện MediaPipe (kiểm tra kết nối mạng).');
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      state.landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      els.startOverlay.style.display = 'none';
      els.hud.style.display = 'flex';
      els.controls.style.display = 'flex';
      renderPalette();
      state.running = true;
      loop();
    } catch (err) {
      console.error(err);
      els.overlayText.textContent = 'Không thể bật camera: ' + (err.message || err) + '. Hãy cho phép quyền camera rồi thử lại.';
      els.startBtn.disabled = false;
    }
  }

  function renderPalette() {
    els.colors.innerHTML = PALETTE.map((c, i) =>
      `<div class="vboard-swatch ${i === state.colorIdx ? 'active' : ''}" style="background:${c.color}" data-idx="${i}" title="${c.name}"></div>`
    ).join('');
    els.colors.querySelectorAll('.vboard-swatch').forEach((el) => {
      el.addEventListener('click', () => {
        state.colorIdx = Number(el.dataset.idx);
        renderPalette();
      });
    });
  }

  function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

  function saveCanvas() {
    const link = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `vboard_${ts}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function init() {
    video = document.getElementById('vboardVideo');
    canvas = document.getElementById('vboardCanvas');
    ctx = canvas.getContext('2d');
    stage = document.getElementById('vboardStage');
    els = {
      hud: document.getElementById('vboardHud'),
      hudDot: document.getElementById('vboardHudDot'),
      modeTag: document.getElementById('vboardModeTag'),
      fpsTag: document.getElementById('vboardFpsTag'),
      brushTag: document.getElementById('vboardBrushTag'),
      help: document.getElementById('vboardHelp'),
      startOverlay: document.getElementById('vboardStartOverlay'),
      overlayText: document.getElementById('vboardOverlayText'),
      startBtn: document.getElementById('vboardStartBtn'),
      controls: document.getElementById('vboardControls'),
      colors: document.getElementById('vboardColors'),
      brushVal: document.getElementById('vboardBrushVal'),
      eraserVal: document.getElementById('vboardEraserVal'),
    };

    els.startBtn.addEventListener('click', startCamera);
    document.getElementById('vboardBrushMinus').addEventListener('click', () => { state.brushSize = Math.max(2, state.brushSize - 2); els.brushVal.textContent = state.brushSize; });
    document.getElementById('vboardBrushPlus').addEventListener('click', () => { state.brushSize = Math.min(50, state.brushSize + 2); els.brushVal.textContent = state.brushSize; });
    document.getElementById('vboardEraserMinus').addEventListener('click', () => { state.eraserSize = Math.max(10, state.eraserSize - 4); els.eraserVal.textContent = state.eraserSize; });
    document.getElementById('vboardEraserPlus').addEventListener('click', () => { state.eraserSize = Math.min(120, state.eraserSize + 4); els.eraserVal.textContent = state.eraserSize; });
    document.getElementById('vboardClearBtn').addEventListener('click', clearCanvas);
    document.getElementById('vboardSaveBtn').addEventListener('click', saveCanvas);
    document.getElementById('vboardHelpBtn').addEventListener('click', () => {
      els.help.style.display = els.help.style.display === 'none' ? 'block' : 'none';
    });

    // Dừng camera + vòng lặp nhận diện khi rời trang, tránh tốn pin/CPU nền
    window.addEventListener('beforeunload', () => {
      state.running = false;
      if (video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
