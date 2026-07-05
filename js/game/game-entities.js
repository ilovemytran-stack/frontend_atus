// ============================================================================
// Thực thể trong game: quái, NPC, va chạm, sát thương
// ============================================================================
GL.WORLD = { w: 2000, h: 1150, pad: 120 };

GL.NPC_DEFS = [
  { id: 'npc_quest', name: 'Trưởng Lão Nhiệm Vụ', icon: '📜', x: 260, y: 300, kind: 'quest' },
  { id: 'npc_portal', name: 'Người Dẫn Đường', icon: '🌀', x: 340, y: 420, kind: 'portal' },
  { id: 'npc_potion', name: 'Dược Sư', icon: '🧪', x: 200, y: 500, kind: 'potion' },
  { id: 'npc_weapon', name: 'Thợ Rèn Vũ Khí', icon: '⚔️', x: 420, y: 260, kind: 'weapon' },
  { id: 'npc_armor', name: 'Thợ Rèn Giáp', icon: '🛡️', x: 300, y: 180, kind: 'armor' },
];

function jitteredGrid(count, bounds) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = (bounds.w - bounds.pad * 2) / cols;
  const cellH = (bounds.h - bounds.pad * 2) / rows;
  const pts = [];
  for (let i = 0; i < count; i++) {
    const cx = i % cols, cy = Math.floor(i / cols);
    const jx = (Math.random() - 0.5) * cellW * 0.35;
    const jy = (Math.random() - 0.5) * cellH * 0.35;
    pts.push({
      x: bounds.pad + cellW * (cx + 0.5) + jx,
      y: bounds.pad + cellH * (cy + 0.5) + jy,
    });
  }
  return pts;
}

// point 4/5: tối đa 10 quái mỗi map, mỗi con cách nhau 1 đoạn
GL.spawnMonsters = function (map) {
  const list = [];
  if (!map.monsterIds.length) { GL.monsters = list; return list; }
  const count = Math.min(map.maxMonsters || 10, 10);
  const spawnZone = { w: GL.WORLD.w - 420, h: GL.WORLD.h, pad: 90 }; // né khu NPC bên trái
  const pts = jitteredGrid(count, spawnZone).map((p) => ({ x: p.x + 420, y: p.y }));
  const lvl = map.levelRange[1];
  pts.forEach((p, i) => {
    let monsterId = map.monsterIds[i % map.monsterIds.length];
    const isBoss = map.hasBoss && i === 0; // 1 boss đại diện trong map boss
    const def = GL.data.monsters[monsterId];
    const scaled = GLScaleMonster(def, lvl, isBoss, map.isMixedTier);
    list.push({
      uid: 'm' + i + '_' + Date.now(),
      defId: monsterId, def, isBoss,
      x: p.x, y: p.y, homeX: p.x, homeY: p.y,
      hp: scaled.hp, maxHp: scaled.hp, atk: scaled.atk, def: scaled.def,
      xp: scaled.xp, goldMin: scaled.goldMin, goldMax: scaled.goldMax, gemChance: scaled.gemChance,
      state: 'idle', dir: 1, attackTimer: 0, alive: true, respawnAt: 0,
    });
  });
  GL.monsters = list;
  return list;
};

// bản sao rút gọn của scaleMonster bên server để hiển thị mượt phía client (server vẫn là nguồn thật khi trả thưởng)
function GLScaleMonster(def, mapLevel, isBoss, isMixTier) {
  const mult = isBoss ? 6 : (isMixTier ? 1.8 : 1);
  const lvGrow = 1 + (mapLevel - 1) * 0.12;
  return {
    hp: Math.round(def.baseHp * lvGrow * mult),
    atk: Math.round(def.baseAtk * lvGrow * (isBoss ? 2.2 : (isMixTier ? 1.4 : 1))),
    def: Math.round(def.baseDef * lvGrow * (isBoss ? 1.8 : (isMixTier ? 1.3 : 1))),
    xp: Math.round((8 + mapLevel * 2) * mult),
    goldMin: Math.round((2 + mapLevel * 0.6) * (isBoss ? 8 : 1)),
    goldMax: Math.round((6 + mapLevel * 1.2) * (isBoss ? 10 : 1)),
  };
}

GL.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

GL.rollDamage = (atk, def, critChance) => {
  const base = Math.max(1, atk - def * 0.5);
  const variance = base * (0.85 + Math.random() * 0.3);
  const isCrit = Math.random() * 100 < critChance;
  return { dmg: Math.round(variance * (isCrit ? 1.6 : 1)), crit: isCrit };
};

GL.spawnDamageNumber = function (worldX, worldY, text, cls) {
  GL.fx.push({ x: worldX, y: worldY, text, cls, life: 0.8, t: 0 });
};

