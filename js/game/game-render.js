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

// ---------- Avatar tròn (ảnh PORTRAIT thật, đè lên trên thân vector) ----------
const portraitImgCache = {};
function getPortraitImg(url) {
  if (!url) return null;
  let img = portraitImgCache[url];
  if (!img) {
    img = new Image();
    img.src = url;
    portraitImgCache[url] = img;
  }
  return img;
}
function getClassPortrait(cls) { return cls ? getPortraitImg(cls.portrait) : null; }

// Vẽ avatar tròn (ảnh thật) tại (sx,sy) với viền màu — dùng clip hình tròn nên
// không cần ảnh nền trong suốt, ảnh vuông/chữ nhật nào cũng crop gọn vào khung tròn.
function drawAvatarChip(sx, sy, imgUrlOrCls, radiusPx, ringColor) {
  const cls = (imgUrlOrCls && typeof imgUrlOrCls === 'object') ? imgUrlOrCls : null;
  const url = cls ? cls.portrait : imgUrlOrCls;
  const ring = ringColor || (cls && cls.color) || '#F5D061';
  if (!url) return false;
  const img = getPortraitImg(url);
  if (!img || !img.complete || !img.naturalWidth) return false; // chưa tải xong: để caller tự vẽ fallback (icon/emoji)
  const r = radiusPx * DPR;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  // crop trung tâm ảnh theo hình vuông trước khi vẽ tròn, tránh méo tỉ lệ
  const iw = img.naturalWidth, ih = img.naturalHeight, side = Math.min(iw, ih);
  const sx0 = (iw - side) / 2, sy0 = (ih - side) / 2;
  ctx.drawImage(img, sx0, sy0, side, side, sx - r, sy - r, r * 2, r * 2);
  ctx.restore();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.strokeStyle = ring; ctx.lineWidth = 1.6 * DPR; ctx.stroke();
  return true;
}

