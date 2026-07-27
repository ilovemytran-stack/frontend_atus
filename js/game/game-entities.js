// ============================================================================
// Thực thể trong game: quái, NPC, va chạm, sát thương
// Mô hình CUỘN NGANG (như Ngọc Rồng Online): thế giới là 1 dải ngang dài,
// mọi thực thể di chuyển trái/phải trên cùng 1 đường ground (GROUND_Y).
// ============================================================================
GL.WORLD = { w: 3200, h: 220, pad: 100 };
GL.GROUND_Y = 150; // đường "mặt đất" cố định — nhân vật/quái/NPC luôn đứng trên đường này

GL.NPC_DEFS = [
  { id: 'npc_quest', name: 'Trưởng Lão Nhiệm Vụ', icon: '📜', x: 180, y: GL.GROUND_Y, kind: 'quest' },
  { id: 'npc_portal', name: 'Người Dẫn Đường', icon: '🌀', x: 300, y: GL.GROUND_Y, kind: 'portal' },
  { id: 'npc_potion', name: 'Dược Sư', icon: '🧪', x: 420, y: GL.GROUND_Y, kind: 'potion' },
  { id: 'npc_weapon', name: 'Thợ Rèn Vũ Khí', icon: '⚔️', x: 540, y: GL.GROUND_Y, kind: 'weapon' },
  { id: 'npc_armor', name: 'Thợ Rèn Giáp', icon: '🛡️', x: 660, y: GL.GROUND_Y, kind: 'armor' },
];

// Rắc điểm dọc theo 1 đường ngang, cách đều + rung nhẹ (thay cho lưới 2D cũ)
function jitteredLine(count, xStart, xEnd) {
  const span = (xEnd - xStart) / count;
  const pts = [];
  for (let i = 0; i < count; i++) {
    const jitter = (Math.random() - 0.5) * span * 0.4;
    pts.push({ x: xStart + span * (i + 0.5) + jitter, y: GL.GROUND_Y + (Math.random() - 0.5) * 14 });
  }
  return pts;
}

