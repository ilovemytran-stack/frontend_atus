// ============================================================================
// Khởi động G.Legendary
// ============================================================================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function setLoadingProgress(pct, hint) {
  document.getElementById('glLoadingFill').style.width = pct + '%';
  if (hint) document.getElementById('glLoadingHint').textContent = hint;
}

function checkOrientation() {
  const isPortrait = window.innerHeight > window.innerWidth;
  document.getElementById('glRotatePrompt').style.display = isPortrait ? 'flex' : 'none';
}
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);

async function tryLockLandscape() {
  try {
    if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(() => {});
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch (e) { /* Nhiều trình duyệt di động (đặc biệt Safari iOS ngoài PWA) không hỗ trợ khóa xoay — dùng gợi ý xoay tay làm phương án chính. */ }
}

// ---------- Chọn nhân vật ----------
function showCharSelect() {
  document.getElementById('glCharSelect').style.display = 'flex';
  const list = document.getElementById('glClassList');
  Object.values(GL.data.classes).forEach((cls) => {
    const card = document.createElement('div');
    card.className = 'gl-classcard';
    card.style.setProperty('--card-color', cls.color);
    card.innerHTML = `<img src="${cls.portrait}" alt=""><div class="gl-classcard-name">${cls.name}</div><div class="gl-classcard-title">${cls.title}</div>`;
    card.addEventListener('click', () => selectClass(cls, card));
    list.appendChild(card);
  });
  const nameInput = document.getElementById('glNameInput');
  nameInput.value = GL.me.displayName || GL.me.username || '';
  nameInput.addEventListener('input', validateCreateBtn);
  document.getElementById('glCreateBtn').addEventListener('click', onCreateChar);
  if (list.firstChild) list.firstChild.click();
}

function selectClass(cls, card) {
  GL.selectedClass = cls;
  document.querySelectorAll('.gl-classcard').forEach((c) => c.classList.remove('selected'));
  card.classList.add('selected');
  const skills = cls.skills.filter((s) => s.type === 'active').map((s) => s.name).join(' · ');
  document.getElementById('glClassDetail').innerHTML =
    `<b>${cls.name} — ${cls.title}</b><br>HP ${cls.base.hp} · ATK ${cls.base.atk} · DEF ${cls.base.def}<br>Chiêu thức: ${skills}`;
  validateCreateBtn();
}

function validateCreateBtn() {
  const name = document.getElementById('glNameInput').value.trim();
  document.getElementById('glCreateBtn').disabled = !(GL.selectedClass && name.length >= 2);
}

async function onCreateChar() {
  const btn = document.getElementById('glCreateBtn'); btn.disabled = true; btn.textContent = 'ĐANG TẠO…';
  const name = document.getElementById('glNameInput').value.trim();
  try {
    const res = await API.post('/game/character', { classId: GL.selectedClass.id, name });
    if (!res?.success) { Toast.error(res?.message || 'Không thể tạo nhân vật'); btn.disabled = false; btn.textContent = 'CHỌN NHÂN VẬT NÀY'; return; }
    GL.char = res.character;
    document.getElementById('glCharSelect').style.display = 'none';
    tryLockLandscape();
    enterGame();
  } catch (err) { console.error(err); Toast.error('Lỗi kết nối máy chủ'); btn.disabled = false; btn.textContent = 'CHỌN NHÂN VẬT NÀY'; }
}

// ---------- Vào game ----------
function enterGame() {
  document.getElementById('glGame').style.display = 'block';
  GL.initCanvas();
  GL.initControls();
  GL.initSocket();
  GL.updateVitalsUI();
  GL.updateCurrencyUI();
  GL.updateSkillButtonsUI();

  GL.player.x = GL.char.position?.x || 400;
  GL.player.y = GL.char.position?.y || 300;
  const startMap = GL.mapById(GL.char.position?.mapId) || GL.mapById('aurelion_1');
  GL.joinMap(startMap);

  document.getElementById('glCanvas').addEventListener('pointerup', (e) => {
    const wx = e.clientX + GL.camera.x, wy = e.clientY + GL.camera.y;
    if (GL.map?.role === 'hub') {
      const npcHit = GL.NPC_DEFS.find((n) => Math.hypot(n.x - wx, n.y - wy) < 26);
      if (npcHit) { GL.openNpc(npcHit); return; }
    }
    if (GL.worldBoss && Math.hypot(GL.BOSS_SPOT.x - wx, GL.BOSS_SPOT.y - wy) < 60) { GL.selectTarget(GL.worldBoss); return; }
    const monsterHit = GL.monsters.find((m) => m.alive && Math.hypot(m.x - wx, m.y - wy) < 34);
    if (monsterHit) { GL.selectTarget(monsterHit); return; }
    GL.clearTarget();
  });

  requestAnimationFrame(loop);
}

let lastT = 0;
function loop(ts) {
  const now = ts / 1000;
  const dt = Math.min(0.05, lastT ? now - lastT : 0.016);
  lastT = now;

  updatePlayerMovement(dt);
  if (GL.autoAttackTarget) GL.updateAutoAttackTick(dt);
  GL.updateMonsters(dt, performance.now());
  GL.updateSummons(dt, performance.now());
  updateCamera();
  GL.maybeSendPosition(performance.now());
  GL.renderFrame(now);

  requestAnimationFrame(loop);
}

function updatePlayerMovement(dt) {
  const { dx, dy } = GL.input;
  const stats = GL.currentStats();
  const speed = 95 + stats.spd * 14;
  const moving = Math.hypot(dx, dy) > 0.05;
  if (!GL.autoAttackTarget) {
    GL.player.moving = moving;
    if (moving) {
      GL.player.dir = dx >= 0 ? 1 : -1;
      GL.player.x = clamp(GL.player.x + dx * speed * dt, 30, GL.WORLD.w - 30);
      GL.player.y = clamp(GL.player.y + dy * speed * dt, 30, GL.WORLD.h - 30);
    }
  }
  GL.player.attackCooldown = Math.max(0, (GL.player.attackCooldown || 0) - dt);
  if (GL.player.attackFx > 0) GL.player.attackFx -= dt;
  GL.player.skillCd[0] = Math.max(0, GL.player.skillCd[0] - dt);
  GL.player.skillCd[1] = Math.max(0, GL.player.skillCd[1] - dt);

  // hồi Ki theo thời gian (2.5/giây), chỉ cập nhật UI khi có thay đổi đáng kể để đỡ tốn
  if (GL.player.ki != null && GL.player.ki < stats.ki) {
    GL.player.ki = Math.min(stats.ki, GL.player.ki + 2.5 * dt);
    kiUiAccum += dt;
    if (kiUiAccum > 0.2) { kiUiAccum = 0; GL.updateVitalsUI(); }
  }
}
let kiUiAccum = 0;

function updateCamera() {
  const vw = window.innerWidth, vh = window.innerHeight;
  GL.camera.x = clamp(GL.player.x - vw / 2, 0, Math.max(0, GL.WORLD.w - vw));
  GL.camera.y = clamp(GL.player.y - vh / 2, 0, Math.max(0, GL.WORLD.h - vh));
}

// ---------- Boot ----------
(async function boot() {
  if (!API.requireAuth()) return;
  GL.me = API.getCurrentUser();
  checkOrientation();
  try {
    setLoadingProgress(20, 'Đang mở cổng dịch chuyển…');
    await GL.fetchGameData();
    setLoadingProgress(65, 'Đang tìm nhân vật của bạn…');
    await GL.fetchCharacter();
    setLoadingProgress(100, 'Sẵn sàng!');
  } catch (err) {
    console.error(err);
    setLoadingProgress(100, 'Không kết nối được máy chủ game. Vui lòng thử lại.');
    return;
  }
  setTimeout(() => {
    document.getElementById('glLoading').style.display = 'none';
    if (!GL.char) showCharSelect(); else enterGame();
  }, 250);
})();