// Vẽ NHÂN VẬT/QUÁI bằng ẢNH THẬT làm thân chính (không phải avatar tròn nhỏ nữa) — trả về
// false nếu ảnh chưa sẵn sàng để nơi gọi tự vẽ vector dự phòng (drawHumanoid).
function drawSprite(sx, sy, imgUrl, opts) {
  const { dir = 1, moving = false, t = 0, heightPx = 74, isBoss = false } = opts || {};
  if (!imgUrl) return false;
  const img = getPortraitImg(imgUrl);
  if (!img || !img.complete || !img.naturalWidth) return false;

  const iw = img.naturalWidth, ih = img.naturalHeight, side = Math.min(iw, ih);
  const sx0 = (iw - side) / 2, sy0 = (ih - side) / 2;
  const h = heightPx * DPR * (isBoss ? 1.55 : 1);
  const w = h;
  const bob = (moving ? Math.sin(t * 9) * 2.6 : Math.sin(t * 2.2) * 1.1) * DPR;
  const drawY = sy - h + 8 * DPR - bob;

  ctx.beginPath();
  ctx.ellipse(sx, sy + 3 * DPR, w * 0.3, 4.5 * DPR, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.fill();

  ctx.save();
  ctx.translate(sx, 0);
  ctx.scale(dir < 0 ? -1 : 1, 1);
  roundRect(-w / 2, drawY, w, h, 12 * DPR);
  ctx.save();
  ctx.clip();
  ctx.drawImage(img, sx0, sy0, side, side, -w / 2, drawY, w, h);
  ctx.restore();
  ctx.lineWidth = 1.4 * DPR;
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.stroke();
  ctx.restore();
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

// ---------- Ảnh nền thật theo từng map (Map/lục địa/N.jpg) — parallax nhẹ khi cuộn ngang ----------
const mapBgCache = {};
function getMapBgImg(continentId, index) {
  const key = `${continentId}_${index}`;
  let img = mapBgCache[key];
  if (!img) {
    img = new Image();
    img.src = `/assets/game/mapbg/${continentId}/${index}.jpg`;
    mapBgCache[key] = img;
  }
  return img;
}

function drawGround() {
  const [c1, c2] = groundColorFor(GL.continent?.id);
  const groundScreenY = (GL.GROUND_Y - GL.camera.y) * DPR;

  // bầu trời/nền phía trên đường ground — gradient nhẹ theo màu lục địa (fallback khi chưa có/chưa tải ảnh)
  const sky = ctx.createLinearGradient(0, 0, 0, groundScreenY + 40 * DPR);
  sky.addColorStop(0, c1);
  sky.addColorStop(1, c2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bg = GL.map ? getMapBgImg(GL.map.continentId, GL.map.index) : null;
  if (bg && bg.complete && bg.naturalWidth) {
    // scale ảnh phủ kín chiều cao canvas + dư ra 2 bên để có biên độ trôi (parallax), không cần lặp ảnh
    const scale = Math.max((canvas.height / bg.naturalHeight) * 1.5, (canvas.width * 2.4) / bg.naturalWidth);
    const dw = bg.naturalWidth * scale, dh = bg.naturalHeight * scale;
    const parallax = 0.1; // nền trôi chậm hơn nhiều so với camera thật, tạo chiều sâu
    const maxOffset = Math.max(0, dw - canvas.width);
    const rawX = -GL.camera.x * DPR * parallax;
    const clampedDx = maxOffset ? (((rawX % maxOffset) + maxOffset) % maxOffset) - maxOffset / 2 : 0;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(bg, canvas.width / 2 - dw / 2 + clampedDx, groundScreenY * 0.55 - dh * 0.5, dw, dh);
    ctx.globalAlpha = 1;
    // lớp phủ mờ để chữ/nhân vật/HP bar phía trên vẫn rõ, không bị ảnh nền chọi màu
    ctx.fillStyle = 'rgba(10,8,16,.28)';
    ctx.fillRect(0, 0, canvas.width, Math.max(0, groundScreenY + 40 * DPR));
  }

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
  const spriteUrl = `/assets/game/${m.isBoss ? 'bosses' : 'monsters'}/${m.defId}.png`;
  const gotSprite = drawSprite(sx, sy, spriteUrl, { dir: m.dir, moving: m.state === 'chase', t, heightPx: m.isBoss ? 70 : 52, isBoss: m.isBoss });
  if (!gotSprite) {
    drawHumanoid(sx, sy, { color: shapeColor, dir: m.dir, moving: m.state === 'chase', t, scale: m.isBoss ? 1.6 : 1, weaponType: m.def.shape === 'caster' ? 'staff' : (m.def.shape === 'archer' ? 'dagger' : 'sword') });
  }
  const topOff = gotSprite ? (m.isBoss ? 108 : 76) : (m.isBoss ? 78 : 52);
  drawHpBar(sx, sy - topOff * DPR, m.isBoss ? 60 : 34, m.hp / m.maxHp, '#E85C4C');
  ctx.fillStyle = m.isBoss ? '#F5B84C' : '#e8e2d0';
  ctx.font = `${(m.isBoss ? 12 : 10) * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText((m.isBoss ? '★ ' : '') + m.def.nameVN, sx, sy - (topOff - 18) * DPR);
}

function drawSummon(s, t) {
  if (!s.alive) return;
  const { sx, sy } = worldToScreen(s.x, s.y);
  const gotSprite = drawSprite(sx, sy, s.def.portrait, { dir: s.dir, moving: s.state === 'chase', t, heightPx: 60 });
  if (!gotSprite) drawHumanoid(sx, sy, { color: s.def.color, dir: s.dir, moving: s.state === 'chase', t, attacking: s.state === 'attack', weaponType: s.def.weaponType });
  drawHpBar(sx, sy - (gotSprite ? 78 : 34) * DPR, 30, s.hp / s.maxHp, '#5CE8A0');
  ctx.fillStyle = '#9CFFD0'; ctx.font = `${9 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(s.def.nameVN, sx, sy - (gotSprite ? 86 : 42) * DPR);
}

function drawNpc(npc) {
  const { sx, sy } = worldToScreen(npc.x, npc.y);
  const gotSprite = drawSprite(sx, sy, `/assets/game/npc/${GL.map?.continentId || 'aurelion'}/${npc.id}.png`, { dir: 1, moving: false, t: performance.now() / 1000, heightPx: 58 });
  if (!gotSprite) {
    ctx.save(); ctx.translate(sx, sy);
    ctx.beginPath(); ctx.arc(0, 0, 16 * DPR, 0, 7);
    ctx.fillStyle = 'rgba(245,208,97,.16)'; ctx.fill();
    ctx.strokeStyle = '#F5D061'; ctx.lineWidth = 2 * DPR; ctx.stroke();
    ctx.font = `${16 * DPR}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(npc.icon, 0, 1);
    ctx.restore();
  }
  ctx.font = `${10 * DPR}px Inter, sans-serif`; ctx.fillStyle = '#F5D061'; ctx.textAlign = 'center';
  ctx.fillText(npc.name, sx, sy - (gotSprite ? 66 : 26) * DPR);
}

function drawWorldBossAndGod() {
  if (GL.worldGod) {
    const { sx, sy } = worldToScreen(GL.GOD_SPOT.x, GL.GOD_SPOT.y);
    ctx.save(); ctx.shadowColor = GL.worldGod.color; ctx.shadowBlur = 20 * DPR;
    ctx.beginPath(); ctx.arc(sx, sy, 26 * DPR, 0, 7);
    ctx.fillStyle = GL.worldGod.color; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
    const gotArt = drawSprite(sx, sy, `/assets/game/gods/${GL.worldGod.continentId || GL.map?.continentId}.png`, { dir: 1, moving: false, t: performance.now() / 1000, heightPx: 78 });
    if (!gotArt) { ctx.font = `${13 * DPR}px serif`; ctx.textAlign = 'center'; ctx.fillText('🙏', sx, sy + 5 * DPR); }
    ctx.fillStyle = '#fff'; ctx.font = `${11 * DPR}px Cinzel, serif`; ctx.textAlign = 'center';
    ctx.fillText(GL.worldGod.name, sx, sy - (gotArt ? 92 : 38) * DPR);
    drawHpBar(sx, sy - (gotArt ? 84 : 30) * DPR, 50, GL.worldGod.hp / GL.worldGod.maxHp, GL.worldGod.color);
  }
  if (GL.worldBoss) {
    const { sx, sy } = worldToScreen(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y);
    // Boss Thế Giới = Chaoseraph (Thần Hỗn Mang), đổi tạo hình theo Dạng 1-5 khi càng mất máu càng biến hình mạnh hơn
    const chaosArt = `chaoseraph_${GL.worldBoss.form}`;
    ctx.save(); ctx.shadowColor = '#E85C4C'; ctx.shadowBlur = 26 * DPR;
    const gotBoss = drawSprite(sx, sy, `/assets/game/bosses/${chaosArt}.png`, { dir: -1, moving: true, t: performance.now() / 1000, heightPx: 92, isBoss: true });
    if (!gotBoss) drawHumanoid(sx, sy, { color: '#8A1F1F', dir: -1, moving: false, t: performance.now() / 1000, scale: 2.1, weaponType: 'sword' });
    ctx.restore();
    ctx.fillStyle = '#F5B84C'; ctx.font = `${13 * DPR}px Cinzel, serif`; ctx.textAlign = 'center';
    ctx.fillText(`👑 CHAOSERAPH · Dạng ${GL.worldBoss.form}/5`, sx, sy - (gotBoss ? 158 : 74) * DPR);
    drawHpBar(sx, sy - (gotBoss ? 148 : 64) * DPR, 90, GL.worldBoss.hp / GL.worldBoss.maxHp, '#E85C4C');
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
    const gotSprite = drawSprite(sx, sy, cls?.portrait, { dir: r.dir || 1, moving: r.moving, t });
    if (!gotSprite) drawHumanoid(sx, sy, { color: cls?.color || '#8888ff', dir: r.dir || 1, moving: r.moving, t, weaponType: cls?.weaponType });
    ctx.fillStyle = '#cfd6ff'; ctx.font = `${10 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(`${r.name} Lv.${r.level || 1}`, sx, sy - (gotSprite ? 80 : 34) * DPR);
  });

  GL.monsters.forEach((m) => drawMonster(m, t));
  (GL.summons || []).forEach((s) => drawSummon(s, t));

  const p = GL.player, { sx, sy } = worldToScreen(p.x, p.y);
  const cls = GL.classById(GL.char.classId);
  const gotSprite = drawSprite(sx, sy, cls.portrait, { dir: p.dir, moving: p.moving, t, heightPx: 80 });
  if (!gotSprite) drawHumanoid(sx, sy, { color: cls.color, dir: p.dir, moving: p.moving, t, attacking: p.attackFx > 0, weaponType: cls.weaponType });
  ctx.fillStyle = '#fff'; ctx.font = `${10 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(GL.char.name, sx, sy - (gotSprite ? 88 : 34) * DPR);

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
