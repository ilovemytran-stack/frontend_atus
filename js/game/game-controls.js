// ============================================================================
// Điều khiển: joystick TRÒN (kéo hướng nào di chuyển hướng đó, kéo lên = nhảy, chéo = nhảy chéo)
// + đánh thường/chiêu thức (phải) + Ki + 2 skill mặc định Lướt/Bay cạnh nút Đánh
// ============================================================================
GL.input = { dx: 0, dy: 0 };
GL.JUMP_IMPULSE = 210; GL.GRAVITY = 700; // vật lý nhảy đơn giản, chỉ ảnh hưởng hiển thị (xem player.z)

// Dùng chung cho CẢ tap trên canvas lẫn tap trong vùng joystick (joystick giờ phủ gần nửa trái màn
// hình nên PHẢI ưu tiên kiểm tra trúng NPC/quái/boss trước khi cho joystick "nuốt" cú chạm — nếu không
// NPC/quái nằm trong nửa trái sẽ không bao giờ bấm được nữa). Trả về true nếu đã xử lý 1 tương tác.
GL.tryInteractAt = function (clientX, clientY) {
  const wx = clientX + GL.camera.x, wy = clientY + GL.camera.y;
  if (GL.map?.role === 'hub') {
    const npcHit = GL.NPC_DEFS.find((n) => Math.hypot(n.x - wx, n.y - wy) < 30);
    if (npcHit) { GL.openNpc(npcHit); return true; }
  }
  if (GL.worldBoss && Math.hypot(GL.BOSS_SPOT.x - wx, GL.BOSS_SPOT.y - wy) < 64) { GL.selectTarget(GL.worldBoss); return true; }
  if (GL.worldGod && Math.hypot(GL.GOD_SPOT.x - wx, GL.GOD_SPOT.y - wy) < 50) { GL.selectTarget(GL.worldGod); return true; }
  const monsterHit = GL.monsters.find((m) => m.alive && Math.hypot(m.x - wx, m.y - wy) < 36);
  if (monsterHit) { GL.selectTarget(monsterHit); return true; }
  GL.clearTarget();
  return false;
};

GL.initControls = function () {
  const zone = document.getElementById('glJoyZone');
  const base = document.getElementById('glJoyBase');
  const stick = document.getElementById('glJoyStick');
  let activeId = null, baseX = 0, baseY = 0, jumpArmed = true; // jumpArmed reset khi thả tay/về giữa, tránh nhảy liên tục khi giữ lên
  const maxR = 44;
  const JUMP_THRESHOLD = -0.55; // kéo lên quá 55% bán kính -> tính là "kéo lên"

  function setStick(dx, dy) {
    const len = Math.hypot(dx, dy);
    const clampedLen = Math.min(maxR, len);
    const nx = len > 0 ? dx / len : 0, ny = len > 0 ? dy / len : 0;
    const cx = nx * clampedLen, cy = ny * clampedLen;
    stick.style.transform = `translate(${cx}px, ${cy}px)`; // di chuyển tự do cả 2 trục, đúng "joystick tròn"
    const nrm = clampedLen / maxR;
    GL.input.dx = Math.abs(cx) < 8 ? 0 : Math.max(-1, Math.min(1, cx / maxR));
    GL.input.dy = Math.abs(cy) < 8 ? 0 : Math.max(-1, Math.min(1, cy / maxR));
    // Kéo lên (dy âm vì toạ độ màn hình Y hướng xuống) đủ xa -> nhảy; kéo chéo lên-trái/lên-phải vẫn
    // nhảy bình thường vì dx tiếp tục điều khiển di chuyển ngang song song, không cần xử lý riêng.
    if (nrm > 0.3 && GL.input.dy < JUMP_THRESHOLD && jumpArmed) {
      GL.tryJump();
      jumpArmed = false;
    }
    if (nrm < 0.25) jumpArmed = true;
  }
  function reset() {
    stick.style.transform = ''; GL.input.dx = 0; GL.input.dy = 0; activeId = null; jumpArmed = true;
    base.classList.remove('active');
  }
  function handleMove(e) { setStick(e.clientX - baseX, e.clientY - baseY); }

  zone.addEventListener('pointerdown', (e) => {
    // Joystick giờ phủ gần nửa trái màn hình — LUÔN kiểm tra có đang chạm trúng NPC/quái/boss/thần
    // trước, có thì xử lý tương tác đó và KHÔNG mở joystick (xem GL.tryInteractAt phía trên).
    if (GL.tryInteractAt(e.clientX, e.clientY)) return;
    activeId = e.pointerId; baseX = e.clientX; baseY = e.clientY;
    base.style.left = baseX + 'px'; base.style.top = baseY + 'px'; base.classList.add('active');
    zone.setPointerCapture(activeId);
    setStick(0, 0);
    GL.autoAttackTarget = null; // cầm joystick sẽ huỷ chế độ tự động lao tới đánh
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === activeId) handleMove(e); });
  zone.addEventListener('pointerup', (e) => { if (e.pointerId === activeId) reset(); });
  zone.addEventListener('pointercancel', (e) => { if (e.pointerId === activeId) reset(); });

  document.getElementById('glAttackBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); GL.tryAttack(); });
  document.getElementById('glSkill1').addEventListener('pointerdown', (e) => { e.preventDefault(); GL.trySkill(1); });
  document.getElementById('glSkill2').addEventListener('pointerdown', (e) => { e.preventDefault(); GL.trySkill(2); });
  document.getElementById('glSkillDash')?.addEventListener('pointerdown', (e) => { e.preventDefault(); GL.tryDash(); });
  document.getElementById('glSkillFly')?.addEventListener('pointerdown', (e) => { e.preventDefault(); GL.toggleFly(); });
};

