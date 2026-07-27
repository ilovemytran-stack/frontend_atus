// ============================================================================
// Hiệu ứng nền 3D (Three.js) cho màn hình CHỌN NHÂN VẬT — "Pha Lê Thần Thánh"
// xoay chậm + trường hạt lấp lánh xung quanh. File này KHÔNG đụng tới logic
// game (canvas #glCanvas, game-render.js...) — chỉ trang trí phần "web" bên
// ngoài, tự bật/tắt theo việc #glCharSelect có đang hiển thị hay không.
// ============================================================================
(function () {
  if (typeof THREE === 'undefined') return; // CDN lỗi/mạng chặn thì lặng lẽ bỏ qua, không phá giao diện

  const canvas = document.getElementById('glThreeCanvas');
  const host = document.getElementById('glCharSelect');
  if (!canvas || !host) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 7.5);

  const group = new THREE.Group();
  scene.add(group);

  // Lõi pha lê: 2 lớp icosahedron lồng nhau (khối đặc mờ + khung dây), tông vàng thần thánh
  const coreGeo = new THREE.IcosahedronGeometry(1.55, 1);
  const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xf5d061, transparent: true, opacity: 0.16 }));
  group.add(core);
  const wire = new THREE.Mesh(coreGeo.clone().scale(1.22, 1.22, 1.22), new THREE.MeshBasicMaterial({ color: 0xffe9a8, wireframe: true, transparent: true, opacity: 0.55 }));
  group.add(wire);
  const innerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
  group.add(innerGlow);

  // Trường hạt (sao/bụi thần) rải quanh khối pha lê
  const STAR_COUNT = 220;
  const starGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 3.2 + Math.random() * 4.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffe9a8, size: 0.045, transparent: true, opacity: 0.75, sizeAttenuation: true }));
  scene.add(stars);

  function resize() {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let running = false, rafId = null, t = 0;
  function tick() {
    if (!running) return;
    t += 0.008;
    group.rotation.y = t * 0.6;
    group.rotation.x = Math.sin(t * 0.4) * 0.25;
    wire.rotation.y -= 0.003;
    stars.rotation.y = t * 0.05;
    camera.position.x = Math.sin(t * 0.15) * 0.6;
    camera.position.y = Math.cos(t * 0.12) * 0.35;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  function start() { if (running) return; running = true; resize(); tick(); }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  // Tự bật/tắt theo trạng thái hiển thị của màn chọn nhân vật — không cần sửa game-main.js
  const obs = new MutationObserver(() => {
    (host.style.display !== 'none') ? start() : stop();
  });
  obs.observe(host, { attributes: true, attributeFilter: ['style'] });
  if (host.style.display !== 'none') start();
})();
