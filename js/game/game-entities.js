// ============================================================================
// Thực thể trong game: quái, NPC, va chạm, sát thương
// Mô hình CUỘN NGANG (như Ngọc Rồng Online): thế giới là 1 dải ngang dài,
// mọi thực thể di chuyển trái/phải trên cùng 1 đường ground (GROUND_Y).
// ============================================================================
GL.WORLD = { w: 3200, h: 220, pad: 100 };
GL.GROUND_Y = 150; // đường "mặt đất" cố định — nhân vật/quái/NPC luôn đứng trên đường này

// Đặt NPC lệch hẳn về BÊN PHẢI điểm xuất phát (spawn ~x400) — dù joystick giờ đã ưu tiên bắt trúng
// NPC trước khi mở (xem GL.tryInteractAt), vẫn xếp NPC xa khu vực joystick hay dùng nhất cho chắc ăn.
GL.NPC_DEFS = [
  { id: 'npc_quest', name: 'Trưởng Lão Nhiệm Vụ', icon: 'scroll', x: 560, y: GL.GROUND_Y, kind: 'quest' },
  { id: 'npc_portal', name: 'Người Dẫn Đường', icon: 'portal', x: 700, y: GL.GROUND_Y, kind: 'portal' },
  { id: 'npc_potion', name: 'Dược Sư', icon: 'flask', x: 840, y: GL.GROUND_Y, kind: 'potion' },
  { id: 'npc_weapon', name: 'Thợ Rèn Vũ Khí', icon: 'sword', x: 980, y: GL.GROUND_Y, kind: 'weapon' },
  { id: 'npc_armor', name: 'Thợ Rèn Giáp', icon: 'shield', x: 1120, y: GL.GROUND_Y, kind: 'armor' },
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
// Quái "đánh xa" (caster/archer, ~1/3 số quái) đứng lại bắn từ khoảng cách thay vì lao vào cận chiến
// như "đánh gần" (knight/beast) — làm rõ khác biệt lối đánh giữa các loại quái theo đúng yêu cầu.
const RANGED_SHAPES = new Set(['caster', 'archer']);
function attackRangeFor(m) {
  if (m.isBoss) return 46; // boss (guardian) vẫn cận chiến hết — chưa có shape riêng cho boss
  return RANGED_SHAPES.has(m.def.shape) ? 165 : 42;
}

GL.spawnProjectile = function (x1, y1, x2, y2, color) {
  GL.projectiles.push({ x1, y1, x2, y2, color: color || '#F5D061', spawnedAt: performance.now(), duration: 220 });
};

GL.updateMonsters = function (dt, now) {
  const p = GL.player;
  GL.monsters.forEach((m) => {
    if (!m.alive) {
      if (now >= m.respawnAt) {
        m.alive = true; m.hp = m.maxHp; m.x = m.homeX; m.y = m.homeY; m.state = 'idle';
      }
      return;
    }
    if (m.stunnedUntil && performance.now() < m.stunnedUntil) return; // choáng do Chiêu 3 V1 của pet — đứng im, không đánh/đuổi
    let target = p, bestD = GL.distX(m, p);
    (GL.summons || []).forEach((s) => { if (!s.alive) return; const d = GL.distX(m, s); if (d < bestD) { target = s; bestD = d; } });
    const atkRange = attackRangeFor(m);

    if (m.state !== 'attack') {
      const leashDist = m.isBoss ? 400 : 260; // trần khoảng cách được dụ đi xa khỏi điểm gốc — quái/boss không bị kéo xuyên bản đồ
      if (bestD < 150 && Math.abs(m.x - m.homeX) < leashDist) {
        m.state = 'chase';
        const dirX = target.x >= m.x ? 1 : -1;
        const spd = m.isBoss ? 55 : 70;
        // Quái đánh xa DỪNG LẠI ngay khi vào tầm bắn thay vì lao vào cận chiến như quái đánh gần.
        if (bestD > atkRange) { m.x += dirX * spd * dt; m.dir = dirX; } else { m.dir = dirX; }
      } else if (bestD > 220 || Math.abs(m.x - m.homeX) >= leashDist) {
        const dirX = m.homeX >= m.x ? 1 : -1;
        if (Math.abs(m.x - m.homeX) > 6) { m.x += dirX * 40 * dt; }
        m.state = 'idle';
      }
    }
    m.attackTimer -= dt;
    if (bestD < atkRange && m.attackTimer <= 0) {
      m.attackTimer = RANGED_SHAPES.has(m.def.shape) ? 1.6 : 1.2; // đánh xa hồi chiêu lâu hơn 1 chút để bù lại lợi thế đứng an toàn
      const targetDef = target === p ? GL.currentStats().def : target.def;
      const { dmg, crit } = GL.rollDamage(m.atk, targetDef, 5);
      if (target === p) GL.damagePlayer(dmg); else GL.damageSummon(target, dmg);
      GL.spawnDamageNumber(target.x, target.y - 30, '-' + dmg, crit ? 'gl-crit' : '');
      if (!m.isBoss && RANGED_SHAPES.has(m.def.shape)) GL.spawnProjectile(m.x, m.y - 30, target.x, target.y - 30, m.def.color);
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

// ---------- Pet (bản cập nhật Pet-Aura) ----------
// Khác Summon: pet KHÔNG có expiresAt (tồn tại vĩnh viễn cho tới khi chết rồi tự hồi sinh sau 3 phút),
// có 3 chế độ đổi qua chat (def/atk/fl) hoặc bảng Pet, và có tối đa 3 chiêu mở dần theo level (đồng bộ
// theo char.level, xem GL.data.petSkill2Versions/petSkill3Versions/petSkill4).
// LƯU Ý ĐẶT TÊN: `defObj` = object định nghĩa loại pet (tên/portrait/frameCount, từ GL.data.pets), còn
// `def` (không có Obj) = CHỈ SỐ PHÒNG THỦ, đúng quy ước đang dùng cho quái/summon (m.def, s.def...).
GL.spawnPetsFromChar = function (opts = {}) {
  const fresh = !!opts.fresh; // true khi mới vào game / vừa đổi map -> đặt lại vị trí cạnh chủ + đầy HP
  const list = (GL.char.pets || []).map((p, idx) => {
    const existing = GL.pets.find((x) => x.slot === idx && x.defId === p.defId);
    if (existing && !fresh) {
      // Pet vẫn còn đó giữa 2 lần đồng bộ dữ liệu (VD: vừa lên cấp) — CHỈ cập nhật lại chỉ số/chiêu
      // theo dữ liệu mới nhất, KHÔNG đụng vị trí hay % HP hiện tại (tránh giật hình khi đang giao tranh).
      const hpRatio = existing.maxHp > 0 ? existing.hp / existing.maxHp : 1;
      existing.defObj = GL.data.pets[p.defId];
      existing.maxHp = p.stats.hp; existing.hp = existing.isDead ? 0 : Math.round(p.stats.hp * hpRatio);
      existing.maxKi = p.stats.ki; existing.atk = p.stats.atk; existing.def = p.stats.def;
      existing.mode = p.mode; existing.skill2Version = p.skill2Version; existing.skill3Version = p.skill3Version; existing.hasSkill4 = p.hasSkill4;
      if (!existing.isDead && p.isDead) { existing.isDead = true; existing.deadUntil = new Date(p.deadUntil).getTime(); }
      return existing;
    }
    return {
      uid: 'pet_' + idx, slot: idx, defId: p.defId, defObj: GL.data.pets[p.defId], role: p.role,
      x: GL.player.x + (idx === 0 ? -34 : 34), y: GL.GROUND_Y, dir: 1,
      hp: p.stats.hp, maxHp: p.stats.hp, atk: p.stats.atk, def: p.stats.def, ki: p.stats.ki, maxKi: p.stats.ki,
      mode: p.mode, skill2Version: p.skill2Version, skill3Version: p.skill3Version, hasSkill4: p.hasSkill4,
      isDead: p.isDead, deadUntil: p.deadUntil ? new Date(p.deadUntil).getTime() : 0,
      state: 'idle', attackTimer: 0, skill2Cd: 0, skill3Cd: 0, skill4Cd: 0, skill4ActiveUntil: 0,
      frameT: Math.random() * 8, reportedDead: false,
    };
  });
  GL.pets = list;
};

GL.damagePet = function (pet, dmg) {
  if (pet.isDead) return;
  pet.hp = Math.max(0, pet.hp - dmg);
  if (pet.hp <= 0 && !pet.isDead) {
    pet.isDead = true;
    pet.deadUntil = performance.now() + GL.data.petDeathMs;
    pet.state = 'idle';
    if (!pet.reportedDead) {
      pet.reportedDead = true;
      API.post('/game/character/pet/death', { slot: pet.slot }).catch(() => {});
    }
    GL.toast(`${pet.defObj?.name || 'Pet'} đã gục, sẽ hồi sinh sau 3 phút`, '', 'skull');
  }
};

function petSkillMultCd(pet) {
  const s2 = pet.skill2Version ? GL.data.petSkill2Versions[pet.skill2Version] : null;
  const s3 = pet.skill3Version ? GL.data.petSkill3Versions[pet.skill3Version] : null;
  return { s2, s3 };
}

// Chiêu 2 (tầm xa, "chưởng") — bắn thẳng vào mục tiêu hiện tại, không cần lại gần
function petCastSkill2(pet, target, s2) {
  pet.skill2Cd = s2.cd;
  const dmgInfo = GL.rollDamage(pet.atk * s2.mult * GL.auraDmgMult(), target.def || 0, 5);
  if (target === 'boss') { GL.socketEmit('world_boss_attack', { mapId: GL.map.id, zone: GL.player.zone, dmg: dmgInfo.dmg }); GL.spawnDamageNumber(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y - 50, dmgInfo.dmg, 'gl-crit'); }
  else GL.applyMonsterHit(target, dmgInfo);
  GL.spawnDamageNumber(pet.x, pet.y - 40, 'Chưởng!', '');
}

// Chiêu 3 (66s cd, stun hoặc DoT tuỳ version) — level-scale thay cho "điểm cộng tay" (pet không có điểm chiêu riêng, xem gameData.js)
function petCastSkill3(pet, target, s3) {
  pet.skill3Cd = s3.cd;
  if (s3.effect === 'stun') {
    const steps = Math.min(s3.maxBonus / s3.durationPerLevelStep, Math.floor((GL.char.level || 1) / s3.levelStep));
    const dur = s3.durationBase + steps * s3.durationPerLevelStep;
    if (target !== 'boss') target.stunnedUntil = performance.now() + dur * 1000;
    GL.spawnDamageNumber(pet.x, pet.y - 40, `Choáng ${dur.toFixed(1)}s!`, 'gl-crit');
  } else {
    const totalPct = s3.pctPerSec * s3.duration;
    const dmgInfo = { dmg: Math.round((target === 'boss' ? 5000 : target.maxHp) * totalPct), crit: false };
    if (target === 'boss') GL.socketEmit('world_boss_attack', { mapId: GL.map.id, zone: GL.player.zone, dmg: dmgInfo.dmg });
    else GL.applyMonsterHit(target, dmgInfo);
    GL.spawnDamageNumber(pet.x, pet.y - 40, 'Độc!', 'gl-crit');
  }
}

// Chiêu 4 (level 60, cố định) — triệu hồi "Mini Monster" bay theo pet 40s, không thể bị chọn làm mục tiêu
GL.petMiniMonsters = [];
function petCastSkill4(pet) {
  const s4 = GL.data.petSkill4;
  pet.skill4Cd = s4.cd;
  pet.skill4ActiveUntil = performance.now() + s4.duration * 1000;
  GL.toast(`${pet.defObj.name} triệu hồi Tiểu Quái đồng hành!`, '', 'sparkles');
}

GL.updatePets = function (dt, now) {
  GL.pets.forEach((pet) => {
    if (pet.isDead) {
      if (performance.now() >= pet.deadUntil && pet.deadUntil) {
        pet.isDead = false; pet.reportedDead = false;
        pet.hp = pet.maxHp; pet.x = GL.player.x + (pet.slot === 0 ? -34 : 34); pet.y = GL.GROUND_Y;
      }
      return;
    }
    pet.frameT += dt;
    pet.skill2Cd = Math.max(0, pet.skill2Cd - dt); pet.skill3Cd = Math.max(0, pet.skill3Cd - dt); pet.skill4Cd = Math.max(0, pet.skill4Cd - dt);

    if (pet.mode === 'fl') { // Theo: chỉ bám chủ, không tấn công
      const d = GL.distX(pet, GL.player);
      if (d > 60) { const dirX = GL.player.x >= pet.x ? 1 : -1; pet.x += dirX * 130 * dt; pet.dir = dirX; pet.state = 'chase'; }
      else pet.state = 'idle';
      return;
    }

    const guardRange = pet.mode === 'def' ? 130 : 300; // Thủ: chỉ đánh quái gần CHỦ | Công: chủ động tìm xa hơn quanh pet
    const originEntity = pet.mode === 'def' ? GL.player : pet;
    let target = null, bestD = guardRange;
    const bossNear = GL.nearestBossTarget ? GL.nearestBossTarget(guardRange) : null;
    GL.monsters.forEach((m) => { if (!m.alive) return; const d = GL.distX(m, originEntity); if (d < bestD) { target = m; bestD = d; } });
    if (!target && bossNear) target = 'boss';

    if (!target) {
      const d = GL.distX(pet, GL.player);
      if (d > 90) { const dirX = GL.player.x >= pet.x ? 1 : -1; pet.x += dirX * 120 * dt; pet.dir = dirX; pet.state = 'chase'; }
      else pet.state = 'idle';
      return;
    }

    const tx = target === 'boss' ? GL.BOSS_SPOT.x : target.x;
    const distToTarget = Math.abs(pet.x - tx);
    const { s2, s3 } = petSkillMultCd(pet);

    // Ưu tiên chiêu 3 (66s, mạnh) nếu đã học và hết hồi chiêu
    if (s3 && pet.skill3Cd <= 0) { petCastSkill3(pet, target, s3); return; }
    // Xa mà có chiêu 2 (chưởng) thì dùng luôn không cần lại gần; chưa có thì lao vào đấm
    if (distToTarget > 40 && s2 && pet.skill2Cd <= 0) { petCastSkill2(pet, target, s2); return; }
    if (pet.hasSkill4 && pet.skill4Cd <= 0 && Math.random() < 0.15) { petCastSkill4(pet); }

    if (distToTarget > 34) {
      const dirX = tx >= pet.x ? 1 : -1;
      pet.x += dirX * 150 * dt; pet.dir = dirX; pet.state = 'chase';
    } else {
      pet.state = 'attack'; pet.attackTimer -= dt;
      if (pet.attackTimer <= 0) {
        pet.attackTimer = 0.9;
        const dmgInfo = GL.rollDamage(pet.atk * GL.auraDmgMult(), target === 'boss' ? 0 : target.def, 8);
        if (target === 'boss') { GL.socketEmit('world_boss_attack', { mapId: GL.map.id, zone: GL.player.zone, dmg: dmgInfo.dmg }); GL.spawnDamageNumber(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y - 40, dmgInfo.dmg, dmgInfo.crit ? 'gl-crit' : ''); }
        else GL.applyMonsterHit(target, dmgInfo);
      }
    }
  });

  // Tiểu Quái đồng hành (Chiêu 4) — bay theo pet, tự tấn công cùng lúc, không phải mục tiêu hợp lệ để bị đánh
  GL.petMiniMonsters = GL.pets.filter((p) => !p.isDead && p.skill4ActiveUntil > performance.now());
};

// Lệnh gõ trong chat "def"/"atk"/"fl" — áp dụng cho TẤT CẢ pet đang sở hữu cùng lúc (đổi từng con riêng thì dùng bảng Pet)
GL.setAllPetsMode = async function (mode) {
  if (!GL.pets.length) { GL.toast('Bạn chưa có pet'); return; }
  GL.pets.forEach((p) => { p.mode = mode; });
  const label = { def: 'Thủ', atk: 'Tấn Công', fl: 'Theo' }[mode];
  GL.toast(`Pet: ${label}`, '', 'paw');
  await Promise.all(GL.pets.map((p) => API.post('/game/character/pet/mode', { slot: p.slot, mode }).catch(() => {})));
};