// ---------- Nhảy / Bay / Lướt (2 skill mặc định + joystick tròn kéo lên) ----------
GL.tryJump = function () {
  const p = GL.player;
  if (p.flying || p.jumping) return;
  p.jumping = true; p.vz = GL.JUMP_IMPULSE;
};

GL.tryDash = function () {
  const dash = GL.data.universalSkills?.dash;
  if (!dash) return;
  const p = GL.player;
  if (p.dashCd > 0) { GL.toast('Lướt đang hồi chiêu'); return; }
  const stats = GL.currentStats();
  if ((p.ki ?? stats.ki) < dash.kiCost) { GL.toast('Không đủ Năng Lượng (Ki)!'); return; }
  p.ki = Math.max(0, (p.ki ?? stats.ki) - dash.kiCost);
  const dir = Math.abs(GL.input.dx) > 0.1 ? (GL.input.dx >= 0 ? 1 : -1) : p.dir;
  p.dashDir = dir; p.dir = dir; p.dashUntil = performance.now() + dash.durationMs; p.dashCd = dash.cd;
  GL.flashUniversalCooldown('glCdDash', dash.cd);
  GL.updateVitalsUI();
};

GL.toggleFly = function () {
  const fly = GL.data.universalSkills?.fly;
  if (!fly) return;
  const p = GL.player;
  if (p.flying) { p.flying = false; return; } // bấm lại để hạ cánh ngay, không tốn thêm Ki
  if (p.flyCd > 0) { GL.toast('Bay đang hồi chiêu'); return; }
  const stats = GL.currentStats();
  if ((p.ki ?? stats.ki) < fly.kiCostActivate) { GL.toast('Không đủ Năng Lượng (Ki)!'); return; }
  p.ki = Math.max(0, (p.ki ?? stats.ki) - fly.kiCostActivate);
  p.flying = true; p.jumping = false; p.vz = 0; p.flyCd = fly.cd;
  GL.flashUniversalCooldown('glCdFly', fly.cd);
  GL.updateVitalsUI();
};