// cập nhật AI quái mỗi frame (dt = giây) — nhắm vào mục tiêu gần nhất: người chơi HOẶC thú triệu hồi
GL.updateMonsters = function (dt, now) {
  const p = GL.player;
  GL.monsters.forEach((m) => {
    if (!m.alive) {
      if (now >= m.respawnAt) {
        m.alive = true; m.hp = m.maxHp; m.x = m.homeX; m.y = m.homeY; m.state = 'idle';
      }
      return;
    }
    let target = p, bestD = GL.dist(m, p);
    (GL.summons || []).forEach((s) => { if (!s.alive) return; const d = GL.dist(m, s); if (d < bestD) { target = s; bestD = d; } });

    if (m.state !== 'attack') {
      if (bestD < 150) {
        m.state = 'chase';
        const ang = Math.atan2(target.y - m.y, target.x - m.x);
        const spd = m.isBoss ? 55 : 70;
        if (bestD > 34) { m.x += Math.cos(ang) * spd * dt; m.y += Math.sin(ang) * spd * dt; m.dir = Math.cos(ang) >= 0 ? 1 : -1; }
      } else if (bestD > 220) {
        const ang = Math.atan2(m.homeY - m.y, m.homeX - m.x);
        if (GL.dist(m, { x: m.homeX, y: m.homeY }) > 6) { m.x += Math.cos(ang) * 40 * dt; m.y += Math.sin(ang) * 40 * dt; }
        m.state = 'idle';
      }
    }
    m.attackTimer -= dt;
    if (bestD < 42 && m.attackTimer <= 0) {
      m.attackTimer = 1.2;
      const targetDef = target === p ? GL.currentStats().def : target.def;
      const { dmg, crit } = GL.rollDamage(m.atk, targetDef, 5);
      if (target === p) GL.damagePlayer(dmg); else GL.damageSummon(target, dmg);
      GL.spawnDamageNumber(target.x, target.y - 30, '-' + dmg, crit ? 'gl-crit' : '');
    }
  });
};

// ---------- Thú triệu hồi (Malakai) ----------
GL.spawnSummon = function (defId, skillId, duration) {
  const def = GL.data.minions[defId];
  if (!def) return;
  const stats = GL.currentStats();
  const lv = GL.char.skillLevels?.[skillId] || 0;
  GL.summons = GL.summons.filter((s) => s.defId !== defId); // chỉ 1 con mỗi loại cùng lúc
  const hp = Math.round(stats.hp * def.hpPct + lv * def.hpPerLv);
  const atk = Math.round(stats.atk * def.atkPct + lv * def.atkPerLv);
  const defStat = Math.round(stats.def * def.defPct + lv * def.defPerLv);
  GL.summons.push({
    uid: 's' + Date.now() + Math.random(), defId, def,
    x: GL.player.x + 34, y: GL.player.y, dir: 1,
    hp, maxHp: hp, atk, def: defStat, speed: def.speed,
    expiresAt: performance.now() + duration * 1000, state: 'idle', attackTimer: 0, alive: true,
  });
};

GL.damageSummon = function (s, dmg) {
  s.hp = Math.max(0, s.hp - dmg);
  if (s.hp <= 0) s.alive = false;
};

GL.updateSummons = function (dt, now) {
  GL.summons = GL.summons.filter((s) => s.alive && now < s.expiresAt);
  GL.summons.forEach((s) => {
    let target = null, bestD = 260;
    GL.monsters.forEach((m) => { if (!m.alive) return; const d = GL.dist(m, s); if (d < bestD) { target = m; bestD = d; } });
    if (target) {
      if (bestD > 36) {
        const ang = Math.atan2(target.y - s.y, target.x - s.x);
        s.x += Math.cos(ang) * s.speed * dt; s.y += Math.sin(ang) * s.speed * dt; s.dir = Math.cos(ang) >= 0 ? 1 : -1; s.state = 'chase';
      } else {
        s.state = 'attack'; s.attackTimer -= dt;
        if (s.attackTimer <= 0) { s.attackTimer = 1.1; const dmgInfo = GL.rollDamage(s.atk, target.def, 5); GL.applyMonsterHit(target, dmgInfo); }
      }
    } else {
      const d = GL.dist(s, GL.player);
      if (d > 70) {
        const ang = Math.atan2(GL.player.y - s.y, GL.player.x - s.x);
        s.x += Math.cos(ang) * s.speed * dt; s.y += Math.sin(ang) * s.speed * dt; s.dir = Math.cos(ang) >= 0 ? 1 : -1; s.state = 'chase';
      } else s.state = 'idle';
    }
  });
};
