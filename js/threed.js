// ============================================================================
// 3D — Gesture Galaxy + VBoard gộp trong một trải nghiệm toàn màn hình.
// Thiên Hà hạt (Three.js) điều khiển bằng cử chỉ tay + bảng vẽ bằng tay
// (MediaPipe Tasks Vision), dùng chung một pipeline nhận diện tay qua webcam.
// Logic cử chỉ vẽ/xoá khớp với vboard.js (chuyển thể từ cam_draw.py gốc).
// ============================================================================
(function () {
  'use strict';

  /* ================= Trạng thái dùng chung ================= */
  let currentMode = 'particles'; // 'particles' | 'draw'
  let cameraReady = false;
  let handLandmarker = null;
  let lastVideoTime = -1;

  let gestureScale = 1;
  let expansionFactor = 0;
  const targetRotation = { x: 0, y: 0 };
  const PARTICLE_COUNT = 30000;
  const EXPANSION_STRENGTH = 1.6;

  const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

  let video, drawCanvas, drawCtx;

  /* ================= Three.js: Thiên Hà hạt ================= */
  let scene, camera, renderer, geometry, material, particles;
  let basePositions = null; // snapshot hình dạng gốc để "nổ" luôn phục hồi được

  function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.id = 'three-canvas';
    document.body.appendChild(renderer.domElement);

    geometry = new THREE.BufferGeometry();
    material = new THREE.PointsMaterial({
      size: 0.04,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
    camera.position.z = 12;
  }

  function updateShape(type) {
    const colorInput = new THREE.Color(document.getElementById('color-picker').value);
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let x, y, z, r, g, b;
      const idx = i * 3;

      if (type === 'galaxy') {
        const isCore = i < PARTICLE_COUNT * 0.35;
        if (isCore) {
          const radius = Math.pow(Math.random(), 2) * 2.0;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          x = radius * Math.sin(phi) * Math.cos(theta);
          y = radius * Math.sin(phi) * Math.sin(theta);
          z = radius * Math.cos(phi);
          r = 1; g = 1; b = 1;
        } else {
          const radius = 5.5 + (Math.random() - 0.5) * 1.5;
          const angle = Math.random() * Math.PI * 2;
          x = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.6;
          y = (Math.random() - 0.5) * 0.4;
          z = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.6;
          r = colorInput.r; g = colorInput.g; b = colorInput.b;
        }
      } else if (type === 'saturn') {
        const isCore = i < PARTICLE_COUNT * 0.22;
        if (isCore) {
          const radius = Math.pow(Math.random(), 0.5) * 1.6;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          x = radius * Math.sin(phi) * Math.cos(theta);
          y = radius * Math.sin(phi) * Math.sin(theta);
          z = radius * Math.cos(phi);
          r = 1; g = 0.92; b = 0.78;
        } else {
          const t = Math.random();
          const innerR = 2.6, outerR = 5.4;
          const radius = innerR + t * (outerR - innerR);
          const angle = Math.random() * Math.PI * 2;
          x = Math.cos(angle) * radius;
          y = (Math.random() - 0.5) * 0.06;
          z = Math.sin(angle) * radius;
          const band = 0.6 + 0.4 * Math.sin(radius * 6.0);
          r = colorInput.r * band; g = colorInput.g * band; b = colorInput.b * band;
        }
      } else if (type === 'heart') {
        const phi = Math.random() * Math.PI * 2;
        x = 16 * Math.pow(Math.sin(phi), 3);
        y = 13 * Math.cos(phi) - 5 * Math.cos(2 * phi) - 2 * Math.cos(3 * phi) - Math.cos(4 * phi);
        z = (Math.random() - 0.5) * 5;
        const s = 0.3; x *= s; y *= s; z *= s;
        r = colorInput.r; g = colorInput.g; b = colorInput.b;
      } else { // flower
        const t = Math.random() * Math.PI * 2;
        const rad = 4 + Math.sin(t * 5) * 0.8;
        x = Math.cos(t) * rad; y = Math.sin(t) * rad; z = (Math.random() - 0.5) * 3;
        r = colorInput.r; g = colorInput.g; b = colorInput.b;
      }

      pos[idx] = x; pos[idx + 1] = y; pos[idx + 2] = z;
      col[idx] = r; col[idx + 1] = g; col[idx + 2] = b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    basePositions = pos.slice();
  }

  function updateParticleMode() {
    particles.rotation.y = THREE.MathUtils.lerp(particles.rotation.y, targetRotation.y, 0.05);
    particles.rotation.x = THREE.MathUtils.lerp(particles.rotation.x, targetRotation.x, 0.05);
    particles.rotation.y += 0.001;
    particles.scale.setScalar(gestureScale);

    if (basePositions) {
      const posArr = geometry.attributes.position.array;
      const amt = expansionFactor * EXPANSION_STRENGTH;
      const settled = Math.abs(amt) < 0.001;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const idx = i * 3;
        const bx = basePositions[idx], by = basePositions[idx + 1], bz = basePositions[idx + 2];
        if (settled) {
          posArr[idx] = bx; posArr[idx + 1] = by; posArr[idx + 2] = bz;
        } else {
          const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
          posArr[idx] = bx + (bx / len) * amt;
          posArr[idx + 1] = by + (by / len) * amt;
          posArr[idx + 2] = bz + (bz / len) * amt;
        }
      }
      geometry.attributes.position.needsUpdate = true;
    }
  }

  function applyParticleGesture(hand) {
    if (!hand) return;
    targetRotation.y = (hand[9].x - 0.5) * Math.PI * 2;
    targetRotation.x = (hand[9].y - 0.5) * Math.PI;

    const dist = Math.hypot(hand[8].x - hand[4].x, hand[8].y - hand[4].y);
    gestureScale = THREE.MathUtils.lerp(gestureScale, 0.4 + dist * 5, 0.1);
    expansionFactor = THREE.MathUtils.lerp(expansionFactor, (0.5 - hand[9].y) * 2, 0.1);
  }

  /* ================= Vẽ tay (khớp logic + hằng số với vboard.js) ================= */
  const PALETTE = [
    { name: 'Xanh lá', hex: '#37AF00' },
    { name: 'Xanh dương', hex: '#0087BE' },
    { name: 'Hồng', hex: '#BE0078' },
    { name: 'Cam', hex: '#BE5F00' },
    { name: 'Trắng', hex: '#E6E6E6' }
  ];
  const SMOOTH_FACTOR = 0.36;
  const FINGER_UP_GAP = 0.02;
  const FINGER_EXT_RATIO = 0.58;

  const drawState = {
    prevPoint: null,
    cursor: null,
    mode: 'IDLE',
    colorIdx: 0,
    brushSize: 10,
    eraserSize: 46
  };

  function landmarkDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function classifyGesture(hand) {
    const idxUp = hand[8].y < hand[6].y - FINGER_UP_GAP;
    const midUp = hand[12].y < hand[10].y - FINGER_UP_GAP;
    const palmSize = Math.max(landmarkDist(hand[0], hand[9]), landmarkDist(hand[5], hand[17]), 0.001);
    const idxExt = landmarkDist(hand[8], hand[5]) > palmSize * FINGER_EXT_RATIO;

    if (idxUp && midUp) return 'ERASING';
    if (idxUp || idxExt) return 'DRAWING';
    return 'IDLE';
  }

  function toCanvasPoint(lm) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return {
      x: (1 - lm.x) * (drawCanvas.width / dpr),
      y: lm.y * (drawCanvas.height / dpr)
    };
  }

  function applyDrawGesture(hand) {
    if (!hand) {
      drawState.prevPoint = null;
      drawState.mode = 'IDLE';
      updateDrawBadge();
      return;
    }

    drawState.mode = classifyGesture(hand);
    const target = toCanvasPoint(hand[8]);
    drawState.cursor = drawState.cursor
      ? {
          x: drawState.cursor.x + (target.x - drawState.cursor.x) * SMOOTH_FACTOR,
          y: drawState.cursor.y + (target.y - drawState.cursor.y) * SMOOTH_FACTOR
        }
      : target;

    if (drawState.mode === 'DRAWING') {
      if (drawState.prevPoint) {
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = PALETTE[drawState.colorIdx].hex;
        drawCtx.lineWidth = drawState.brushSize;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        drawCtx.beginPath();
        drawCtx.moveTo(drawState.prevPoint.x, drawState.prevPoint.y);
        drawCtx.lineTo(drawState.cursor.x, drawState.cursor.y);
        drawCtx.stroke();
      }
      drawState.prevPoint = { x: drawState.cursor.x, y: drawState.cursor.y };
    } else if (drawState.mode === 'ERASING') {
      drawCtx.globalCompositeOperation = 'destination-out';
      drawCtx.beginPath();
      drawCtx.arc(drawState.cursor.x, drawState.cursor.y, drawState.eraserSize, 0, Math.PI * 2);
      drawCtx.fill();
      drawCtx.globalCompositeOperation = 'source-over';
      drawState.prevPoint = null;
    } else {
      drawState.prevPoint = null;
    }
    updateDrawBadge();
  }

  function updateDrawBadge() {
    const badge = document.getElementById('draw-msg');
    if (!cameraReady || !badge) return;
    badge.textContent = drawState.mode === 'IDLE' ? 'Giơ ngón trỏ để vẽ' : drawState.mode;
  }

  /* ================= Vòng lặp nhận diện tay ================= */
  async function initHandTracking() {
    if (typeof vision === 'undefined') throw new Error('Không tải được thư viện MediaPipe (kiểm tra kết nối mạng).');
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
  }

  function updateHandTracking() {
    if (!handLandmarker || !cameraReady || video.readyState < 2) return;
    if (video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;

    const results = handLandmarker.detectForVideo(video, performance.now());
    const hand = (results.landmarks && results.landmarks.length > 0) ? results.landmarks[0] : null;

    if (currentMode === 'particles') applyParticleGesture(hand);
    else applyDrawGesture(hand);
  }

  /* ================= Khởi động camera ================= */
  function setStatus(text) {
    const a = document.getElementById('gesture-msg');
    const b = document.getElementById('draw-msg');
    if (a) a.textContent = text;
    if (b) b.textContent = text;
  }

  async function startCamera() {
    const startBtn = document.getElementById('start-btn');
    const startError = document.getElementById('start-error');
    startBtn.disabled = true;
    startBtn.textContent = 'Đang khởi động…';
    startError.textContent = '';

    try {
      await initHandTracking();

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      video.srcObject = stream;
      await video.play();

      cameraReady = true;
      document.getElementById('start-overlay').style.display = 'none';
      document.body.classList.remove('gating');
      setStatus('ĐANG HOẠT ĐỘNG');
      applyModeVisibility();
    } catch (err) {
      console.error(err);
      cameraReady = false;
      let msg = 'Không thể kết nối camera. Kiểm tra mạng rồi thử lại.';
      if (err && err.name === 'NotAllowedError') msg = 'Quyền truy cập camera bị từ chối. Vào cài đặt trình duyệt để cấp quyền, sau đó thử lại.';
      else if (err && err.name === 'NotFoundError') msg = 'Không tìm thấy camera trên thiết bị này.';
      startError.textContent = msg;
      startBtn.disabled = false;
      startBtn.textContent = 'Thử lại';
      setStatus('Camera không khả dụng');
    }
  }

  /* ================= Chuyển đổi mode ================= */
  function applyModeVisibility() {
    const isDraw = currentMode === 'draw';
    document.getElementById('ui-panel').style.display = isDraw ? 'none' : 'block';
    document.getElementById('draw-panel').style.display = isDraw ? 'block' : 'none';
    renderer.domElement.style.display = isDraw ? 'none' : 'block';
    drawCanvas.style.display = (isDraw && cameraReady) ? 'block' : 'none';
    video.style.display = (isDraw && cameraReady) ? 'block' : 'none';
  }

  function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active);
    });
    drawState.prevPoint = null;
    applyModeVisibility();
  }

  /* ================= Kích thước canvas vẽ ================= */
  function resizeDrawCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const newW = Math.round(cssW * dpr), newH = Math.round(cssH * dpr);
    if (drawCanvas.width === newW && drawCanvas.height === newH) return;

    let snapshot = null;
    if (drawCanvas.width > 0 && drawCanvas.height > 0) {
      snapshot = document.createElement('canvas');
      snapshot.width = drawCanvas.width;
      snapshot.height = drawCanvas.height;
      snapshot.getContext('2d').drawImage(drawCanvas, 0, 0);
    }

    drawCanvas.width = newW;
    drawCanvas.height = newH;
    drawCanvas.style.width = cssW + 'px';
    drawCanvas.style.height = cssH + 'px';
    drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (snapshot) drawCtx.drawImage(snapshot, 0, 0, snapshot.width / dpr, snapshot.height / dpr);
  }

  /* ================= Vòng lặp hoạt ảnh ================= */
  function animate() {
    requestAnimationFrame(animate);
    updateHandTracking();
    if (currentMode === 'particles') {
      updateParticleMode();
      renderer.render(scene, camera);
    }
  }

  /* ================= Gắn sự kiện UI ================= */
  function wireUI() {
    const swatchRow = document.getElementById('swatch-row');
    PALETTE.forEach((c, i) => {
      const el = document.createElement('button');
      el.className = 'swatch' + (i === 0 ? ' active' : '');
      el.style.background = c.hex;
      el.title = c.name;
      el.setAttribute('aria-label', c.name);
      el.addEventListener('click', () => {
        drawState.colorIdx = i;
        document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
        el.classList.add('active');
      });
      swatchRow.appendChild(el);
    });

    document.querySelectorAll('[data-adjust]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.adjust;
        const dir = parseInt(btn.dataset.dir, 10);
        if (key === 'brush') {
          drawState.brushSize = Math.min(50, Math.max(2, drawState.brushSize + dir * 2));
          document.getElementById('brush-val').textContent = drawState.brushSize;
        } else {
          drawState.eraserSize = Math.min(140, Math.max(15, drawState.eraserSize + dir * 5));
          document.getElementById('eraser-val').textContent = drawState.eraserSize;
        }
      });
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    });

    document.getElementById('save-btn').addEventListener('click', () => {
      const link = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `3d-gesture-${ts}.png`;
      link.href = drawCanvas.toDataURL('image/png');
      link.click();
    });

    document.getElementById('shape-select').addEventListener('change', (e) => updateShape(e.target.value));
    document.getElementById('color-picker').addEventListener('input', () => updateShape(document.getElementById('shape-select').value));
    document.getElementById('fs-btn').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    });

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    document.getElementById('start-btn').addEventListener('click', startCamera);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      resizeDrawCanvas();
    });

    // Dừng camera khi rời trang (qua menu, hoặc đóng tab) — tránh tốn pin/CPU nền
    window.addEventListener('beforeunload', () => {
      if (video && video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
    });
  }

  function init() {
    video = document.getElementById('webcam');
    drawCanvas = document.getElementById('draw-canvas');
    drawCtx = drawCanvas.getContext('2d');

    initThree();
    wireUI();
    updateShape('galaxy');
    resizeDrawCanvas();
    applyModeVisibility();
    animate();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
