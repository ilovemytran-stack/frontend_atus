// ============================================================================
// Render: canvas 2D — thân nhân vật vẫn vẽ bằng vector để hoạt ảnh mượt
// (đi/đứng/đánh) dựa trên silhouette + màu class/quái, KHÔNG cần khung hình
// animation cắt sẵn. Phía trên đầu mỗi nhân vật (người chơi/người chơi khác)
// giờ có thêm avatar tròn dùng ẢNH THẬT từ bản vẽ Character (portrait), crop
// tự động vào khung tròn — xem drawAvatarChip().
// ============================================================================
let ctx, canvas, DPR = 1;

// ---------- Prop trang trí theo TỪNG MAP (ảnh PNG nền trong suốt thật, cắt từ bản vẽ riêng mỗi map) ----------
const propImageCache = {};
const propPlacements = {};

// ---------- Avatar tròn nhân vật (ảnh PORTRAIT thật từ bản vẽ Character, đè lên trên thân vector) ----------
const classPortraitCache = {};
function getClassPortrait(cls) {
  if (!cls || !cls.portrait) return null;
  let img = classPortraitCache[cls.id];
  if (!img) {
    img = new Image();
    img.src = cls.portrait;
    classPortraitCache[cls.id] = img;
  }
  return img;
}

// Vẽ avatar tròn (ảnh thật) tại (sx,sy) với viền màu class — dùng clip hình tròn nên
// không cần ảnh nền trong suốt, ảnh vuông/chữ nhật nào cũng crop gọn vào khung tròn.
function drawAvatarChip(sx, sy, cls, radiusPx) {
  if (!cls) return false;
  const img = getClassPortrait(cls);
  const r = radiusPx * DPR;
  if (img && img.complete && img.naturalWidth) {
    ctx.save();
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    // crop trung tâm ảnh theo hình vuông trước khi vẽ tròn, tránh méo tỉ lệ
    const iw = img.naturalWidth, ih = img.naturalHeight, side = Math.min(iw, ih);
    const sx0 = (iw - side) / 2, sy0 = (ih - side) / 2;
    ctx.drawImage(img, sx0, sy0, side, side, sx - r, sy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fillStyle = '#1a1826'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.strokeStyle = cls.color || '#F5D061'; ctx.lineWidth = 1.6 * DPR; ctx.stroke();
  return true;
}

function hashSeed(str) {
  let h = 1779033703;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return (h >>> 0) || 1337;
}

function loadMapProps(map) {
  if (!map || propPlacements[map.id]) return;
  const count = map.propCount || 0;
  if (!count) { propPlacements[map.id] = []; return; }
  const basePath = `/assets/game/tiles/${map.continentId}/map${map.index}/prop_`;
  const imgs = [];
  for (let i = 0; i < count; i++) {
    const img = new Image();
    img.src = `${basePath}${String(i).padStart(2, '0')}.png`;
    imgs.push(img);
  }
  propImageCache[map.id] = imgs;
  // seed riêng theo id map -> mỗi map bố cục rắc prop khác nhau, không lặp lại giữa các map
  let seed = hashSeed(map.id);
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 1000) / 1000; };
  const isHub = map.role === 'hub';
  const npcZoneEnd = isHub ? 760 : 140; // né đúng dải NPC (x:180-660) khi là map hub
  const placements = [];
  const propTotal = Math.min(isHub ? 16 : 26, count);
  for (let i = 0; i < propTotal; i++) {
    placements.push({
      imgIdx: Math.floor(rnd() * count),
      x: npcZoneEnd + rnd() * (GL.WORLD.w - npcZoneEnd - 80),
      y: GL.GROUND_Y + (rnd() - 0.5) * 16, // đứng sát đường ground, rung nhẹ cho tự nhiên
      scale: 0.45 + rnd() * 0.55,
    });
  }
  placements.sort((a, b) => a.x - b.x);
  propPlacements[map.id] = placements;
}

function drawMapProps(map) {
  if (!map) return;
  const imgs = propImageCache[map.id];
  const placements = propPlacements[map.id];
  if (!imgs || !placements) return;
  placements.forEach((pl) => {
    const img = imgs[pl.imgIdx];
    if (!img.complete || !img.naturalWidth) return;
    const { sx, sy } = worldToScreen(pl.x, pl.y);
    const w = img.naturalWidth * pl.scale * DPR * 0.4;
    const h = img.naturalHeight * pl.scale * DPR * 0.4;
    if (sx < -w || sy < -h || sx > canvas.width + w || sy > canvas.height + h) return;
    ctx.globalAlpha = 0.96;
    ctx.drawImage(img, sx - w / 2, sy - h, w, h);
    ctx.globalAlpha = 1;
  });
}

