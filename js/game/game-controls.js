// ============================================================================
// Điều khiển: joystick di chuyển (trái) + đánh thường/chiêu thức (phải) + Ki
// ============================================================================
GL.input = { dx: 0, dy: 0 };

GL.initControls = function () {
  const zone = document.getElementById('glJoyZone');
  const base = document.getElementById('glJoyBase');
  const stick = document.getElementById('glJoyStick');
  let activeId = null, baseRect = null;
  const maxR = 40;

  function setStick(dx, dy) {
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, maxR);
    const ang = Math.atan2(dy, dx);
    stick.style.transform = `translate(${Math.cos(ang) * clamped}px,${Math.sin(ang) * clamped}px)`;
    if (len < 8) { GL.input.dx = 0; GL.input.dy = 0; }
    else { GL.input.dx = Math.cos(ang); GL.input.dy = Math.sin(ang); }
  }
  function reset() { stick.style.transform = ''; GL.input.dx = 0; GL.input.dy = 0; activeId = null; }
  function handleMove(e) {
    const cx = baseRect.left + baseRect.width / 2, cy = baseRect.top + baseRect.height / 2;
    setStick(e.clientX - cx, e.clientY - cy);
  }
  zone.addEventListener('pointerdown', (e) => {
    activeId = e.pointerId; baseRect = base.getBoundingClientRect(); zone.setPointerCapture(activeId); handleMove(e);
    GL.autoAttackTarget = null; // cầm joystick sẽ huỷ chế độ tự động lao tới đánh
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === activeId) handleMove(e); });
  zone.addEventListener('pointerup', (e) => { if (e.pointerId === activeId) reset(); });
  zone.addEventListener('pointercancel', (e) => { if (e.pointerId === activeId) reset(); });

  document.getElementById('glAttackBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); GL.tryAttack(); });
  document.getElementById('glSkill1').addEventListener('pointerdown', (e) => { e.preventDefault(); GL.trySkill(1); });
  document.getElementById('glSkill2').addEventListener('pointerdown', (e) => { e.preventDefault(); GL.trySkill(2); });
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
  GL.player.hp = Math.max(0, (GL.player.hp ?? GL.currentStats().hp) - dmg);
  GL.updateVitalsUI();
  if (GL.player.hp <= 0) GL.onPlayerDown();
};

GL.onPlayerDown = function () {
  GL.toast('Bạn đã gục! Đang hồi sinh…');
  GL.autoAttackTarget = null;
  setTimeout(() => {
    GL.player.hp = GL.currentStats().hp;
    GL.player.x = 400; GL.player.y = 300;
    GL.updateVitalsUI();
  }, 900);
};

GL.applyMonsterHit = function (m, dmgInfo) {
  m.hp = Math.max(0, m.hp - dmgInfo.dmg);
  GL.spawnDamageNumber(m.x, m.y - 20, (dmgInfo.crit ? '💥' : '') + dmgInfo.dmg, dmgInfo.crit ? 'gl-crit' : '');
  if (GL.selectedTarget === m) GL.updateTargetFrame();
  if (m.hp <= 0 && m.alive) { GL.onMonsterKilled(m); if (GL.autoAttackTarget === m) GL.autoAttackTarget = null; if (GL.selectedTarget === m) GL.selectedTarget = null; }
};

GL.onMonsterKilled = async function (m) {
  m.alive = false;
  m.respawnAt = performance.now() + (m.isBoss ? 45000 : 12000);
  try {
    const res = await API.post('/game/character/kill-monster', { mapId: GL.map.id });
    if (res?.success) {
      GL.char = res.character;
      GL.toast(`+${res.loot.xp} EXP  +${res.loot.gold} 🪙${res.loot.gem ? '  +' + res.loot.gem + ' 💎' : ''}`);
      if (res.leveledUp?.length) {
        GL.toast(`LÊN CẤP ${res.character.level}!`, 'gl-toast-levelup');
        if (res.character.level % GL.data.pointsEvery === 0) GL.toast('Nhận điểm thuộc tính & kỹ năng mới!');
        if (res.character.godDuels?.some((d) => d.status === 'pending')) GL.toast('⚔️ Có thách đấu Thần Linh mới trong Thông Báo!');
      }
      GL.updateVitalsUI(); GL.updateCurrencyUI();
    }
  } catch (err) { console.error(err); }
};

GL.tryAttack = function () {
  if (GL.player.attackCooldown > 0) return;
  GL.player.attackCooldown = 0.5;
  GL.player.attackFx = 0.18;
  const stats = GL.currentStats();
  const bossTarget = GL.nearestBossTarget(90);
  if (bossTarget) {
    const dmgInfo = GL.rollDamage(stats.atk, 0, stats.crit);
    GL.socketEmit('world_boss_attack', { mapId: GL.map.id, zone: GL.player.zone, dmg: dmgInfo.dmg });
    GL.spawnDamageNumber(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y - 40, (dmgInfo.crit ? '💥' : '') + dmgInfo.dmg, dmgInfo.crit ? 'gl-crit' : '');
    return;
  }
  const target = GL.nearestMonster(80);
  if (target) {
    const dmgInfo = GL.rollDamage(stats.atk, target.def, stats.crit);
    GL.applyMonsterHit(target, dmgInfo);
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
    if (bossTarget) {
      const dmgInfo = GL.rollDamage(stats.atk * skill.mult * lvBonus, 0, stats.crit + 10);
      GL.socketEmit('world_boss_attack', { mapId: GL.map.id, zone: GL.player.zone, dmg: dmgInfo.dmg });
      GL.spawnDamageNumber(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y - 40, (dmgInfo.crit ? '💥' : '') + dmgInfo.dmg, dmgInfo.crit ? 'gl-crit' : '');
    } else {
      const targets = isAoe ? GL.monsters.filter((m) => m.alive && GL.dist(m, GL.player) < 110) : [GL.nearestMonster(110)].filter(Boolean);
      targets.forEach((m) => {
        const dmgInfo = GL.rollDamage(stats.atk * skill.mult * lvBonus, m.def, stats.crit + 10);
        GL.applyMonsterHit(m, dmgInfo);
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
  const d = GL.dist(t, GL.player);
  if (d > 55) {
    const ang = Math.atan2(t.y - GL.player.y, t.x - GL.player.x);
    const stats = GL.currentStats();
    const speed = 95 + stats.spd * 14;
    GL.player.x += Math.cos(ang) * speed * dt; GL.player.y += Math.sin(ang) * speed * dt;
    GL.player.dir = Math.cos(ang) >= 0 ? 1 : -1; GL.player.moving = true;
  } else {
    GL.player.moving = false;
    GL.tryAttack();
  }
};
