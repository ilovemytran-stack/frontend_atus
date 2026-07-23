// ============================================================================
// Hiệu ứng nền 3D dùng chung (Three.js) — "Quầng Sáng" tím thương hiệu, dùng cho
// popup Thông Báo và khung soạn thông báo admin. Nhẹ, tự dọn khi canvas bị gỡ khỏi DOM.
// ============================================================================
window.initThreeOrb = function (canvas, opts) {
  if (!canvas || typeof THREE === 'undefined') return null;
  const options = Object.assign({ color: 0x7c5cfc, accent: 0xff5ca8, particles: 90 }, opts || {});

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(0, 0, 6);

  const group = new THREE.Group();
  scene.add(group);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), new THREE.MeshBasicMaterial({ color: options.color, transparent: true, opacity: 0.22 }));
  group.add(core);
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), new THREE.MeshBasicMaterial({ color: options.accent, wireframe: true, transparent: true, opacity: 0.45 }));
  group.add(wire);

  const N = options.particles;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 2.4 + Math.random() * 2.6, th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pos[i * 3 + 2] = r * Math.cos(ph);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: options.color, size: 0.05, transparent: true, opacity: 0.8 }));
  scene.add(stars);

  function resize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 200;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let t = 0, raf = null;
  function tick() {
    if (!canvas.isConnected) { ro.disconnect(); if (raf) cancelAnimationFrame(raf); renderer.dispose(); return; }
    t += 0.01;
    group.rotation.y = t * 0.7;
    group.rotation.x = Math.sin(t * 0.5) * 0.3;
    wire.rotation.y -= 0.004;
    stars.rotation.y = t * 0.08;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();
  return { stop: () => { if (raf) cancelAnimationFrame(raf); ro.disconnect(); } };
};