GL.initCanvas = function () {
  canvas = document.getElementById('glCanvas');
  ctx = canvas.getContext('2d');
  GL.resizeCanvas();
  window.addEventListener('resize', GL.resizeCanvas);
};

GL.resizeCanvas = function () {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * DPR;
  canvas.height = window.innerHeight * DPR;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
};

function groundColorFor(continent) {
  const map = {
    aurelion: ['#3a3320', '#4a4128'], draconia: ['#2c1512', '#3a1c16'], verdantia: ['#122414', '#173019'],
    shadowfell: ['#171128', '#1e1633'], aquaris: ['#0c2230', '#0f2c3d'], crystalia: ['#1a2733', '#22333f'],
    sandoria: ['#3a2c14', '#493819'], celestia: ['#182238', '#1f2c46'],
  };
  return map[continent] || ['#1a1a24', '#22222e'];
}

function drawGround() {
  const [c1, c2] = groundColorFor(GL.continent?.id);
  const groundScreenY = (GL.GROUND_Y - GL.camera.y) * DPR;

  // bầu trời/nền phía trên đường ground — gradient nhẹ theo màu lục địa
  const sky = ctx.createLinearGradient(0, 0, 0, groundScreenY + 40 * DPR);
  sky.addColorStop(0, c1);
  sky.addColorStop(1, c2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, Math.max(0, groundScreenY + 40 * DPR));

  // dải đất phía dưới đường ground
  ctx.fillStyle = c2;
  ctx.fillRect(0, groundScreenY + 30 * DPR, canvas.width, canvas.height);
  // viền/đường chân trời sáng nhẹ đánh dấu mặt đất
  ctx.strokeStyle = 'rgba(245,208,97,.35)'; ctx.lineWidth = 2 * DPR;
  ctx.beginPath(); ctx.moveTo(0, groundScreenY + 30 * DPR); ctx.lineTo(canvas.width, groundScreenY + 30 * DPR); ctx.stroke();

  // chấm trang trí dọc dải đất (thay lưới 2D cũ), trôi theo camera cho có chiều sâu
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  const spacing = 70 * DPR;
  const offX = (-GL.camera.x * DPR) % spacing;
  for (let x = offX - spacing; x < canvas.width + spacing; x += spacing) {
    ctx.beginPath(); ctx.arc(x, groundScreenY + 50 * DPR, 1.6 * DPR, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // biên trái/phải của hành lang (báo hiệu ranh giới map)
  [0, GL.WORLD.w].forEach((edgeX) => {
    const { sx } = worldToScreenPt(edgeX);
    if (sx > -20 && sx < canvas.width + 20) {
      ctx.strokeStyle = 'rgba(245,208,97,.4)'; ctx.lineWidth = 3 * DPR;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); ctx.stroke();
    }
  });
}
function worldToScreenPt(x) { return { sx: (x - GL.camera.x) * DPR }; }

function worldToScreen(x, y) { return { sx: (x - GL.camera.x) * DPR, sy: (y - GL.camera.y) * DPR }; }

function drawHpBar(sx, sy, w, ratio, color) {
  const h = 5 * DPR, ww = w * DPR;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(sx - ww / 2, sy, ww, h);
  ctx.fillStyle = color; ctx.fillRect(sx - ww / 2, sy, ww * Math.max(0, ratio), h);
}

// Vẽ 1 nhân vật dạng vector: đầu tròn + thân + phụ kiện vũ khí theo màu class, có bobbing khi di chuyển
function drawHumanoid(sx, sy, { color, dir, moving, t, scale = 1, attacking, weaponType, shieldy }) {
  const s = scale * DPR;
  const bob = moving ? Math.sin(t * 9) * 3 * s : Math.sin(t * 2.2) * 1 * s;
  ctx.save();
  ctx.translate(sx, sy + bob);
  ctx.scale(dir, 1);
  // bóng
  ctx.beginPath(); ctx.ellipse(0, 20 * s, 14 * s, 5 * s, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
  // chân
  ctx.strokeStyle = '#20202a'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
  const legSwing = moving ? Math.sin(t * 9) * 7 * s : 0;
  ctx.beginPath(); ctx.moveTo(-4 * s, 6 * s); ctx.lineTo(-4 * s + legSwing, 18 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4 * s, 6 * s); ctx.lineTo(4 * s - legSwing, 18 * s); ctx.stroke();
  // thân
  ctx.fillStyle = color;
  roundRect(-9 * s, -10 * s, 18 * s, 20 * s, 6 * s); ctx.fill();
  // vũ khí / phụ kiện
  const armAngle = attacking ? -1.6 : -0.5;
  ctx.strokeStyle = color; ctx.lineWidth = 3.5 * s;
  ctx.save(); ctx.translate(9 * s, -2 * s); ctx.rotate(armAngle);
  if (weaponType === 'sword' || weaponType === 'dagger') {
    ctx.strokeStyle = '#dfe6ee'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -(weaponType === 'sword' ? 22 : 14) * s); ctx.stroke();
  } else if (weaponType === 'staff') {
    ctx.strokeStyle = '#c9a86a'; ctx.beginPath(); ctx.moveTo(0, 6 * s); ctx.lineTo(0, -20 * s); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -22 * s, 3.4 * s, 0, 7); ctx.fillStyle = '#8CE8A0'; ctx.fill();
  } else if (weaponType === 'shield' || shieldy) {
    ctx.fillStyle = '#bcd8ea'; roundRect(-3 * s, -12 * s, 12 * s, 18 * s, 3 * s); ctx.fill();
  } else if (weaponType === 'tome') {
    ctx.fillStyle = '#4FD9B0'; roundRect(-5 * s, -8 * s, 9 * s, 11 * s, 1.5 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(79,217,176,.9)'; ctx.beginPath(); ctx.arc(0, -2 * s, 6 * s, 0, 7); ctx.stroke();
  } else { // fist
    ctx.beginPath(); ctx.arc(0, -10 * s, 4 * s, 0, 7); ctx.fillStyle = color; ctx.fill();
  }
  ctx.restore();
  // đầu
  ctx.beginPath(); ctx.arc(0, -18 * s, 7.5 * s, 0, 7); ctx.fillStyle = '#e8c9a0'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -22 * s, 7.5 * s, 3.4, 6.05); ctx.fillStyle = color; ctx.fill(); // tóc/mũ
  // vệt tấn công
  if (attacking) {
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.arc(14 * s, -4 * s, 16 * s, -1.4, 0.4); ctx.stroke();
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMonster(m, t) {
  if (!m.alive) return;
  const { sx, sy } = worldToScreen(m.x, m.y);
  if (sx < -60 || sy < -60 || sx > canvas.width + 60 || sy > canvas.height + 60) return;
  const shapeColor = m.def.color;
  const scale = (m.isBoss ? 1.7 : 1) * (14 / 14);
  drawHumanoid(sx, sy, { color: shapeColor, dir: m.dir, moving: m.state === 'chase', t, scale: m.isBoss ? 1.6 : 1, weaponType: m.def.shape === 'caster' ? 'staff' : (m.def.shape === 'archer' ? 'dagger' : 'sword') });
  drawHpBar(sx, sy - (m.isBoss ? 52 : 34) * DPR, m.isBoss ? 60 : 34, m.hp / m.maxHp, '#E85C4C');
  ctx.fillStyle = m.isBoss ? '#F5B84C' : '#e8e2d0';
  ctx.font = `${(m.isBoss ? 12 : 10) * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText((m.isBoss ? '★ ' : '') + m.def.nameVN, sx, sy - (m.isBoss ? 60 : 42) * DPR);
}

function drawSummon(s, t) {
  if (!s.alive) return;
  const { sx, sy } = worldToScreen(s.x, s.y);
  drawHumanoid(sx, sy, { color: s.def.color, dir: s.dir, moving: s.state === 'chase', t, attacking: s.state === 'attack', weaponType: s.def.weaponType });
  drawHpBar(sx, sy - 34 * DPR, 30, s.hp / s.maxHp, '#5CE8A0');
  ctx.fillStyle = '#9CFFD0'; ctx.font = `${9 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(s.def.nameVN, sx, sy - 42 * DPR);
}

function drawNpc(npc) {
  const { sx, sy } = worldToScreen(npc.x, npc.y);
  ctx.save(); ctx.translate(sx, sy);
  ctx.beginPath(); ctx.arc(0, 0, 16 * DPR, 0, 7);
  ctx.fillStyle = 'rgba(245,208,97,.16)'; ctx.fill();
  ctx.strokeStyle = '#F5D061'; ctx.lineWidth = 2 * DPR; ctx.stroke();
  ctx.font = `${16 * DPR}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(npc.icon, 0, 1);
  ctx.font = `${10 * DPR}px Inter, sans-serif`; ctx.fillStyle = '#F5D061';
  ctx.fillText(npc.name, 0, -26 * DPR);
  ctx.restore();
}

function drawWorldBossAndGod() {
  if (GL.worldGod) {
    const { sx, sy } = worldToScreen(GL.GOD_SPOT.x, GL.GOD_SPOT.y);
    ctx.save(); ctx.shadowColor = GL.worldGod.color; ctx.shadowBlur = 20 * DPR;
    ctx.beginPath(); ctx.arc(sx, sy, 26 * DPR, 0, 7);
    ctx.fillStyle = GL.worldGod.color; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.font = `${13 * DPR}px serif`; ctx.textAlign = 'center'; ctx.fillText('🙏', sx, sy + 5 * DPR);
    ctx.fillStyle = '#fff'; ctx.font = `${11 * DPR}px Cinzel, serif`;
    ctx.fillText(GL.worldGod.name, sx, sy - 38 * DPR);
    drawHpBar(sx, sy - 30 * DPR, 50, GL.worldGod.hp / GL.worldGod.maxHp, GL.worldGod.color);
  }
  if (GL.worldBoss) {
    const { sx, sy } = worldToScreen(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y);
    ctx.save(); ctx.shadowColor = '#E85C4C'; ctx.shadowBlur = 26 * DPR;
    drawHumanoid(sx, sy, { color: '#8A1F1F', dir: -1, moving: false, t: performance.now() / 1000, scale: 2.1, weaponType: 'sword' });
    ctx.restore();
    ctx.fillStyle = '#F5B84C'; ctx.font = `${13 * DPR}px Cinzel, serif`; ctx.textAlign = 'center';
    ctx.fillText(`👑 BOSS THẾ GIỚI · Dạng ${GL.worldBoss.form}/5`, sx, sy - 74 * DPR);
    drawHpBar(sx, sy - 64 * DPR, 90, GL.worldBoss.hp / GL.worldBoss.maxHp, '#E85C4C');
  }
}

GL.renderFrame = function (t) {
  if (!canvas) return;
  drawGround();
  drawMapProps(GL.map);
  drawWorldBossAndGod();

  if (GL.map?.role === 'hub') GL.NPC_DEFS.forEach(drawNpc);

  Object.values(GL.remote).forEach((r) => {
    const { sx, sy } = worldToScreen(r.x, r.y);
    const cls = GL.classById(r.classId);
    drawHumanoid(sx, sy, { color: cls?.color || '#8888ff', dir: r.dir || 1, moving: r.moving, t, weaponType: cls?.weaponType });
    drawAvatarChip(sx, sy - 48 * DPR, cls, 11);
    ctx.fillStyle = '#cfd6ff'; ctx.font = `${10 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(`${r.name} Lv.${r.level || 1}`, sx, sy - 34 * DPR);
  });

  GL.monsters.forEach((m) => drawMonster(m, t));
  (GL.summons || []).forEach((s) => drawSummon(s, t));

  const p = GL.player, { sx, sy } = worldToScreen(p.x, p.y);
  const cls = GL.classById(GL.char.classId);
  drawHumanoid(sx, sy, { color: cls.color, dir: p.dir, moving: p.moving, t, attacking: p.attackFx > 0, weaponType: cls.weaponType });
  drawAvatarChip(sx, sy - 48 * DPR, cls, 12);
  ctx.fillStyle = '#fff'; ctx.font = `${10 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(GL.char.name, sx, sy - 34 * DPR);

  // fx sát thương nổi
  GL.fx = GL.fx.filter((f) => f.t < f.life);
  GL.fx.forEach((f) => {
    f.t += 1 / 60;
    const { sx, sy } = worldToScreen(f.x, f.y - f.t * 30);
    ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
    ctx.fillStyle = f.cls === 'gl-crit' ? '#ff5c5c' : '#fff3b0';
    ctx.font = `${(f.cls === 'gl-crit' ? 15 : 12) * DPR}px Cinzel, serif`; ctx.textAlign = 'center';
    ctx.fillText(f.text, sx, sy);
    ctx.globalAlpha = 1;
  });
};