// vật lý nhảy/bay mỗi frame — CHỈ đổi player.z (hiển thị), không đụng player.y (toạ độ logic/va chạm)
GL.updateJumpFly = function (dt) {
  const p = GL.player, fly = GL.data.universalSkills?.fly;
  p.dashCd = Math.max(0, (p.dashCd || 0) - dt);
  p.flyCd = Math.max(0, (p.flyCd || 0) - dt);
  if (p.flying) {
    const stats = GL.currentStats();
    p.ki = Math.max(0, (p.ki ?? stats.ki) - (fly?.kiDrainPerSec || 6) * dt);
    if (p.ki <= 0) { p.flying = false; GL.toast('Hết Năng Lượng, đã hạ cánh', '', 'wind'); }
    const targetZ = fly?.height || 56;
    p.z += (targetZ - p.z) * Math.min(1, dt * 6);
    p.vz = 0;
  } else if (p.jumping || p.z > 0) {
    p.vz -= GL.GRAVITY * dt;
    p.z += p.vz * dt;
    if (p.z <= 0) { p.z = 0; p.vz = 0; p.jumping = false; }
  }
};

// Bộ Trang Bị Siêu Cấp: vừa mặc đủ 4 món -> phát animation biến hình 31 frame (equip_motion) đè lên
// nhân vật ~2.6s rồi tự trở lại animation bình thường — đóng luôn bảng đồ để thấy rõ hiệu ứng.
GL.playSuperSetTransform = function () {
  GL.player.transformFx = { startedAt: performance.now(), totalFrames: 31, fps: 12 };
  GL.toast('BỘ TRANG BỊ SIÊU CẤP ĐÃ THỨC TỈNH!', 'gl-toast-levelup', 'sparkles');
  setTimeout(() => { document.getElementById('glPanelInventory').style.display = 'none'; }, 550);
};

GL.flashUniversalCooldown = function (elId, cd) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.display = 'flex';
  const start = performance.now();
  function tick() {
    const p = (performance.now() - start) / 1000 / cd;
    if (p >= 1) { el.style.display = 'none'; return; }
    el.textContent = Math.ceil(cd * (1 - p));
    requestAnimationFrame(tick);
  }
  tick();
};

// Hào Quang (Aura): mỗi 6s tự phát 1 tiếng vang nếu char.hasAura, cộng buff cho bản thân + phát cho
// người khác gần đó qua socket để HỌ tự cộng buff cho chính họ (xem gameSocket.js: game_aura_pulse).
GL.updateAuraPulse = function (dt) {
  GL.nearbyAuraPulses = (GL.nearbyAuraPulses || []).filter((p) => performance.now() < p.until);
  if (!GL.char?.stats?.hasAura) return;
  const aura = GL.data.aura;
  GL.auraPulseTimer = (GL.auraPulseTimer || 0) - dt;
  if (GL.auraPulseTimer > 0) return;
  GL.auraPulseTimer = aura.pulse.intervalSec;
  GL.auraDmgBuffUntil = performance.now() + aura.pulse.buffDurationSec * 1000;
  GL.appendChat(GL.char.name, aura.pulse.chatText);
  GL.socketEmit('game_aura_pulse', { mapId: GL.map?.id });
};

// ---------- Chiến đấu ----------
GL.currentStats = function () {
  const cls = GL.classById(GL.char.classId);
  return GL.char.stats || { hp: cls.base.hp, ki: cls.base.ki, atk: cls.base.atk, def: cls.base.def, crit: cls.base.crit };
};

// Chiêu đang gắn ở ổ 1/2 (mặc định 2 chiêu gốc class, có thể đổi qua Menu > Gắn Chiêu)
GL.getEquippedSkill = function (slot) {
  const equipped = GL.char.effectiveEquippedSkills || [];
  const skillId = equipped[slot - 1];
  return (GL.char.allSkills || []).find((s) => s.id === skillId) || null;
};

GL.nearestMonster = function (range) {
  let best = null, bestD = range;
  GL.monsters.forEach((m) => {
    if (!m.alive) return;
    const d = GL.dist(m, GL.player);
    if (d < bestD) { best = m; bestD = d; }
  });
  return best;
};

GL.damagePlayer = function (dmg) {
  const cur = GL.player.hp ?? GL.currentStats().hp;
  let next = Math.max(0, cur - dmg);
  if (next <= 0 && performance.now() < (GL.player.guardianAngelUntil || 0)) {
    next = 1; GL.player.guardianAngelUntil = 0; // Nhẫn Bất Tử: chỉ cứu 1 lần rồi tắt hiệu lực ngay
    GL.toast('Nhẫn Bất Tử đã cứu bạn khỏi đòn chí mạng!', 'gl-toast-levelup', 'heart');
  }
  GL.player.hp = next;
  GL.updateVitalsUI();
  if (GL.player.hp <= 0) GL.onPlayerDown();
};

