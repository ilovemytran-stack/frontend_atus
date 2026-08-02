// ============================================================================
// HUD + Panels (hành trang, bản đồ, thông báo, NPC)
// ============================================================================
GL.icon = (name, cls) => `<svg class="gl-icon${cls ? ' ' + cls : ''}"><use href="#i-${name}"/></svg>`;

GL.updateVitalsUI = function () {
  const stats = GL.currentStats();
  if (GL.player.hp == null) GL.player.hp = stats.hp;
  if (GL.player.ki == null) GL.player.ki = stats.ki;
  document.getElementById('glCharName').textContent = GL.char.name;
  document.getElementById('glCharLevel').textContent = GL.char.level;
  document.getElementById('glHpFill').style.width = Math.max(0, (GL.player.hp / stats.hp) * 100) + '%';
  document.getElementById('glHpLabel').textContent = `${Math.max(0, Math.round(GL.player.hp))}/${stats.hp}`;
  document.getElementById('glKiFill').style.width = Math.max(0, (GL.player.ki / stats.ki) * 100) + '%';
  document.getElementById('glKiLabel').textContent = `${Math.max(0, Math.round(GL.player.ki))}/${stats.ki}`;
  document.getElementById('glXpFill').style.width = Math.min(100, (GL.char.xp / GL.char.xpToNext) * 100) + '%';
  const portrait = document.getElementById('glTopPortrait');
  const cls = GL.classById(GL.char.classId);
  portrait.style.backgroundImage = `url(${cls.portrait})`;
  portrait.style.borderColor = cls.color;
  const petBtn = document.getElementById('glBtnPet');
  if (petBtn) petBtn.style.display = (GL.char.pets || []).length ? 'flex' : 'none';
};

GL.updateSkillButtonsUI = function () {
  [1, 2].forEach((slot) => {
    const skill = GL.getEquippedSkill(slot);
    const btn = document.getElementById('glSkill' + slot);
    const icon = btn.querySelector('.gl-skill-icon');
    if (skill) {
      icon.textContent = skill.name.trim().charAt(0);
      btn.title = `${skill.name} (${skill.kiCost || 0} Ki)`;
      if (skill.color) icon.style.color = skill.color;
    } else {
      icon.textContent = slot === 1 ? '①' : '②';
      btn.title = '';
    }
  });
};

GL.updateTargetFrame = function () {
  const frame = document.getElementById('glTargetFrame');
  const t = GL.selectedTarget;
  if (!t) { frame.style.display = 'none'; return; }
  frame.style.display = 'block';
  const name = t.def?.nameVN || t.name || (t === GL.worldBoss ? 'Chaoseraph' : '???');
  const hp = t.hp, maxHp = t.maxHp;
  const nameEl = document.getElementById('glTargetName');
  nameEl.textContent = name;
  if (GL.autoAttackTarget === t) nameEl.insertAdjacentHTML('beforeend', ' ' + GL.icon('sword', 'gl-icon-sm'));
  document.getElementById('glTargetHpFill').style.width = Math.max(0, (hp / maxHp) * 100) + '%';
};

GL.updateCurrencyUI = function () {
  document.getElementById('glGold').textContent = GL.char.gold;
  document.getElementById('glGem').textContent = GL.char.gem;
};

GL.CHAT_BUBBLE_MS = 5000;
GL.appendChat = function (userId, name, text) {
  const log = document.getElementById('glChatLog');
  const line = document.createElement('div');
  line.innerHTML = `<b>${name}:</b> ${text.replace(/</g, '&lt;')}`;
  log.appendChild(line);
  while (log.children.length > 6) log.removeChild(log.firstChild);
  GL.setChatBubble(userId, text);
};

// Bong bóng chat trên đầu nhân vật (tự biến mất sau 5s) — vẽ ở game-render.js.
// entity là GL.player (nếu userId là chính mình) hoặc GL.remote[userId] (người khác).
GL.setChatBubble = function (userId, text) {
  const entity = userId === GL.me?._id ? GL.player : GL.remote[userId];
  if (!entity) return;
  entity.chatBubble = { text, until: performance.now() + GL.CHAT_BUBBLE_MS };
};

GL.appendWorldChat = function (name, text, mine, expiresAt) {
  // Bảng góc phải trên — LUÔN hiện, không cần mở panel (xem game.html #glWorldChatTicker)
  const ticker = document.getElementById('glWorldChatTicker');
  if (ticker) {
    const row = document.createElement('div');
    row.className = 'gl-worldchat-row';
    row.innerHTML = `<b style="${mine ? 'color:var(--gl-gold)' : ''}">${name}:</b> ${String(text).replace(/</g, '&lt;')}`;
    ticker.appendChild(row);
    while (ticker.children.length > 6) ticker.removeChild(ticker.firstChild); // tối đa 6 dòng cùng lúc cho đỡ choán màn hình
    const life = Math.max(500, (expiresAt || Date.now() + 15000) - Date.now());
    setTimeout(() => { row.classList.add('gl-wc-out'); setTimeout(() => row.remove(), 360); }, life);
  }
  // Panel mở ra (nếu có) vẫn giữ log cuộn được như trước, cho ai muốn xem lại lịch sử gần đây
  const log = document.getElementById('glWorldChatLog');
  if (log) {
    const line = document.createElement('div');
    line.innerHTML = `<b style="color:${mine ? 'var(--gl-gold-2)' : '#cfd6ff'}">${name}:</b> ${String(text).replace(/</g, '&lt;')}`;
    log.appendChild(line);
    while (log.children.length > 60) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  if (!GL.worldChatPanelOpen && !mine) GL.toast(`${name}: ${text.length > 30 ? text.slice(0, 30) + '…' : text}`, '', 'globe');
};

GL.guildChatHistory = [];
GL.appendGuildChat = function (name, text, mine) {
  const log = document.getElementById('glGuildChatLog');
  if (!log) return; // panel Bang Hội đang đóng — vẫn lưu vào history phía trên để mở lại là thấy
  const line = document.createElement('div');
  line.innerHTML = `<b style="color:${mine ? 'var(--gl-gold-2)' : '#8fd6a8'}">${name}:</b> ${text.replace(/</g, '&lt;')}`;
  log.appendChild(line);
  while (log.children.length > 60) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
};

function sendGuildChat() {
  const inp = document.getElementById('glGuildChatInput');
  if (!inp.value.trim()) return;
  GL.socketEmit('game_guild_chat', { text: inp.value });
  inp.value = '';
}

// ---------- Panel helpers ----------
// Đóng bằng nút [X] (data-close) HOẶC bấm ra vùng nền mờ bên ngoài panel — dùng CẢ 'click' lẫn
// 'pointerdown' vì trên di động đôi khi 'click' bị các listener 'pointerdown/pointerup' khác trong
// game (joystick, nút hành động...) nuốt mất nếu ngón tay lướt nhẹ qua trong lúc chạm.
function openPanel(id) { document.getElementById(id).style.display = 'flex'; }
function closePanel(id) { document.getElementById(id).style.display = 'none'; if (id === 'glPanelWorldChat') GL.worldChatPanelOpen = false; }
function handleOutsideClose(e) {
  if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) { closePanel(e.target.closest('.gl-panel-overlay').id); return; }
  if (e.target.matches('.gl-panel-overlay')) closePanel(e.target.id);
}
document.addEventListener('click', handleOutsideClose);
document.addEventListener('pointerdown', (e) => { if (e.target.matches('.gl-panel-overlay')) closePanel(e.target.id); });

