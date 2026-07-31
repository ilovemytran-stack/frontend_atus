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

// Khác drawSprite (luôn crop vuông từ giữa, hợp với portrait 512x512): pet dùng ảnh đã cắt sát viền
// trong suốt với tỉ lệ khung hình khác nhau tuỳ frame, nên giữ NGUYÊN tỉ lệ gốc thay vì crop vuông.
function drawPetFrame(sx, sy, imgUrl, opts) {
  const { dir = 1, heightPx = 46, alpha = 1 } = opts || {};
  if (!imgUrl) return false;
  const img = getPortraitImg(imgUrl);
  if (!img || !img.complete || !img.naturalWidth) return false;
  const h = heightPx * DPR;
  const w = h * (img.naturalWidth / img.naturalHeight);
  const drawY = sy - h + 6 * DPR;

  ctx.beginPath();
  ctx.ellipse(sx, sy + 2 * DPR, w * 0.32, 4 * DPR, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(sx, 0);
  ctx.scale(dir < 0 ? -1 : 1, 1);
  ctx.drawImage(img, -w / 2, drawY, w, h);
  ctx.restore();
  ctx.globalAlpha = 1;
  return true;
}

// ============================================================================
// Engine animation nhiều-frame thật (thay cho "1 ảnh tĩnh + bob") — đọc từ GL.data.spriteManifest
// (server trả về từ backend/data/spriteManifest.json, sinh ra bằng cách phân tích GLG). Mỗi entity có
// tối đa 7 "clip": idle, walk, combat1..4, death — xem build_sprite_engine_assets.py để biết quy ước
// suy ra tên clip từ thứ tự row (đã kiểm chứng bằng phân tích chiều cao bbox qua nhiều nhân vật/quái/thần).
// ============================================================================
GL.SPRITE_FPS = 9;

function spriteManifestFor(category, entityId) {
  return GL.data.spriteManifest?.[category]?.[entityId] || null;
}

function pickClip(manifest, wanted) {
  if (manifest[wanted]) return wanted;
  if (wanted.startsWith('combat')) return manifest.combat1 ? 'combat1' : (manifest.idle ? 'idle' : Object.keys(manifest)[0]);
  return manifest.idle ? 'idle' : Object.keys(manifest)[0];
}

// holder = entity bất kỳ (player/monster/npc/worldGod/worldBoss) — tự gắn .anim vào entity đó (lazy init).
// idle/walk LẶP vòng; combat/death chỉ chạy 1 lần rồi giữ nguyên frame cuối chờ đổi clip (death: giữ mãi).
function stepAnim(holder, manifest, wantedClip, dt) {
  if (!holder.anim) holder.anim = { clip: 'idle', frame: 1, timer: 0, playedOnce: false };
  const a = holder.anim;
  const resolved = pickClip(manifest, wantedClip);
  const looping = resolved === 'idle' || resolved === 'walk';
  if (a.clip !== resolved && (looping || a.playedOnce || resolved === 'death')) {
    a.clip = resolved; a.frame = 1; a.timer = 0; a.playedOnce = false;
  }
  const total = manifest[a.clip] || 1;
  if (a.clip === 'death' && a.frame >= total) return a; // đứng khựng ở frame cuối cùng mãi mãi
  a.timer += dt || 0.016;
  const frameDur = 1 / GL.SPRITE_FPS;
  while (a.timer >= frameDur) {
    a.timer -= frameDur;
    a.frame += 1;
    if (a.frame > total) {
      if (looping) a.frame = 1;
      else { a.playedOnce = true; a.frame = total; }
    }
  }
  return a;
}

// Vẽ entity bằng animation thật nếu có manifest cho entityId này; trả về false nếu KHÔNG có để nơi gọi
// tự fallback (ảnh tĩnh cũ / hình vector) — không phá vỡ các entity chưa có sprite (an toàn khi thiếu asset).
function drawAnimated(sx, sy, category, entityId, wantedClip, holder, dt, opts) {
  if (!entityId) return false;
  const manifest = spriteManifestFor(category, entityId);
  if (!manifest) return false;
  const a = stepAnim(holder, manifest, wantedClip, dt);
  return drawPetFrame(sx, sy, `/assets/game/sprites/${category}/${entityId}/${a.clip}/${a.frame}.png`, opts);
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

function drawMonster(m, t, dt) {
  if (!m.alive) return;
  const { sx, sy } = worldToScreen(m.x, m.y);
  if (sx < -60 || sy < -60 || sx > canvas.width + 60 || sy > canvas.height + 60) return;
  const shapeColor = m.def.color;
  const category = m.isBoss ? 'bosses' : 'monsters';
  const wantedClip = m.state === 'chase' ? 'walk' : (m.state === 'attack' ? 'combat1' : 'idle');
  const heightPx = m.isBoss ? 76 : 54;
  let gotSprite = drawAnimated(sx, sy, category, m.defId, wantedClip, m, dt, { dir: m.dir, heightPx });
  if (!gotSprite) {
    const spriteUrl = `/assets/game/${category}/${m.defId}.png`;
    gotSprite = drawSprite(sx, sy, spriteUrl, { dir: m.dir, moving: m.state === 'chase', t, heightPx: m.isBoss ? 70 : 52, isBoss: m.isBoss });
  }
  if (!gotSprite) {
    drawHumanoid(sx, sy, { color: shapeColor, dir: m.dir, moving: m.state === 'chase', t, scale: m.isBoss ? 1.6 : 1, weaponType: m.def.shape === 'caster' ? 'staff' : (m.def.shape === 'archer' ? 'dagger' : 'sword') });
  }
  const topOff = gotSprite ? (m.isBoss ? 108 : 76) : (m.isBoss ? 78 : 52);
  drawHpBar(sx, sy - topOff * DPR, m.isBoss ? 60 : 34, m.hp / m.maxHp, '#E85C4C');
  ctx.fillStyle = m.isBoss ? '#F5B84C' : '#e8e2d0';
  ctx.font = `${(m.isBoss ? 12 : 10) * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  const nameY = sy - (topOff - 18) * DPR;
  if (m.isBoss) {
    const textW = ctx.measureText(m.def.nameVN).width;
    const starGap = 14 * DPR;
    ctx.save(); ctx.translate(sx - textW / 2 - starGap / 2, nameY - 3 * DPR); drawVectorGlyph('star', 9 * DPR, '#F5B84C'); ctx.restore();
    ctx.textAlign = 'left'; ctx.fillText(m.def.nameVN, sx - textW / 2 + starGap / 2, nameY); ctx.textAlign = 'center';
  } else {
    ctx.fillText(m.def.nameVN, sx, nameY);
  }
}

function drawSummon(s, t, dt) {
  if (!s.alive) return;
  const { sx, sy } = worldToScreen(s.x, s.y);
  const wantedClip = s.state === 'chase' ? 'walk' : (s.state === 'attack' ? 'combat1' : 'idle');
  let gotSprite = drawAnimated(sx, sy, 'summons', s.def.id, wantedClip, s, dt, { dir: s.dir, heightPx: 62 });
  if (!gotSprite) gotSprite = drawSprite(sx, sy, s.def.portrait, { dir: s.dir, moving: s.state === 'chase', t, heightPx: 60 });
  if (!gotSprite) drawHumanoid(sx, sy, { color: s.def.color, dir: s.dir, moving: s.state === 'chase', t, attacking: s.state === 'attack', weaponType: s.def.weaponType });
  drawHpBar(sx, sy - (gotSprite ? 78 : 34) * DPR, 30, s.hp / s.maxHp, '#5CE8A0');
  ctx.fillStyle = '#9CFFD0'; ctx.font = `${9 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(s.def.nameVN, sx, sy - (gotSprite ? 86 : 42) * DPR);
}

const PET_MODE_LABEL = { def: 'Thủ', atk: 'Công', fl: 'Theo' };
const PET_MODE_COLOR = { def: '#5CA8E8', atk: '#E85C5C', fl: '#9CFF9C' };

// Pet: cycle qua các frame (1..frameCount) tạo cảm giác sống động thay vì đứng yên hoàn toàn, hiện
// Die.png mờ dần khi đang chờ hồi sinh, có nhãn chế độ (Thủ/Công/Theo) nhỏ phía trên đầu.
function drawPet(pet, t) {
  const { sx, sy } = worldToScreen(pet.x, pet.y);
  if (sx < -60 || sy < -60 || sx > canvas.width + 60 || sy > canvas.height + 60) return;
  let gotSprite;
  if (pet.isDead) {
    gotSprite = drawPetFrame(sx, sy, pet.defObj?.diePortrait, { dir: pet.dir, heightPx: 40, alpha: 0.55 });
    const secsLeft = Math.max(0, Math.round((pet.deadUntil - performance.now()) / 1000));
    ctx.fillStyle = '#ff8a8a'; ctx.font = `${9 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(`Hồi sinh ${secsLeft}s`, sx, sy - (gotSprite ? 54 : 30) * DPR);
    return;
  }
  const frameCount = pet.defObj?.frameCount || 26;
  const frameIdx = 1 + Math.floor(pet.frameT * 7) % frameCount;
  gotSprite = drawPetFrame(sx, sy, `/assets/game/pets/${pet.defId}/${frameIdx}.png`, { dir: pet.dir, heightPx: 46 });
  if (!gotSprite) drawHumanoid(sx, sy, { color: pet.defObj?.tier === 'vip' ? '#F5B84C' : '#8FCFE8', dir: pet.dir, moving: pet.state === 'chase', t, scale: 0.7, attacking: pet.state === 'attack' });
  const topOff = (gotSprite ? 62 : 30) * DPR;
  drawHpBar(sx, sy - topOff, 26, pet.hp / pet.maxHp, pet.defObj?.tier === 'vip' ? '#F5B84C' : '#5CA8E8');
  ctx.fillStyle = PET_MODE_COLOR[pet.mode] || '#cfd6ff'; ctx.font = `${8.5 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(`${pet.defObj?.name || 'Pet'} · ${PET_MODE_LABEL[pet.mode] || ''}`, sx, sy - topOff - 8 * DPR);
}

// Tiểu Quái đồng hành (Chiêu 4 của pet) — bay quanh pet chủ, chỉ mang tính hình ảnh (không có hộp va chạm riêng)
function drawPetMiniMonster(pet, t) {
  const orbit = 20 * DPR;
  const { sx, sy } = worldToScreen(pet.x, pet.y);
  const ox = sx + Math.cos(t * 3 + pet.slot * 2) * orbit;
  const oy = sy - 34 * DPR + Math.sin(t * 3 + pet.slot * 2) * (orbit * 0.5);
  const frame = 1 + Math.floor(t * 6) % 3;
  drawPetFrame(ox, oy, `/assets/game/pet-skills/skill4/mini_monster/${frame}.png`, { dir: 1, heightPx: 20 });
}

// Hào Quang (Aura): vòng hào quang xoay quanh nhân vật đang sở hữu — cycle 12 frame liên tục
function drawAuraGlow(sx, sy, t) {
  const frame = 1 + Math.floor(t * 10) % 12;
  const img = getPortraitImg(`/assets/game/aura/${frame}.png`);
  if (!img || !img.complete || !img.naturalWidth) return;
  const h = 92 * DPR, w = h * (img.naturalWidth / img.naturalHeight);
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.drawImage(img, sx - w / 2, sy - h * 0.62, w, h);
  ctx.restore();
}

// Vẽ icon vector đơn giản lên canvas (thay glyph emoji) — canvas fillText() không thể render
// <svg><use>, nên các icon dùng trong world (NPC fallback, sao boss, vương miện, phước lành) được
// vẽ lại bằng path canvas, cùng tinh thần với bộ SVG line-icon dùng ở phần UI/HTML của trang.
function drawVectorGlyph(key, size, color) {
  const s = size; ctx.save();
  ctx.strokeStyle = color || '#F5D061'; ctx.fillStyle = color || '#F5D061';
  ctx.lineWidth = Math.max(1, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (key === 'scroll') {
    ctx.strokeRect(-s * 0.32, -s * 0.42, s * 0.64, s * 0.84);
    ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.16); ctx.lineTo(s * 0.18, -s * 0.16);
    ctx.moveTo(-s * 0.18, s * 0.08); ctx.lineTo(s * 0.05, s * 0.08); ctx.stroke();
  } else if (key === 'portal') {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.2, s * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (key === 'flask') {
    ctx.beginPath(); ctx.moveTo(-s * 0.14, -s * 0.4); ctx.lineTo(s * 0.14, -s * 0.4);
    ctx.moveTo(-s * 0.1, -s * 0.4); ctx.lineTo(-s * 0.1, -s * 0.05); ctx.lineTo(-s * 0.32, s * 0.32);
    ctx.arc(0, s * 0.32, s * 0.32, Math.PI, 0); ctx.lineTo(s * 0.1, -s * 0.05); ctx.lineTo(s * 0.1, -s * 0.4); ctx.stroke();
  } else if (key === 'sword') {
    ctx.beginPath(); ctx.moveTo(-s * 0.32, s * 0.4); ctx.lineTo(s * 0.32, -s * 0.4);
    ctx.moveTo(-s * 0.32, s * 0.02); ctx.lineTo(-s * 0.02, s * 0.32); ctx.stroke();
  } else if (key === 'shield') {
    ctx.beginPath(); ctx.moveTo(0, -s * 0.42); ctx.lineTo(s * 0.36, -s * 0.24); ctx.lineTo(s * 0.36, s * 0.06);
    ctx.quadraticCurveTo(s * 0.36, s * 0.36, 0, s * 0.46);
    ctx.quadraticCurveTo(-s * 0.36, s * 0.36, -s * 0.36, s * 0.06); ctx.lineTo(-s * 0.36, -s * 0.24); ctx.closePath(); ctx.stroke();
  } else if (key === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (-Math.PI / 2) + i * (2 * Math.PI / 5);
      const a2 = a + Math.PI / 5;
      const x1 = Math.cos(a) * s * 0.44, y1 = Math.sin(a) * s * 0.44;
      const x2 = Math.cos(a2) * s * 0.18, y2 = Math.sin(a2) * s * 0.18;
      if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath(); ctx.fill();
  } else if (key === 'crown') {
    ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.28); ctx.lineTo(-s * 0.28, -s * 0.14); ctx.lineTo(-s * 0.1, s * 0.02);
    ctx.lineTo(0, -s * 0.32); ctx.lineTo(s * 0.1, s * 0.02); ctx.lineTo(s * 0.28, -s * 0.14); ctx.lineTo(s * 0.4, s * 0.28);
    ctx.closePath(); ctx.fill();
  } else if (key === 'hands') {
    ctx.beginPath(); ctx.moveTo(0, -s * 0.4); ctx.lineTo(0, s * 0.4);
    ctx.moveTo(0, s * 0.06); ctx.quadraticCurveTo(-s * 0.3, s * 0.28, -s * 0.42, -s * 0.02);
    ctx.moveTo(0, s * 0.06); ctx.quadraticCurveTo(s * 0.3, s * 0.28, s * 0.42, -s * 0.02); ctx.stroke();
  }
  ctx.restore();
}

function drawNpc(npc, dt) {
  const { sx, sy } = worldToScreen(npc.x, npc.y);
  const entityId = `${GL.map?.continentId || 'aurelion'}_${npc.id}`;
  let gotSprite = drawAnimated(sx, sy, 'npc', entityId, 'idle', npc, dt, { dir: 1, heightPx: 58 });
  if (!gotSprite) gotSprite = drawSprite(sx, sy, `/assets/game/npc/${GL.map?.continentId || 'aurelion'}/${npc.id}.png`, { dir: 1, moving: false, t: performance.now() / 1000, heightPx: 58 });
  if (!gotSprite) {
    ctx.save(); ctx.translate(sx, sy);
    ctx.beginPath(); ctx.arc(0, 0, 16 * DPR, 0, 7);
    ctx.fillStyle = 'rgba(245,208,97,.16)'; ctx.fill();
    ctx.strokeStyle = '#F5D061'; ctx.lineWidth = 2 * DPR; ctx.stroke();
    drawVectorGlyph(npc.icon, 15 * DPR, '#F5D061');
    ctx.restore();
  }
  ctx.font = `${10 * DPR}px Inter, sans-serif`; ctx.fillStyle = '#F5D061'; ctx.textAlign = 'center';
  ctx.fillText(npc.name, sx, sy - (gotSprite ? 66 : 26) * DPR);
}

function drawWorldBossAndGod(dt) {
  if (GL.worldGod) {
    const { sx, sy } = worldToScreen(GL.GOD_SPOT.x, GL.GOD_SPOT.y);
    ctx.save(); ctx.shadowColor = GL.worldGod.color; ctx.shadowBlur = 20 * DPR;
    ctx.beginPath(); ctx.arc(sx, sy, 26 * DPR, 0, 7);
    ctx.fillStyle = GL.worldGod.color; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
    const godContId = GL.worldGod.continentId || GL.map?.continentId;
    let gotArt = drawAnimated(sx, sy, 'gods', godContId, 'idle', GL.worldGod, dt, { dir: 1, heightPx: 82 });
    if (!gotArt) gotArt = drawSprite(sx, sy, `/assets/game/gods/${godContId}.png`, { dir: 1, moving: false, t: performance.now() / 1000, heightPx: 78 });
    if (!gotArt) { ctx.save(); ctx.translate(sx, sy + 5 * DPR); drawVectorGlyph('hands', 22 * DPR, GL.worldGod.color || '#fff'); ctx.restore(); }
    ctx.fillStyle = '#fff'; ctx.font = `${11 * DPR}px Cinzel, serif`; ctx.textAlign = 'center';
    ctx.fillText(GL.worldGod.name, sx, sy - (gotArt ? 92 : 38) * DPR);
    drawHpBar(sx, sy - (gotArt ? 84 : 30) * DPR, 50, GL.worldGod.hp / GL.worldGod.maxHp, GL.worldGod.color);
  }
  if (GL.worldBoss) {
    const { sx, sy } = worldToScreen(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y);
    // Boss Thế Giới = Chaoseraph/ChaosLord (Thần Hỗn Mang), đổi tạo hình theo Dạng 1-5 khi càng mất máu càng biến hình mạnh hơn
    const chaosEntityId = `b_chaoseraph_form${GL.worldBoss.form}`;
    ctx.save(); ctx.shadowColor = '#E85C4C'; ctx.shadowBlur = 26 * DPR;
    let gotBoss = drawAnimated(sx, sy, 'bosses', chaosEntityId, 'idle', GL.worldBoss, dt, { dir: -1, heightPx: 96 });
    if (!gotBoss) gotBoss = drawSprite(sx, sy, `/assets/game/bosses/chaoseraph_${GL.worldBoss.form}.png`, { dir: -1, moving: true, t: performance.now() / 1000, heightPx: 92, isBoss: true });
    if (!gotBoss) drawHumanoid(sx, sy, { color: '#8A1F1F', dir: -1, moving: false, t: performance.now() / 1000, scale: 2.1, weaponType: 'sword' });
    ctx.restore();
    ctx.fillStyle = '#F5B84C'; ctx.font = `${13 * DPR}px Cinzel, serif`; ctx.textAlign = 'center';
    { const label = `CHAOSERAPH · Dạng ${GL.worldBoss.form}/5`;
      const textW = ctx.measureText(label).width; const gap = 16 * DPR;
      const nameY = sy - (gotBoss ? 158 : 74) * DPR;
      ctx.save(); ctx.translate(sx - textW / 2 - gap / 2, nameY - 4 * DPR); drawVectorGlyph('crown', 13 * DPR, '#F5B84C'); ctx.restore();
      ctx.textAlign = 'left'; ctx.fillText(label, sx - textW / 2 + gap / 2, nameY); ctx.textAlign = 'center'; }
    drawHpBar(sx, sy - (gotBoss ? 148 : 64) * DPR, 90, GL.worldBoss.hp / GL.worldBoss.maxHp, '#E85C4C');
  }
}

// Bong bóng chat trên đầu nhân vật: tự mất sau GL.CHAT_BUBBLE_MS (5s, xem game-ui.js).
// nameY = toạ độ Y (canvas, đã *DPR) của dòng tên đang vẽ — bong bóng nằm ngay phía trên đó.
function drawChatBubble(entity, sx, nameY) {
  const bub = entity?.chatBubble;
  if (!bub) return;
  if (performance.now() > bub.until) { entity.chatBubble = null; return; }
  let text = bub.text;
  if (text.length > 42) text = text.slice(0, 41) + '…'; // giới hạn độ dài hiển thị trong bong bóng
  ctx.font = `${11 * DPR}px Inter, sans-serif`;
  const padX = 9 * DPR, padY = 6 * DPR;
  const w = Math.min(ctx.measureText(text).width + padX * 2, 220 * DPR);
  const h = 15 * DPR + padY * 2;
  const bx = sx - w / 2, by = nameY - h - 8 * DPR;
  const r = 8 * DPR;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + w, by, bx + w, by + h, r);
  ctx.arcTo(bx + w, by + h, bx, by + h, r);
  ctx.arcTo(bx, by + h, bx, by, r);
  ctx.arcTo(bx, by, bx + w, by, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(18,16,28,.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1 * DPR; ctx.stroke();
  // đuôi bong bóng chỉ xuống đầu nhân vật
  ctx.beginPath();
  ctx.moveTo(sx - 5 * DPR, by + h);
  ctx.lineTo(sx + 5 * DPR, by + h);
  ctx.lineTo(sx, by + h + 6 * DPR);
  ctx.closePath();
  ctx.fillStyle = 'rgba(18,16,28,.88)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, sx, by + h / 2 + 1 * DPR);
  ctx.textBaseline = 'alphabetic';
}

GL.renderFrame = function (t, dt) {
  if (!canvas) return;
  drawGround();
  drawMapProps(GL.map);
  drawWorldBossAndGod(dt);

  if (GL.map?.role === 'hub') GL.NPC_DEFS.forEach((npc) => drawNpc(npc, dt));

  Object.values(GL.remote).forEach((r) => {
    const { sx, sy } = worldToScreen(r.x, r.y);
    const cls = GL.classById(r.classId);
    let gotSprite = drawAnimated(sx, sy, 'characters', cls?.id, r.moving ? 'walk' : 'idle', r, dt, { dir: r.dir || 1, heightPx: 80 });
    if (!gotSprite) gotSprite = drawSprite(sx, sy, cls?.portrait, { dir: r.dir || 1, moving: r.moving, t });
    if (!gotSprite) drawHumanoid(sx, sy, { color: cls?.color || '#8888ff', dir: r.dir || 1, moving: r.moving, t, weaponType: cls?.weaponType });
    const nameY = sy - (gotSprite ? 80 : 34) * DPR;
    ctx.fillStyle = '#cfd6ff'; ctx.font = `${10 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(`${r.name} Lv.${r.level || 1}`, sx, nameY);
    drawChatBubble(r, sx, nameY);
  });

  GL.monsters.forEach((m) => drawMonster(m, t, dt));
  GL.deathFx = (GL.deathFx || []).filter((fx) => performance.now() < fx.until);
  GL.deathFx.forEach((fx) => {
    const { sx, sy } = worldToScreen(fx.x, fx.y);
    drawAnimated(sx, sy, fx.category, fx.defId, 'death', fx, dt, { dir: fx.dir, heightPx: fx.isBoss ? 76 : 54 });
  });
  (GL.summons || []).forEach((s) => drawSummon(s, t, dt));
  (GL.pets || []).forEach((pet) => drawPet(pet, t));
  (GL.petMiniMonsters || []).forEach((pet) => drawPetMiniMonster(pet, t));

  const p = GL.player, { sx, sy } = worldToScreen(p.x, p.y);
  const zOff = (p.z || 0) * DPR; // nhảy/bay: CHỈ dịch lên khi vẽ, không đổi toạ độ logic (xem game-controls.js updateJumpFly)
  const syDraw = sy - zOff;
  const cls = GL.classById(GL.char.classId);
  if (GL.char.stats?.hasAura) drawAuraGlow(sx, syDraw, t);
  const wantedClip = performance.now() < (p.actionUntil || 0) ? p.actionClip : (p.moving ? 'walk' : 'idle');
  let gotSprite = drawAnimated(sx, syDraw, 'characters', cls.id, wantedClip, p, dt, { dir: p.dir, heightPx: 80 });
  if (!gotSprite) gotSprite = drawSprite(sx, syDraw, cls.portrait, { dir: p.dir, moving: p.moving, t, heightPx: 80 });
  if (!gotSprite) drawHumanoid(sx, syDraw, { color: cls.color, dir: p.dir, moving: p.moving, t, attacking: p.attackFx > 0, weaponType: cls.weaponType });
  if (p.z > 2) { // bóng đổ dưới đất khi đang nhảy/bay lên cao, giúp thấy rõ đang rời mặt đất
    ctx.beginPath(); ctx.ellipse(sx, sy + 3 * DPR, 20 * DPR * Math.max(0.4, 1 - p.z / 90), 4.5 * DPR, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill();
  }
  const pNameY = syDraw - (gotSprite ? 88 : 34) * DPR;
  ctx.fillStyle = '#fff'; ctx.font = `${10 * DPR}px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(GL.char.name, sx, pNameY);
  drawChatBubble(p, sx, pNameY);

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