GL.onPlayerDown = function () {
  GL.autoAttackTarget = null;
  GL.player.moving = false;
  openPanel('glPanelRevive');
};

// Về nhà: miễn phí, dịch chuyển về map khởi đầu (Aurelion, hub) dù đang ở lục địa nào —
// không cần Truyền Tống Phù vì đây là hình phạt chết, không phải di chuyển thường.
document.getElementById('glReviveHome').addEventListener('click', async () => {
  const res = await API.post('/game/character/revive', { mode: 'home' });
  if (!res?.success) { GL.toast(res?.message || 'Không thể hồi sinh'); return; }
  GL.char = res.character;
  GL.player.hp = GL.currentStats().hp;
  GL.player.x = 400; GL.player.y = 300;
  GL.updateVitalsUI(); GL.updateCurrencyUI();
  closePanel('glPanelRevive');
  const map = GL.mapById(res.map.id);
  GL.joinMap(map);
  GL.toast('Đã về nhà và hồi sinh!', '', 'home');
});

// Hồi sinh tại chỗ: tốn 30 ngọc, giữ nguyên map/vị trí hiện tại.
document.getElementById('glReviveHere').addEventListener('click', async () => {
  const res = await API.post('/game/character/revive', { mode: 'gem' });
  if (!res?.success) { GL.toast(res?.message || 'Không đủ ngọc để hồi sinh tại chỗ'); return; }
  GL.char = res.character;
  GL.player.hp = GL.currentStats().hp;
  GL.updateVitalsUI(); GL.updateCurrencyUI();
  closePanel('glPanelRevive');
  GL.toast('Đã hồi sinh tại chỗ!', '', 'bolt');
});

GL.applyMonsterHit = function (m, dmgInfo) {
  m.hp = Math.max(0, m.hp - dmgInfo.dmg);
  GL.spawnDamageNumber(m.x, m.y - 20, dmgInfo.dmg, dmgInfo.crit ? 'gl-crit' : '');
  if (GL.selectedTarget === m) GL.updateTargetFrame();
  if (m.hp <= 0 && m.alive) { GL.onMonsterKilled(m); if (GL.autoAttackTarget === m) GL.autoAttackTarget = null; if (GL.selectedTarget === m) GL.selectedTarget = null; }
};

GL.onMonsterKilled = async function (m) {
  // Hiệu ứng chết (chơi clip "death" ~1s) tách RIÊNG khỏi GL.monsters — không đụng gì tới logic
  // target/respawn hiện có (m.alive vẫn tắt ngay như cũ), chỉ thêm 1 "bóng ma" tạm để vẽ animation chết.
  GL.deathFx.push({ category: m.isBoss ? 'bosses' : 'monsters', defId: m.defId, x: m.x, y: m.y, dir: m.dir, isBoss: m.isBoss, until: performance.now() + 1400 });
  m.alive = false;
  m.respawnAt = performance.now() + (m.isBoss ? 45000 : 12000);
  try {
    const res = await API.post('/game/character/kill-monster', { mapId: GL.map.id, isBoss: !!m.isBoss });
    if (res?.success) {
      GL.char = res.character;
      GL.toast(`+${res.loot.xp} EXP  +${res.loot.gold} Vàng${res.loot.gem ? '  +' + res.loot.gem + ' Ngọc' : ''}`, '', 'coin');
      if (res.loot.isBoss) GL.toast(`Đã hạ ${res.loot.monster}!`, 'gl-toast-levelup', 'crown');
      if (res.leveledUp?.length) {
        GL.toast(`LÊN CẤP ${res.character.level}!`, 'gl-toast-levelup');
        if (res.character.level % GL.data.pointsEvery === 0) GL.toast('Nhận điểm thuộc tính & kỹ năng mới!');
        if (res.character.godDuels?.some((d) => d.status === 'pending')) GL.toast('Có thách đấu Thần Linh mới trong Thông Báo!', '', 'sword');
      }
      GL.updateVitalsUI(); GL.updateCurrencyUI();
    }
  } catch (err) { console.error(err); }
};