// ---------- Hành trang / trang bị / thuộc tính / kỹ năng ----------
function itemIconFor(kind, def) {
  if (def?.icon) return `<img src="${def.icon}" style="width:30px;height:30px;object-fit:contain;border-radius:5px;vertical-align:middle">`;
  const artRarity = def?.rarity === 'starter' ? 'common' : def?.rarity;
  if (kind === 'weapon') {
    if (def.weaponType && def.weaponType !== 'special' && artRarity && artRarity !== 'special') {
      return `<img src="/assets/game/weapons/${def.weaponType}_${artRarity}.png" style="width:30px;height:30px;object-fit:cover;border-radius:5px;vertical-align:middle">`;
    }
    return GL.icon({ sword: 'sword', dagger: 'dagger', shield: 'shield', staff: 'wand', fist: 'fist', tome: 'book' }[def.weaponType] || 'sword');
  }
  if (kind === 'armor') {
    if (def.slot && artRarity && artRarity !== 'special') {
      return `<img src="/assets/game/armor/${def.slot}_${artRarity}.png" style="width:30px;height:30px;object-fit:cover;border-radius:5px;vertical-align:middle">`;
    }
    return GL.icon({ body: 'shirt', legs: 'pants', boots: 'boot', gloves: 'glove', helmet: 'helmet' }[def.slot] || 'shirt');
  }
  const cat = def?.effect?.hp ? 'hp_recovery' : def?.effect?.ki ? 'mp_recovery' : def?.effect?.buffAtk ? 'attack_boost'
    : def?.effect?.buffSpd ? 'speed_boost' : def?.effect?.buffMaxHp ? 'defense_boost' : null;
  if (cat) return `<img src="/assets/game/items/${cat}.png" style="width:30px;height:24px;object-fit:cover;border-radius:4px;vertical-align:middle">`;
  if (def?.id === 'teleport_scroll') return GL.icon('scroll', 'gl-icon-lg');
  return GL.icon('flask');
}

function renderEquipTab() {
  const eq = GL.char.equipment;
  const slots = [['weapon', 'Vũ khí'], ['helmet', 'Mũ Giáp'], ['body', 'Áo Giáp'], ['gloves', 'Găng Tay'], ['legs', 'Quần Giáp'], ['boots', 'Giày Giáp']];
  let html = '<div class="gl-grid">';
  slots.forEach(([slot, label]) => {
    const itemId = slot === 'weapon' ? eq.weapon : eq[slot];
    const table = slot === 'weapon' ? GL.data.weapons : GL.data.armor;
    const def = itemId ? table[itemId] : null;
    html += `<div class="gl-item-chip ${def ? 'equipped' : ''}">
      <div class="gl-item-icon">${def ? itemIconFor(slot === 'weapon' ? 'weapon' : 'armor', def) : GL.icon('plus')}</div>
      <div class="gl-item-name ${def ? 'gl-rarity-' + def.rarity : ''}">${def ? def.name : label}</div>
    </div>`;
  });
  html += '</div>';
  const stats = GL.currentStats();
  html += `<div class="gl-row"><span>Chỉ số hiện tại</span><span></span></div>
    <div class="gl-row"><span>${GL.icon('heart')} HP</span><span>${stats.hp}</span></div>
    <div class="gl-row"><span>${GL.icon('sword')} ATK</span><span>${stats.atk}</span></div>
    <div class="gl-row"><span>${GL.icon('shield')} DEF</span><span>${stats.def}</span></div>
    <div class="gl-row"><span>${GL.icon('bolt')} SPD</span><span>${stats.spd}</span></div>
    <div class="gl-row"><span>${GL.icon('target')} CRIT</span><span>${stats.crit}%</span></div>
    ${stats.hasFullSpecialSet ? '<div class="gl-row" style="color:var(--gl-gold)"><span>' + GL.icon('sparkles') + ' Bộ đặc biệt</span><span>+40% xử tử</span></div>' : ''}
    ${stats.hasFullSuperSet ? '<div class="gl-row" style="color:#5CE8D8"><span>' + GL.icon('sparkles') + ' Bộ Siêu Cấp</span><span>+' + Math.round(stats.allDmgPct * 100) + '% toàn bộ sát thương</span></div>' : ''}
    ${stats.hasAura ? '<div class="gl-row" style="color:#F5B84C"><span>' + GL.icon('sparkles') + ' Hào Quang</span><span>Đang kích hoạt</span></div>' : ''}`;
  return html;
}

function renderBagTab() {
  const owned = GL.char.inventory.filter((i) => !(i.kind === 'weapon' && i.itemId === GL.char.equipment.weapon) && !(i.kind === 'armor' && Object.values(GL.char.equipment).includes(i.itemId)));
  if (!owned.length) return '<div style="color:var(--gl-text-dim);text-align:center;padding:20px 0">Túi đồ trống. Hãy mua thêm từ NPC trong thành!</div>';
  const hasChest = owned.some((i) => i.itemId === 'treasure_chest');
  const ownedKeys = owned.filter((i) => i.itemId.startsWith('key_'));
  let html = '';
  if (hasChest && ownedKeys.length) {
    html += `<div class="gl-row" style="background:rgba(245,184,76,.1);border-radius:8px;padding:8px 10px;margin-bottom:8px">
      <span>${GL.icon('sparkles')} Mở Rương Kho Báu bằng:</span>
      <span style="display:flex;gap:6px;flex-wrap:wrap">${ownedKeys.map((k) => `<button class="gl-btn-sm" data-openchest="${k.itemId}">${GL.data.consumables[k.itemId].name}</button>`).join('')}</span>
    </div>`;
  }
  html += '<div class="gl-grid">';
  owned.forEach((inv) => {
    const table = inv.kind === 'weapon' ? GL.data.weapons : inv.kind === 'armor' ? GL.data.armor : GL.data.consumables;
    const def = table[inv.itemId]; if (!def) return;
    const sellable = inv.kind !== 'consumable' ? !!def.price : (def.sellPrice || (def.currency === 'gold' && def.price));
    html += `<div class="gl-item-chip" data-use="${inv.itemId}" data-kind="${inv.kind}" data-slot="${def.slot || ''}">
      <div class="gl-item-icon">${itemIconFor(inv.kind, def)}</div>
      <div class="gl-item-name ${def.rarity ? 'gl-rarity-' + def.rarity : ''}">${def.name}${inv.qty > 1 ? ' ×' + inv.qty : ''}</div>
      ${def.reqLevel ? `<div style="font-size:.58rem;color:${GL.char.level < def.reqLevel ? '#E85C4C' : 'var(--gl-text-dim)'}">Yêu cầu Lv.${def.reqLevel}</div>` : ''}
      ${sellable ? `<button class="gl-btn-sm gl-item-sell" data-sell="${inv.itemId}" data-sellkind="${inv.kind}" title="Bán">${GL.icon('coin', 'gl-icon-sm')}</button>` : ''}
    </div>`;
  });
  html += '</div>';
  return html;
}