// point 4/5: tối đa 10 quái mỗi map, mỗi con cách nhau 1 đoạn (dọc theo đường ngang)
GL.spawnMonsters = function (map) {
  const list = [];
  if (!map.monsterIds.length) { GL.monsters = list; return list; }
  const count = Math.min(map.maxMonsters || 10, 10);
  const npcZoneEnd = map.role === 'hub' ? 760 : 200; // né khu NPC nếu là map hub
  const pts = jitteredLine(count, npcZoneEnd, GL.WORLD.w - 100);
  const lvl = map.levelRange[1];
  pts.forEach((p, i) => {
    const isBossSlot = map.hasBoss && i === 0; // 1 Thần Hộ Vệ đại diện trong map boss
    let monsterId, def, isBoss, scaled;
    const guardian = isBossSlot ? GL.data.bosses.find((b) => b.continent === map.continentId) : null;
    if (guardian) {
      const cont = GL.data.continents.find((c) => c.id === map.continentId);
      monsterId = guardian.id; def = { nameVN: guardian.name, color: cont.color, shape: 'knight' }; isBoss = true;
      scaled = { ...GLGuardianBossStats(map.continentId, lvl), xp: 0, goldMin: 0, goldMax: 0 };
      // Neo Thần Hộ Vệ ở vị trí cố định cách xa GOD_SPOT(1900)/BOSS_SPOT(2200) — map Celestia vừa có
      // Thần Hộ Vệ riêng vừa có thể là nơi Chaoseraph lang thang tới, tránh 2 thanh máu chồng lên nhau.
      p.x = 450; p.y = GL.GROUND_Y;
    } else {
      monsterId = map.monsterIds[i % map.monsterIds.length];
      isBoss = isBossSlot; // hasBoss nhưng không có data BOSSES tương ứng: vẫn buff quái thường như cũ
      def = GL.data.monsters[monsterId];
      scaled = GLScaleMonster(def, lvl, isBoss, map.isMixedTier);
    }
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

// Thần Hộ Vệ (Guardian Boss riêng của lục địa, đứng ở map role='boss') — bản sao rút gọn phía client
// để hiển thị thanh máu mượt; server (guardianBossStatsFor) mới là nguồn thật khi trả thưởng.
function GLGuardianBossStats(continentId, mapLevel) {
  const cont = GL.data.continents.find((c) => c.id === continentId);
  const mons = cont.monsters.map((id) => GL.data.monsters[id]);
  const avgHp = mons.reduce((s, m) => s + m.baseHp, 0) / mons.length;
  const avgAtk = mons.reduce((s, m) => s + m.baseAtk, 0) / mons.length;
  const avgDef = mons.reduce((s, m) => s + m.baseDef, 0) / mons.length;
  const lvGrow = 1 + (mapLevel - 1) * 0.12;
  return {
    hp: Math.round(avgHp * lvGrow * 14),
    atk: Math.round(avgAtk * lvGrow * 2.6),
    def: Math.round(avgDef * lvGrow * 2.2),
  };
}

GL.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// khoảng cách "thật" cho gameplay cuộn ngang: chỉ tính theo trục X (nhân vật/quái luôn ở ground Y)
GL.distX = (a, b) => Math.abs(a.x - b.x);

GL.rollDamage = (atk, def, critChance) => {
  const base = Math.max(1, atk - def * 0.5);
  const variance = base * (0.85 + Math.random() * 0.3);
  const isCrit = Math.random() * 100 < critChance;
  return { dmg: Math.round(variance * (isCrit ? 1.6 : 1)), crit: isCrit };
};

GL.spawnDamageNumber = function (worldX, worldY, text, cls) {
  GL.fx.push({ x: worldX, y: worldY, text, cls, life: 0.8, t: 0 });
};

// cập nhật AI quái mỗi frame (dt = giây) — nhắm vào mục tiêu gần nhất theo trục ngang: người chơi HOẶC thú triệu hồi
GL.updateMonsters = function (dt, now) {
  const p = GL.player;
  GL.monsters.forEach((m) => {
    if (!m.alive) {
      if (now >= m.respawnAt) {
        m.alive = true; m.hp = m.maxHp; m.x = m.homeX; m.y = m.homeY; m.state = 'idle';
      }
      return;
    }
    let target = p, bestD = GL.distX(m, p);
    (GL.summons || []).forEach((s) => { if (!s.alive) return; const d = GL.distX(m, s); if (d < bestD) { target = s; bestD = d; } });

    if (m.state !== 'attack') {
      const leashDist = m.isBoss ? 400 : 260; // trần khoảng cách được dụ đi xa khỏi điểm gốc — quái/boss không bị kéo xuyên bản đồ
      if (bestD < 150 && Math.abs(m.x - m.homeX) < leashDist) {
        m.state = 'chase';
        const dirX = target.x >= m.x ? 1 : -1;
        const spd = m.isBoss ? 55 : 70;
        if (bestD > 34) { m.x += dirX * spd * dt; m.dir = dirX; }
      } else if (bestD > 220 || Math.abs(m.x - m.homeX) >= leashDist) {
        const dirX = m.homeX >= m.x ? 1 : -1;
        if (Math.abs(m.x - m.homeX) > 6) { m.x += dirX * 40 * dt; }
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
    x: GL.player.x + 34, y: GL.GROUND_Y, dir: 1,
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
    GL.monsters.forEach((m) => { if (!m.alive) return; const d = GL.distX(m, s); if (d < bestD) { target = m; bestD = d; } });
    if (target) {
      if (bestD > 36) {
        const dirX = target.x >= s.x ? 1 : -1;
        s.x += dirX * s.speed * dt; s.dir = dirX; s.state = 'chase';
      } else {
        s.state = 'attack'; s.attackTimer -= dt;
        if (s.attackTimer <= 0) { s.attackTimer = 1.1; const dmgInfo = GL.rollDamage(s.atk, target.def, 5); GL.applyMonsterHit(target, dmgInfo); }
      }
    } else {
      const d = GL.distX(s, GL.player);
      if (d > 70) {
        const dirX = GL.player.x >= s.x ? 1 : -1;
        s.x += dirX * s.speed * dt; s.dir = dirX; s.state = 'chase';
      } else s.state = 'idle';
    }
  });
};