// Hào Quang: hệ số nhân sát thương tạm thời (+8%/8s) từ "tiếng vang" Tôn Sùng — dùng chung cho cả
// đòn đánh của người chơi lẫn của pet (mục pulse: "bản thân/người chơi & pet gần đó" đều được cộng).
GL.auraDmgMult = function () { return performance.now() < (GL.auraDmgBuffUntil || 0) ? 1 + GL.data.aura.pulse.dmgPct : 1; };

// Hào Quang: hút máu/hút năng lượng CHỈ áp dụng cho người ĐANG SỞ HỮU Aura, trên đòn đánh CỦA CHÍNH HỌ
// (không áp dụng cho pet) — gọi ngay sau khi gây sát thương thành công.
GL.applyAuraOnHit = function (dmg) {
  const stats = GL.char?.stats;
  if (!stats?.hasAura) return;
  const healAmt = Math.round(dmg * (stats.auraLifestealPct || 0));
  const kiAmt = Math.round(dmg * (stats.auraEnergyStealPct || 0));
  if (healAmt > 0) { GL.player.hp = Math.min(stats.hp, (GL.player.hp ?? stats.hp) + healAmt); GL.spawnDamageNumber(GL.player.x - 16, GL.player.y - 20, '+' + healAmt, 'gl-heal'); }
  if (kiAmt > 0) GL.player.ki = Math.min(stats.ki, (GL.player.ki ?? stats.ki) + kiAmt);
};

GL.buffAtkMult = function () { return performance.now() < (GL.player.buffAtkUntil || 0) ? 1 + (GL.player.buffAtkPct || 0) : 1; };

GL.tryAttack = function () {
  if (GL.player.attackCooldown > 0) return;
  GL.player.attackCooldown = 0.5;
  GL.player.attackFx = 0.18;
  GL.player.actionClip = 'combat1'; GL.player.actionUntil = performance.now() + 450; // gợi ý clip animation cho đòn đánh thường
  const stats = GL.currentStats();
  const atkWithBuffs = stats.atk * GL.auraDmgMult() * GL.buffAtkMult() * (1 + (stats.allDmgPct || 0));
  const bossTarget = GL.nearestBossTarget(90);
  if (bossTarget) {
    const dmgInfo = GL.rollDamage(atkWithBuffs, 0, stats.crit);
    GL.socketEmit('world_boss_attack', { mapId: GL.map.id, zone: GL.player.zone, dmg: dmgInfo.dmg });
    GL.spawnDamageNumber(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y - 40, dmgInfo.dmg, dmgInfo.crit ? 'gl-crit' : '');
    GL.applyAuraOnHit(dmgInfo.dmg);
    return;
  }
  const target = GL.nearestMonster(80);
  if (target) {
    const dmgInfo = GL.rollDamage(atkWithBuffs, target.armor, stats.crit);
    GL.applyMonsterHit(target, dmgInfo);
    GL.applyAuraOnHit(dmgInfo.dmg);
  }
  GL.socketEmit('game_attack', { mapId: GL.map.id, targetType: 'monster', targetId: target?.uid, skillId: 'combo' });
};