function renderStatsTab() {
  const a = GL.char.attributes;
  const pts = GL.char.unspentStatPoints;
  let html = `<div class="gl-pts-banner">${pts > 0 ? `Bạn có ${pts} điểm thuộc tính chưa dùng` : 'Không có điểm khả dụng — lên cấp mỗi 5 cấp để nhận thêm'}</div>`;
  Object.entries(GL.data.attributes).forEach(([key, def]) => {
    html += `<div class="gl-statline">
      <div><b>${def.name}</b><br><span style="color:var(--gl-text-dim);font-size:.68rem">${def.desc}</span></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="min-width:20px;text-align:center">${a[key]}</span>
        <button data-stat="${key}" ${pts <= 0 ? 'disabled' : ''}>+</button>
      </div></div>`;
  });
  return html;
}

function renderSkillsTab() {
  const cls = GL.classById(GL.char.classId);
  const pts = GL.char.unspentSkillPoints;
  let html = `<div class="gl-pts-banner">${pts > 0 ? `Bạn có ${pts} điểm kỹ năng` : 'Chưa có điểm kỹ năng — lên cấp mỗi 5 cấp để nhận thêm'}</div>`;
  cls.skills.filter((s) => s.type === 'active').forEach((s) => {
    const lv = GL.char.skillLevels?.[s.id] || 0;
    html += `<div class="gl-statline">
      <div><b>${s.name}</b> <span style="color:var(--gl-text-dim)">Cấp ${lv}/${s.maxLv}</span><br><span style="color:var(--gl-text-dim);font-size:.68rem">${s.desc}</span></div>
      <button data-skillup="${s.id}" ${pts < 2 || lv >= s.maxLv ? 'disabled' : ''}>+</button>
    </div>`;
  });
  html += `<div style="text-align:center;margin-top:12px"><button class="gl-btn-sm" id="glResetSkills">${GL.icon('rotate')} Đặt lại điểm kỹ năng</button></div>`;
  return html;
}

function renderInventoryPanel(tab) {
  document.querySelectorAll('#glPanelInventory .gl-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const body = document.getElementById('glPanelBody');
  if (tab === 'equip') body.innerHTML = renderEquipTab();
  else if (tab === 'bag') body.innerHTML = renderBagTab();
  else if (tab === 'stats') body.innerHTML = renderStatsTab();
  else body.innerHTML = renderSkillsTab();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('glBtnInventory').addEventListener('click', () => { renderInventoryPanel('equip'); openPanel('glPanelInventory'); });
  document.querySelectorAll('#glPanelInventory .gl-tab').forEach((b) => b.addEventListener('click', () => renderInventoryPanel(b.dataset.tab)));

  document.getElementById('glPanelBody').addEventListener('click', async (e) => {
    const sellBtn = e.target.closest('[data-sell]');
    if (sellBtn) {
      const { sell: itemId, sellkind: kind } = sellBtn.dataset;
      const res = await API.post('/game/character/sell', { itemId, kind, qty: 1 });
      if (res?.success) { GL.char = res.character; GL.updateCurrencyUI(); Toast.success(`Đã bán, nhận ${res.goldGained} vàng`); renderInventoryPanel('bag'); }
      else Toast.error(res?.message || 'Không thể bán');
      return;
    }
    const chestBtn = e.target.closest('[data-openchest]');
    if (chestBtn) {
      const res = await API.post('/game/character/chest/open', { keyId: chestBtn.dataset.openchest });
      if (res?.success) { GL.char = res.character; GL.updateCurrencyUI(); Toast.success(`Mở rương: ${res.rewards.join(', ')}`); renderInventoryPanel('bag'); }
      else Toast.error(res?.message || 'Không thể mở rương');
      return;
    }
    const chip = e.target.closest('[data-use]');
    if (chip) {
      const { use: itemId, kind, slot } = chip.dataset;
      if (kind === 'consumable') {
        let extraBody = {};
        if (itemId === 'feather_quill') {
          const newName = prompt('Nhập tên mới cho nhân vật (2-20 ký tự):', GL.char.name);
          if (!newName) return;
          extraBody.newName = newName;
        }
        const res = await API.post('/game/character/use-item', { itemId, ...extraBody });
        if (!res?.success) { Toast.error(res?.message || 'Không thể dùng vật phẩm'); return; }
        GL.char = res.character;
        if (res.effect?.hp) { GL.player.hp = Math.min(GL.currentStats().hp, GL.player.hp + GL.currentStats().hp * res.effect.hp); GL.updateVitalsUI(); }
        if (res.effect?.ki) { GL.player.ki = Math.min(GL.currentStats().ki, (GL.player.ki ?? GL.currentStats().ki) + GL.currentStats().ki * res.effect.ki); GL.updateVitalsUI(); }
        if (res.effect?.buffAtk) { GL.player.buffAtkUntil = performance.now() + res.effect.buffSec * 1000; GL.player.buffAtkPct = res.effect.buffAtk; }
        if (res.effect?.buffSpd) { GL.player.buffSpdUntil = performance.now() + res.effect.buffSec * 1000; GL.player.buffSpdPct = res.effect.buffSpd; }
        if (res.effect?.buffAllDmgPct) { GL.auraDmgBuffUntil = Math.max(GL.auraDmgBuffUntil, performance.now() + res.effect.buffSec * 1000); } // dùng chung cơ chế nhân sát thương tạm thời với Aura cho gọn
        if (res.effect?.resetCooldowns) { GL.player.skillCd = [0, 0]; GL.player.dashCd = 0; GL.player.flyCd = 0; ['glCd1', 'glCd2', 'glCdDash', 'glCdFly'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); }
        if (res.effect?.recallPets) GL.pets.forEach((pet) => { pet.x = GL.player.x + (pet.slot === 0 ? -34 : 34); pet.y = GL.GROUND_Y; });
        if (res.effect?.guardianAngelSec) GL.player.guardianAngelUntil = performance.now() + res.effect.guardianAngelSec * 1000;
        if (res.goldGained) GL.updateCurrencyUI();
        Toast.success('Đã dùng vật phẩm');
        renderInventoryPanel('bag');
      } else {
        const hadFullSuperSet = !!GL.char.stats?.hasFullSuperSet;
        const res = await API.post('/game/character/equip', { itemId, kind, slot });
        if (res?.success) {
          GL.char = res.character; GL.updateVitalsUI(); renderInventoryPanel('equip'); Toast.success('Đã trang bị');
          if (!hadFullSuperSet && res.character.stats?.hasFullSuperSet) GL.playSuperSetTransform();
        } else Toast.error(res?.message || 'Không thể trang bị');
      }
      return;
    }
    const statBtn = e.target.closest('[data-stat]');
    if (statBtn) {
      const body = { str: 0, vit: 0, agi: 0, int: 0 }; body[statBtn.dataset.stat] = 1;
      const res = await API.post('/game/character/allocate-stats', body);
      if (res?.success) { GL.char = res.character; GL.updateVitalsUI(); renderInventoryPanel('stats'); }
      return;
    }
    const skillBtn = e.target.closest('[data-skillup]');
    if (skillBtn) {
      const res = await API.post('/game/character/allocate-skill', { skillId: skillBtn.dataset.skillup });
      if (res?.success) { GL.char = res.character; renderInventoryPanel('skills'); }
      return;
    }
    if (e.target.id === 'glResetSkills') {
      const res = await API.post('/game/character/reset-skills', {});
      if (res?.success) { GL.char = res.character; Toast.info('Đã đặt lại điểm kỹ năng'); renderInventoryPanel('skills'); }
    }
  });

  // ---------- Bản đồ ----------
  document.getElementById('glBtnMap').addEventListener('click', () => { renderMapPanel(); openPanel('glPanelMap'); });

  // ---------- Pet ----------
  document.getElementById('glBtnPet')?.addEventListener('click', () => { renderPetPanel(); openPanel('glPanelPet'); });

  // ---------- Thông báo ----------
  document.getElementById('glBtnNotif').addEventListener('click', () => { GL.requestBossStatus(); renderNotifPanel(); openPanel('glPanelNotif'); });

  // ---------- Chat ----------
  document.getElementById('glChatToggle').addEventListener('click', () => {
    const bar = document.getElementById('glChatBar');
    bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
    if (bar.style.display === 'flex') document.getElementById('glChatInput').focus();
  });
  document.getElementById('glChatSend').addEventListener('click', sendChat);
  document.getElementById('glChatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
  document.getElementById('glChatClose').addEventListener('click', () => {
    document.getElementById('glChatBar').style.display = 'none';
  });
  function sendChat() {
    const inp = document.getElementById('glChatInput');
    if (!inp.value.trim()) return;
    const raw = inp.value;
    GL.socketEmit('game_chat', { mapId: GL.map.id, text: raw });
    GL.appendChat(GL.me._id, GL.char.name, raw); // sửa lỗi cũ: thiếu tham số userId khiến text bị lệch vị trí (text.replace trên undefined)
    // Lệnh pet: gõ đúng "def"/"atk"/"fl" (không phân biệt hoa thường) -> vừa hiện như chat bình thường vừa đổi chế độ pet
    const cmd = raw.trim().toLowerCase();
    if (['def', 'atk', 'fl'].includes(cmd)) GL.setAllPetsMode(cmd);
    inp.value = '';
  }

  // ---------- Chat Thế Giới ----------
  document.getElementById('glWorldChatSend').addEventListener('click', sendWorldChat);
  document.getElementById('glWorldChatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendWorldChat(); });
  function sendWorldChat() {
    const inp = document.getElementById('glWorldChatInput');
    if (!inp.value.trim()) return;
    GL.socketEmit('game_world_chat', { text: inp.value });
    inp.value = '';
  }
});

function renderMapPanel() {
  let html = '';
  GL.data.continents.forEach((cont) => {
    const firstMapLv = GL.mapById(`${cont.id}_1`)?.levelRange?.[0] ?? 1;
    const contUnlocked = GL.char.level >= Math.max(1, firstMapLv - 2);
    html += `<div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <b style="color:${cont.color}">${cont.idx}. ${cont.name}</b>
        <span style="color:var(--gl-text-dim);font-size:.68rem">${contUnlocked ? '' : `${GL.icon('lock')} Cần cấp ${Math.max(1, firstMapLv - 2)}`}</span>
      </div>
      <div class="gl-grid">`;
    cont.maps.forEach((mname, i) => {
      const map = GL.mapById(`${cont.id}_${i + 1}`);
      const reqLv = Math.max(1, (map.levelRange?.[0] ?? 1) - 2);
      const playable = GL.char.level >= reqLv;
      html += `<div class="gl-item-chip" ${playable ? `data-goto="${map.id}"` : ''} style="${playable ? '' : 'opacity:.45'}">
        <div class="gl-item-icon">${map.role === 'boss' ? GL.icon('crown') : map.role === 'god' ? GL.icon('sparkles') : GL.icon('map')}</div>
        <div class="gl-item-name">${mname}</div>
        <div style="font-size:.58rem;color:var(--gl-text-dim)">Lv ${map.levelRange[0]}-${map.levelRange[1]}${playable ? '' : ` · cần cấp ${reqLv}`}</div>
      </div>`;
    });
    html += '</div></div>';
  });
  document.getElementById('glMapBody').innerHTML = html;
  document.getElementById('glMapBody').onclick = async (e) => {
    const el = e.target.closest('[data-goto]'); if (!el) return;
    const map = GL.mapById(el.dataset.goto);
    const res = await API.post('/game/character/move', { mapId: map.id, x: 400, y: 300 });
    if (!res?.success) { GL.toast(res?.message || 'Không thể di chuyển'); return; }
    GL.char = res.character; GL.updateCurrencyUI();
    GL.player.x = 400; GL.player.y = 300;
    GL.joinMap(map);
    closePanel('glPanelMap');
  };
}

// Thư Viện: quái / Thần Hộ Vệ (dữ liệu đã có nhưng chưa gắn AI riêng) / Thần Linh — xem bằng ảnh thật
function renderBestiaryPanel() {
  const el = document.getElementById('glBestiaryBody');
  const card = (imgUrl, name, sub, ring, fallbackUrl) => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 4px">
      <img src="${imgUrl}" onerror="${fallbackUrl ? `this.onerror=function(){this.style.visibility='hidden'};this.src='${fallbackUrl}'` : "this.style.visibility='hidden'"}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:1.5px solid ${ring || 'var(--gl-gold-dim)'};background:#1a1826;flex:0 0 auto">
      <div><div style="font-size:.78rem;font-weight:700">${name}</div>${sub ? `<div style="font-size:.65rem;color:var(--gl-text-dim)">${sub}</div>` : ''}</div>
    </div>`;

  let html = '<div style="margin-bottom:4px;color:var(--gl-text-dim);font-size:.68rem">' + GL.icon('book') + ' Toàn bộ quái, Thần Hộ Vệ và Thần Linh trong thế giới Legendary.</div>';

  html += '<b style="color:var(--gl-gold-2)">' + GL.icon('target') + ' Quái Vật (theo lục địa)</b><div class="gl-grid" style="grid-template-columns:1fr 1fr">';
  GL.data.continents.forEach((cont) => {
    Object.values(GL.data.monsters).filter((m) => m.continent === cont.id).forEach((m) => {
      html += card(`/assets/game/sprites/monsters/${m.id}/idle/1.png`, m.nameVN, `${cont.name} · ${m.name}`, m.color, `/assets/game/monsters/${m.id}.png`);
    });
  });
  html += '</div>';

  html += '<b style="color:var(--gl-gold-2);display:block;margin-top:12px">' + GL.icon('crown') + ' Chaoseraph — Boss Thế Giới</b>';
  html += '<div style="font-size:.62rem;color:var(--gl-text-dim);margin-bottom:4px">Lang thang khắp các lục địa, biến hình qua 5 Dạng khi càng mất máu — xem mục Thông Báo để dịch chuyển tới.</div>';
  html += card('/assets/game/sprites/bosses/b_chaoseraph_form1/idle/1.png', 'Chaoseraph', 'Thần Hỗn Mang · 5 Dạng biến hình', '#E85C4C', '/assets/game/bosses/chaoseraph_1.png');

  html += '<b style="color:var(--gl-gold-2);display:block;margin-top:12px">' + GL.icon('shield') + ' Thần Hộ Vệ (mỗi lục địa 1 vị, xuất hiện ở map Boss)</b>';
  html += '<div class="gl-grid" style="grid-template-columns:1fr 1fr">';
  GL.data.bosses.filter((b) => b.id !== 'b_chaoseraph' && b.id !== 'b_morphiel').forEach((b) => {
    const contId = b.continent;
    const cont = GL.data.continents.find((c) => c.id === contId);
    html += card(`/assets/game/sprites/bosses/${b.id}/idle/1.png`, b.name, b.title, cont?.color, `/assets/game/bosses/${b.id}.png`);
  });
  html += '</div>';

  html += '<b style="color:var(--gl-gold-2);display:block;margin-top:12px">' + GL.icon('sparkles') + ' Thần Linh (thách đấu mỗi 10 cấp)</b><div class="gl-grid" style="grid-template-columns:1fr 1fr">';
  GL.data.continents.forEach((cont) => {
    html += card(`/assets/game/gods/${cont.id}.png`, cont.god?.name || cont.name, cont.god?.title, cont.color);
  });
  html += '</div>';

  el.innerHTML = html;
}

// Bang Hội: chưa có bang -> tạo mới hoặc duyệt danh sách tham gia; đã có bang -> xem thành viên
async function renderGuildPanel() {
  const el = document.getElementById('glGuildBody');
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gl-text-dim)">Đang tải…</div>';
  const mine = await API.get('/guild/mine');
  if (!mine?.success) { el.innerHTML = '<div style="color:var(--gl-text-dim)">Không tải được dữ liệu Bang Hội.</div>'; return; }

  if (mine.guild) {
    const g = mine.guild;
    const isLeader = g.leaderId === GL.char._id;
    const xpPct = Math.min(100, Math.round((g.xp / g.xpToNext) * 100));
    el.innerHTML = `
      <div style="margin-bottom:10px">
        <b style="font-size:1rem;color:var(--gl-gold-2)">[${g.tag}] ${g.name}</b> · Lv.${g.level}
        <div style="color:var(--gl-text-dim);font-size:.68rem;margin-top:2px">${g.description || 'Chưa có mô tả.'}</div>
        <div style="color:var(--gl-text-dim);font-size:.65rem;margin-top:2px">${g.members.length}/${g.maxMembers} thành viên</div>
        <div style="background:rgba(255,255,255,.08);border-radius:99px;height:6px;margin-top:6px;overflow:hidden">
          <div style="background:var(--gl-gold-2);height:100%;width:${xpPct}%"></div>
        </div>
        <div style="color:var(--gl-text-dim);font-size:.6rem;margin-top:2px">${g.xp}/${g.xpToNext} EXP Bang · diệt quái sẽ góp EXP cho Bang</div>
      </div>
      <b style="color:var(--gl-gold-2);font-size:.75rem">Thành viên</b>
      <div id="glGuildMembers"></div>
      <button class="gl-btn-sm" id="glGuildLeave" style="margin:10px 0;background:rgba(232,92,76,.25)">Rời Bang Hội</button>
      <b style="color:var(--gl-gold-2);font-size:.75rem;display:block;margin-top:4px">${GL.icon('chat')} Chat Bang Hội</b>
      <div id="glGuildChatLog" style="height:140px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;font-size:.7rem;background:rgba(8,7,14,.4);border-radius:8px;padding:8px;margin:6px 0"></div>
      <div style="display:flex;gap:6px">
        <input id="glGuildChatInput" maxlength="140" placeholder="Nhắn với Bang…" style="flex:1;background:rgba(8,7,14,.7);border:1px solid var(--gl-gold-dim);border-radius:99px;padding:7px 12px;color:#fff;font-size:.72rem">
        <button id="glGuildChatSend" class="gl-btn-sm">Gửi</button>
      </div>`;
    document.getElementById('glGuildChatSend').onclick = sendGuildChat;
    document.getElementById('glGuildChatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendGuildChat(); });
    (GL.guildChatHistory || []).forEach((m) => GL.appendGuildChat(m.name, m.text, m.userId === GL.me._id));
    const mBody = document.getElementById('glGuildMembers');
    mBody.innerHTML = g.members.map((m) => `
      <div class="gl-row"><span>${m.id === g.leaderId ? GL.icon('crown') + ' ' : ''}${m.name} <span style="color:var(--gl-text-dim);font-size:.65rem">Lv.${m.level} · ${m.classId}</span></span>
      ${isLeader && m.id !== GL.char._id ? `<button class="gl-btn-sm" data-kick="${m.id}">Đuổi</button>` : ''}</div>`).join('');
    mBody.onclick = async (e) => {
      const btn = e.target.closest('[data-kick]'); if (!btn) return;
      if (!confirm('Đuổi thành viên này khỏi Bang Hội?')) return;
      const res = await API.post('/guild/kick', { charId: btn.dataset.kick });
      if (res?.success) renderGuildPanel(); else GL.toast(res?.message || 'Lỗi');
    };
    document.getElementById('glGuildLeave').onclick = async () => {
      if (!confirm('Bạn chắc chắn muốn rời Bang Hội?')) return;
      const res = await API.post('/guild/leave');
      if (res?.success) renderGuildPanel(); else GL.toast(res?.message || 'Lỗi');
    };
    return;
  }

  const list = await API.get('/guild/list');
  el.innerHTML = `
    <div style="border:1px solid var(--gl-gold-dim);border-radius:10px;padding:10px;margin-bottom:12px">
      <b style="color:var(--gl-gold-2);font-size:.78rem">Lập Bang Hội mới (500 ${GL.icon('coin', 'gl-icon-sm')})</b>
      <input id="glGuildNewName" maxlength="24" placeholder="Tên Bang Hội" style="width:100%;margin-top:6px;background:rgba(8,7,14,.7);border:1px solid var(--gl-gold-dim);border-radius:8px;padding:7px 10px;color:#fff;font-size:.75rem">
      <input id="glGuildNewTag" maxlength="4" placeholder="Tag (VD: MXH)" style="width:100%;margin-top:6px;background:rgba(8,7,14,.7);border:1px solid var(--gl-gold-dim);border-radius:8px;padding:7px 10px;color:#fff;font-size:.75rem">
      <button class="gl-btn-sm" id="glGuildCreate" style="margin-top:8px;width:100%">Thành Lập</button>
    </div>
    <b style="color:var(--gl-gold-2);font-size:.78rem">Bang Hội đang tuyển thành viên</b>
    <div id="glGuildList" style="margin-top:6px"></div>`;
  const listBody = document.getElementById('glGuildList');
  listBody.innerHTML = (list?.guilds || []).length
    ? list.guilds.map((g) => `<div class="gl-row"><span><b>[${g.tag}] ${g.name}</b><br><span style="color:var(--gl-text-dim);font-size:.65rem">Bang chủ ${g.leaderName} · ${g.memberCount}/${g.maxMembers}</span></span>
        <button class="gl-btn-sm" data-join="${g.id}" ${g.memberCount >= g.maxMembers ? 'disabled' : ''}>Tham gia</button></div>`).join('')
    : '<div style="color:var(--gl-text-dim);font-size:.7rem;padding:8px 0">Chưa có Bang Hội nào — hãy là người đầu tiên!</div>';
  listBody.onclick = async (e) => {
    const btn = e.target.closest('[data-join]'); if (!btn) return;
    const res = await API.post('/guild/join', { guildId: btn.dataset.join });
    if (res?.success) renderGuildPanel(); else GL.toast(res?.message || 'Lỗi');
  };
  document.getElementById('glGuildCreate').onclick = async () => {
    const name = document.getElementById('glGuildNewName').value.trim();
    const tag = document.getElementById('glGuildNewTag').value.trim();
    const res = await API.post('/guild/create', { name, tag });
    if (res?.success) { GL.char.gold = res.character.gold; GL.updateCurrencyUI(); renderGuildPanel(); }
    else GL.toast(res?.message || 'Lỗi');
  };
}

const PET_MODE_DESC = { def: 'Chỉ đánh quái đến gần BẠN — bảo vệ, không đi xa', atk: 'Chủ động lao ra đánh quái ở khoảng cách xa hơn', fl: 'Chỉ đi theo, không tự đánh quái nào cả' };
function renderPetPanel() {
  const el = document.getElementById('glPanelPetBody');
  const pets = GL.char.pets || [];
  let html = '';
  if (!pets.length) {
    html = `<div style="color:var(--gl-text-dim);text-align:center;padding:16px 0">Bạn chưa có pet nào.<br>Săn Boss Thế Giới (ChaosLord) để có cơ hội nhận pet ngẫu nhiên!</div>`;
  } else {
    pets.forEach((p) => {
      html += `<div style="border:1px solid var(--gl-border);border-radius:10px;padding:10px;margin-bottom:10px">
        <div style="display:flex;gap:10px;align-items:center">
          <img src="${p.isDead ? p.diePortrait : p.portrait}" style="width:52px;height:52px;object-fit:contain;opacity:${p.isDead ? .5 : 1}">
          <div style="flex:1">
            <div><b style="${p.tier === 'vip' ? 'color:var(--gl-gold)' : ''}">${p.name}</b> <span style="color:var(--gl-text-dim);font-size:.65rem">${p.role === 'daica' ? 'Đại Ca' : 'Tiểu Đệ'} · ${p.tier === 'vip' ? 'VIP' : 'Thường'}</span></div>
            <div style="font-size:.68rem;color:var(--gl-text-dim)">HP ${p.stats.hp} · ATK ${p.stats.atk} · DEF ${p.stats.def} · Ki ${p.stats.ki}</div>
            ${p.isDead ? `<div style="color:#ff8a8a;font-size:.68rem">Đang hồi sinh...</div>` : ''}
          </div>
        </div>
        <div style="margin-top:8px;font-size:.65rem;color:var(--gl-text-dim)">
          Chiêu 2: ${p.skill2Version ? 'V' + p.skill2Version : 'Chưa mở (Lv.20)'} · Chiêu 3: ${p.skill3Version ? 'V' + p.skill3Version : 'Chưa mở (Lv.40)'} · Chiêu 4: ${p.hasSkill4 ? 'Đã mở' : 'Chưa mở (Lv.60)'}
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
          ${['def', 'atk', 'fl'].map((m) => `<button class="gl-btn-sm" data-petmode="${p.slot}:${m}" style="flex:1;${p.mode === m ? 'background:var(--gl-gold-dim);color:#000' : ''}" title="${PET_MODE_DESC[m]}">${{ def: 'Thủ', atk: 'Công', fl: 'Theo' }[m]}</button>`).join('')}
        </div>
      </div>`;
    });
  }
  if (!GL.char.petSlot2Unlocked && pets.length) {
    html += `<div style="color:var(--gl-text-dim);font-size:.68rem;text-align:center">Dùng vật phẩm "Lệnh Bái Sư" để mở thêm 1 ô pet (Tiểu Đệ).</div>`;
  }
  el.innerHTML = html;
  el.onclick = async (e) => {
    const btn = e.target.closest('[data-petmode]'); if (!btn) return;
    const [slot, mode] = btn.dataset.petmode.split(':');
    const res = await API.post('/game/character/pet/mode', { slot: Number(slot), mode });
    if (res?.success) { GL.char = res.character; GL.spawnPetsFromChar(); renderPetPanel(); }
  };
}

function renderNotifPanel() {
  const mails = (GL.char.mailbox || []).filter((m) => !m.claimed);
  const duels = (GL.char.godDuels || []).filter((d) => d.status === 'pending');
  let html = '';
  if (GL.lastBossStatus?.active) {
    html += `<div style="padding:10px 12px;margin-bottom:10px;border:1px solid rgba(232,92,76,.4);border-radius:10px;background:rgba(232,92,76,.08)">
      ${GL.icon('crown')} <b>Chaoseraph</b> đang ở <b>${GL.lastBossStatus.continentName} · ${GL.lastBossStatus.mapName}</b> (khu ${GL.lastBossStatus.zone})<br>
      <span style="color:var(--gl-text-dim);font-size:.65rem">Dạng ${GL.lastBossStatus.form}/5 · ${Math.round(GL.lastBossStatus.hp)}/${GL.lastBossStatus.maxHp} HP</span><br>
      <button class="gl-btn-sm" id="glTeleportBoss" style="margin-top:6px">${GL.icon('portal')} Dịch chuyển đến Boss</button>
    </div>`;
  }
  if (duels.length) {
    html += `<div style="color:var(--gl-gold);font-size:.7rem;font-weight:700;margin-bottom:6px">${GL.icon('sword')} THÁCH ĐẤU THẦN LINH</div>`;
    html += duels.map((d) => `<div class="gl-row"><span>Thư thách đấu từ <b>${d.godName}</b><br><span style="color:var(--gl-text-dim);font-size:.65rem">Mở khoá ở cấp ${d.tier * 10} · Thua không mất gì</span></span><button class="gl-btn-sm" data-duel="${d.tier}">Chiến đấu</button></div>`).join('');
  }
  if (mails.length) {
    html += `<div style="color:var(--gl-gold);font-size:.7rem;font-weight:700;margin-bottom:6px">${GL.icon('scroll')} HÒM THƯ (${mails.length})</div>`;
    html += mails.map((m) => `<div class="gl-row"><span><b>${m.title}</b><br><span style="color:var(--gl-text-dim);font-size:.65rem">${m.message || ''}${m.gold ? ' · ' + GL.icon('coin', 'gl-icon-sm') + m.gold : ''}${m.gem ? ' · ' + GL.icon('gem', 'gl-icon-sm') + m.gem : ''}</span></span><button class="gl-btn-sm" data-mail="${m._id}">Nhận</button></div>`).join('');
  }
  if (claimable.length) {
    if (mails.length) html += `<div style="color:var(--gl-gold);font-size:.7rem;font-weight:700;margin:10px 0 6px">${GL.icon('scroll')} NHIỆM VỤ</div>`;
    html += claimable.map((q) => `<div class="gl-row"><span>${GL.icon('check')} Hoàn thành: <b>${q.name}</b></span><button class="gl-btn-sm" data-claim="${q.id}">Nhận thưởng</button></div>`).join('');
  }
  if (!mails.length && !claimable.length) {
    html += `<div style="color:var(--gl-text-dim);text-align:center;padding:16px 0">Chưa có thông báo mới.</div>`;
  }
  html += `<div style="margin-top:16px;padding:12px;border:1px dashed var(--gl-gold-dim);border-radius:12px;font-size:.72rem;color:var(--gl-text-dim);display:flex;gap:8px;align-items:flex-start">
    ${GL.icon('bell')} <span>Thư thách đấu từ các Vị Thần (mỗi 10 cấp) và thông báo bang hội sẽ xuất hiện ở đây trong bản cập nhật tiếp theo.</span>
  </div>`;
  document.getElementById('glNotifBody').innerHTML = html;
  document.getElementById('glNotifBody').onclick = async (e) => {
    const claimBtn = e.target.closest('[data-claim]');
    if (claimBtn) {
      const res = await API.post('/game/character/quests/claim', { questId: claimBtn.dataset.claim });
      if (res?.success) { GL.char = res.character; GL.updateCurrencyUI(); GL.updateVitalsUI(); Toast.success('Đã nhận thưởng nhiệm vụ!'); renderNotifPanel(); }
      return;
    }
    const mailBtn = e.target.closest('[data-mail]');
    if (mailBtn) {
      const res = await API.post('/game/character/mailbox/claim', { mailId: mailBtn.dataset.mail });
      if (res?.success) { GL.char = res.character; GL.updateCurrencyUI(); Toast.success('Đã nhận thư!'); renderNotifPanel(); }
      return;
    }
    const duelBtn = e.target.closest('[data-duel]');
    if (duelBtn) { GL.startGodDuel(Number(duelBtn.dataset.duel)); return; }
    const teleBtn = e.target.closest('#glTeleportBoss');
    if (teleBtn && GL.lastBossStatus?.active) {
      const map = GL.mapById(GL.lastBossStatus.mapId);
      if (!map) { Toast.error('Không tìm thấy bản đồ của Boss'); return; }
      await API.post('/game/character/move', { mapId: map.id, x: GL.BOSS_SPOT?.x ?? 500, y: GL.BOSS_SPOT?.y ?? 300, freeTeleport: true });
      GL.player.x = GL.BOSS_SPOT?.x ?? 500; GL.player.y = GL.BOSS_SPOT?.y ?? 300;
      GL.joinMap(map, GL.lastBossStatus.zone);
      closePanel('glPanelNotif');
      Toast.success('Đã dịch chuyển đến chỗ Chaoseraph!');
    }
  };
  document.getElementById('glNotifDot').style.display = (claimable.length || mails.length || duels.length) ? 'block' : 'none';
}

// ---------- NPC ----------
// Hào Quang: CHỈ hiện tại NPC Trưởng Lão Nhiệm Vụ ở Lục Địa Ánh Sáng (Aurelion) — đúng theo bản spec,
// dù NPC này (cùng roster NPC_DEFS) xuất hiện ở mọi lục địa khác.
function renderAuraSection() {
  if (GL.map?.continentId !== 'aurelion') return '';
  const aura = GL.data.aura;
  if (!aura) return '';
  if (GL.char.hasAura) {
    return `<div class="gl-row" style="margin-top:10px;border-top:1px solid var(--gl-border);padding-top:10px;color:#F5B84C">
      <span>${GL.icon('sparkles')} ${aura.name}</span><span>Đã sở hữu</span></div>`;
  }
  const okLevel = GL.char.level >= aura.reqLevel;
  return `<div style="margin-top:10px;border-top:1px solid var(--gl-border);padding-top:10px">
    <div style="font-weight:600;color:#F5B84C">${GL.icon('sparkles')} ${aura.name}</div>
    <div style="color:var(--gl-text-dim);font-size:.68rem;margin:4px 0">${aura.dialogue}</div>
    <div style="font-size:.65rem;color:var(--gl-text-dim)">Yêu cầu: Lv.${aura.reqLevel}+ · ${aura.costSpecialPieces} trang bị đặc biệt bất kỳ · ${aura.costUpgradeStones} Đá Nâng Trang Bị Đặc Biệt</div>
    <button class="gl-cta-btn" style="margin-top:6px" data-aura-exchange ${okLevel ? '' : 'disabled'}>${okLevel ? 'Đổi Lấy Hào Quang' : `Cần đạt Lv.${aura.reqLevel}`}</button>
  </div>`;
}

GL.openNpc = function (npc) {
  document.getElementById('glNpcTitle').textContent = `${npc.icon} ${npc.name}`;
  const body = document.getElementById('glNpcBody');
  if (npc.kind === 'quest') {
    const progressFor = (q) => {
      switch (q.type) {
        case 'reach_level': return GL.char.level;
        case 'earn_gold': return GL.char.gold;
        case 'equip_armor': return ['body', 'legs', 'boots', 'gloves', 'helmet'].some((k) => GL.char.equipment?.[k]) ? 1 : 0;
        case 'win_duel': return GL.char.questProgress?.duelsWon || 0;
        case 'visit_continents': return (GL.char.questProgress?.continentsVisited || []).length;
        case 'buy_weapon': return GL.char.questProgress?.q_gear_up || 0;
        case 'kill': return GL.char.questProgress?.totalKills || 0;
        default: return GL.char.questProgress?.[q.id] || 0;
      }
    };
    body.innerHTML = (GL.data.quests || []).map((q) => {
      const prog = progressFor(q);
      const claimed = GL.char.questProgress?.[q.id + '_claimed'];
      return `<div class="gl-row"><span>${q.name}<br><span style="color:var(--gl-text-dim);font-size:.62rem">${q.desc || ''}</span><br><span style="color:var(--gl-text-dim);font-size:.65rem">${Math.min(prog, q.target)}/${q.target} · Thưởng ${q.reward.xp ? q.reward.xp + ' EXP ' : ''}${q.reward.gold ? q.reward.gold + GL.icon('coin', 'gl-icon-sm') + ' ' : ''}${q.reward.gem ? q.reward.gem + GL.icon('gem', 'gl-icon-sm') : ''}</span></span>
        <button class="gl-btn-sm" data-claim="${q.id}" ${claimed || prog < q.target ? 'disabled' : ''}>${claimed ? 'Đã nhận' : 'Nhận'}</button></div>`;
    }).join('') + renderAuraSection();
    body.onclick = async (e) => {
      const auraBtn = e.target.closest('[data-aura-exchange]');
      if (auraBtn) {
        const res = await API.post('/game/character/aura/exchange', {});
        if (res?.success) { GL.char = res.character; GL.updateVitalsUI(); Toast.success('Đã kích hoạt Hào Quang Thăng Hoa!'); GL.openNpc(npc); }
        else Toast.error(res?.message || 'Không thể đổi Hào Quang');
        return;
      }
      const btn = e.target.closest('[data-claim]'); if (!btn) return;
      const res = await API.post('/game/character/quests/claim', { questId: btn.dataset.claim });
      if (res?.success) {
        GL.char = res.character; GL.updateCurrencyUI(); GL.openNpc(npc);
        if (res.leveledUp?.length) {
          GL.toast(`LÊN CẤP ${res.character.level}!`, 'gl-toast-levelup');
          if (res.character.level % GL.data.pointsEvery === 0) GL.toast('Nhận điểm thuộc tính & kỹ năng mới!');
          if (res.character.godDuels?.some((d) => d.status === 'pending')) GL.toast('Có thách đấu Thần Linh mới trong Thông Báo!', '', 'sword');
          GL.updateVitalsUI();
        }
      }
    };
  } else if (npc.kind === 'portal') {
    body.innerHTML = `<div style="text-align:center;padding:12px 0;color:var(--gl-text-dim)">Người Dẫn Đường có thể đưa bạn tới lục địa khác.</div><button class="gl-cta-btn" id="glGotoMapPanel">Xem Bản Đồ Vương Quốc</button>`;
    document.getElementById('glGotoMapPanel').onclick = () => { closePanel('glPanelNpc'); renderMapPanel(); openPanel('glPanelMap'); };
  } else {
    const isWeapon = npc.kind === 'weapon';
    const cls = GL.classById(GL.char.classId);
    let entries;
    if (isWeapon) entries = GL.data.rarity.map((r) => GL.data.weapons[`${cls.weaponType}_${r}`]);
    else if (npc.kind === 'armor') entries = Object.values(GL.data.armor);
    else entries = Object.values(GL.data.consumables);
    body.innerHTML = '<div class="gl-grid">' + entries.map((it) => `
      <div class="gl-item-chip" data-buy="${it.id}" data-kind="${isWeapon ? 'weapon' : npc.kind === 'armor' ? 'armor' : 'consumable'}">
        <div class="gl-item-icon">${itemIconFor(isWeapon ? 'weapon' : npc.kind === 'armor' ? 'armor' : 'consumable', it)}</div>
        <div class="gl-item-name ${it.rarity ? 'gl-rarity-' + it.rarity : ''}">${it.name}</div>
        ${it.reqLevel ? `<div style="font-size:.58rem;color:${GL.char.level < it.reqLevel ? '#E85C4C' : 'var(--gl-text-dim)'}">Yêu cầu Lv.${it.reqLevel}</div>` : ''}
        <div style="font-size:.62rem;margin-top:2px;display:flex;align-items:center;gap:3px">${it.price} ${it.currency === 'gem' ? GL.icon('gem', 'gl-icon-sm') : GL.icon('coin', 'gl-icon-sm')}</div>
      </div>`).join('') + '</div>';
    body.onclick = async (e) => {
      const chip = e.target.closest('[data-buy]'); if (!chip) return;
      const res = await API.post('/game/character/buy', { itemId: chip.dataset.buy, kind: chip.dataset.kind });
      if (res?.success) { GL.char = res.character; GL.updateCurrencyUI(); Toast.success('Đã mua! Trang bị trong Hành Trang.'); }
      else Toast.error(res?.message || 'Không thể mua');
    };
  }
  openPanel('glPanelNpc');
};