GL.trySkill = function (slot) {
  const idx = slot - 1;
  if (GL.player.skillCd[idx] > 0) return;
  const skill = GL.getEquippedSkill(slot);
  if (!skill) return;
  const stats = GL.currentStats();
  if ((GL.player.ki ?? stats.ki) < skill.kiCost) { GL.toast('Không đủ Năng Lượng (Ki)!'); return; }

  GL.player.ki = Math.max(0, (GL.player.ki ?? stats.ki) - skill.kiCost);
  GL.player.skillCd[idx] = skill.cd;
  GL.player.attackFx = 0.22;
  GL.player.actionClip = slot === 1 ? 'combat2' : 'combat3'; GL.player.actionUntil = performance.now() + 550; // chiêu 1/2 dùng clip animation khác đòn thường cho đỡ đơn điệu
  const lvBonus = 1 + (GL.char.skillLevels?.[skill.id] || 0) * 0.08;

  if (skill.summon) {
    GL.spawnSummon(skill.summon, skill.id, skill.duration);
    GL.toast(`Đã triệu hồi ${GL.data.minions[skill.summon].nameVN}!`);
  } else if (skill.heal) {
    const healAmt = Math.round(stats.hp * skill.heal * lvBonus);
    GL.player.hp = Math.min(stats.hp, (GL.player.hp ?? stats.hp) + healAmt);
    GL.spawnDamageNumber(GL.player.x, GL.player.y - 20, '+' + healAmt, 'gl-heal');
  } else {
    const isAoe = slot === 2 || skill.isBlessing;
    const bossTarget = !isAoe ? GL.nearestBossTarget(110) : null;
    const atkMult = skill.mult * lvBonus * GL.auraDmgMult() * GL.buffAtkMult() * (1 + (stats.allDmgPct || 0));
    if (bossTarget) {
      const dmgInfo = GL.rollDamage(stats.atk * atkMult, 0, stats.crit + 10);
      GL.socketEmit('world_boss_attack', { mapId: GL.map.id, zone: GL.player.zone, dmg: dmgInfo.dmg });
      GL.spawnDamageNumber(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y - 40, dmgInfo.dmg, dmgInfo.crit ? 'gl-crit' : '');
      GL.applyAuraOnHit(dmgInfo.dmg);
    } else {
      const targets = isAoe ? GL.monsters.filter((m) => m.alive && GL.dist(m, GL.player) < 110) : [GL.nearestMonster(110)].filter(Boolean);
      targets.forEach((m) => {
        const dmgInfo = GL.rollDamage(stats.atk * atkMult, m.armor, stats.crit + 10);
        GL.applyMonsterHit(m, dmgInfo);
        GL.applyAuraOnHit(dmgInfo.dmg);
      });
    }
  }
  GL.updateVitalsUI();
  GL.socketEmit('game_attack', { mapId: GL.map.id, targetType: 'monster', targetId: null, skillId: skill.id });
  GL.flashCooldown(slot, skill.cd);
};

GL.flashCooldown = function (slot, cd) {
  const el = document.getElementById('glCd' + slot);
  if (!el) return;
  el.style.display = 'flex';
  const start = performance.now();
  function tick() {
    const p = (performance.now() - start) / 1000 / cd;
    if (p >= 1) { el.style.display = 'none'; return; }
    el.textContent = Math.ceil(cd * (1 - p));
    requestAnimationFrame(tick);
  }
  tick();
};

// ---------- Chọn mục tiêu + tự động lao tới đánh (nhấn 2 lần) ----------
GL.selectedTarget = null;   // mục tiêu đang xem thông tin (tên + máu)
GL.autoAttackTarget = null; // mục tiêu đang tự động lao tới đánh liên tục

GL.selectTarget = function (entity) {
  if (GL.selectedTarget === entity) {
    GL.autoAttackTarget = entity; // bấm lần 2 vào cùng mục tiêu -> tự lao tới đánh
    GL.toast('Đang lao tới tấn công…');
  } else {
    GL.selectedTarget = entity;
    GL.autoAttackTarget = null;
  }
  GL.updateTargetFrame();
};

GL.clearTarget = function () {
  GL.selectedTarget = null; GL.autoAttackTarget = null;
  GL.updateTargetFrame();
};

// gọi mỗi frame: nếu đang tự lao tới đánh, di chuyển tới mục tiêu rồi tự bấm đánh thường khi vào tầm
GL.updateAutoAttackTick = function (dt) {
  const t = GL.autoAttackTarget;
  if (!t || !t.alive) { GL.autoAttackTarget = null; return; }
  const d = GL.distX(t, GL.player);
  if (d > 50) {
    const dirX = t.x >= GL.player.x ? 1 : -1;
    const stats = GL.currentStats();
    const speed = 95 + stats.spd * 14;
    GL.player.x = clamp(GL.player.x + dirX * speed * dt, GL.WORLD.pad, GL.WORLD.w - GL.WORLD.pad);
    GL.player.dir = dirX; GL.player.moving = true;
  } else {
    GL.player.moving = false;
    GL.tryAttack();
  }
};
