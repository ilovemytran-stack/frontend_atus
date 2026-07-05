// ============================================================================
// Bạn bè + Giao dịch (trade) — dùng chung socket game đã kết nối (game-network.js)
// ============================================================================
GL.friendsCache = { friends: [], requests: [] };
GL.trade = null; // { tradeId, partnerUserId, partnerName, myOffer, theirOffer, myConfirmed, theirConfirmed }

function openPanelG(id) { document.getElementById(id).style.display = 'flex'; }
function closePanelG(id) { document.getElementById(id).style.display = 'none'; }

async function loadFriends() {
  const res = await API.get('/game/friends');
  if (res?.success) { GL.friendsCache = res; document.getElementById('glFriendDot').style.display = res.requests.length ? 'block' : 'none'; }
  return res;
}

function renderFriendsPanel(tab) {
  document.querySelectorAll('#glPanelFriends .gl-tab').forEach((b) => b.classList.toggle('active', b.dataset.ftab === tab));
  const body = document.getElementById('glFriendsBody');
  if (tab === 'list') {
    body.innerHTML = GL.friendsCache.friends.length ? GL.friendsCache.friends.map((f) => `
      <div class="gl-friend-row">
        <span><span class="${f.online ? 'gl-friend-online' : 'gl-friend-offline'}"></span><b>${f.name}</b> <span style="color:var(--gl-text-dim)">Lv.${f.level} · ${GL.classById(f.classId)?.name || ''}</span></span>
        <span style="display:flex;gap:6px">
          ${f.online ? `<button class="gl-btn-sm" data-trade="${f.userId}" data-tname="${f.name}">Giao dịch</button>` : ''}
          <button class="gl-btn-sm" data-unfriend="${f.id}" style="background:rgba(232,92,76,.12);border-color:#E85C4C;color:#E85C4C">Hủy kết bạn</button>
        </span>
      </div>`).join('') : `<div style="text-align:center;color:var(--gl-text-dim);padding:20px 0">Chưa có bạn bè. Sang tab "Tìm bạn" để kết bạn nhé!</div>`;
  } else if (tab === 'requests') {
    body.innerHTML = GL.friendsCache.requests.length ? GL.friendsCache.requests.map((r) => `
      <div class="gl-friend-row">
        <span><b>${r.name}</b> <span style="color:var(--gl-text-dim)">Lv.${r.level} · ${GL.classById(r.classId)?.name || ''}</span></span>
        <span style="display:flex;gap:6px">
          <button class="gl-btn-sm" data-accept="${r.id}">Chấp nhận</button>
          <button class="gl-btn-sm" data-decline="${r.id}" style="background:rgba(232,92,76,.12);border-color:#E85C4C;color:#E85C4C">Từ chối</button>
        </span>
      </div>`).join('') : `<div style="text-align:center;color:var(--gl-text-dim);padding:20px 0">Không có lời mời nào.</div>`;
  } else {
    body.innerHTML = `<div class="gl-search-bar"><input id="glFriendSearchInput" placeholder="Nhập tên nhân vật…"><button class="gl-btn-sm" id="glFriendSearchBtn">Tìm</button></div><div id="glFriendSearchResults"></div>`;
    document.getElementById('glFriendSearchBtn').onclick = doFriendSearch;
    document.getElementById('glFriendSearchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doFriendSearch(); });
  }
}

async function doFriendSearch() {
  const name = document.getElementById('glFriendSearchInput').value.trim();
  if (name.length < 2) return;
  const res = await API.get(`/game/friends/search?name=${encodeURIComponent(name)}`);
  const box = document.getElementById('glFriendSearchResults');
  if (!res?.success || !res.results.length) { box.innerHTML = `<div style="color:var(--gl-text-dim);text-align:center;padding:12px 0">Không tìm thấy nhân vật nào.</div>`; return; }
  box.innerHTML = res.results.map((r) => `
    <div class="gl-friend-row"><span><b>${r.name}</b> <span style="color:var(--gl-text-dim)">Lv.${r.level} · ${GL.classById(r.classId)?.name || ''}</span></span>
    <button class="gl-btn-sm" data-addfriend="${r._id}">Kết bạn</button></div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('glBtnFriends').addEventListener('click', async () => { await loadFriends(); renderFriendsPanel('list'); openPanelG('glPanelFriends'); });
  document.querySelectorAll('#glPanelFriends .gl-tab').forEach((b) => b.addEventListener('click', () => renderFriendsPanel(b.dataset.ftab)));

  document.getElementById('glMapLabel').addEventListener('click', () => { GL.requestZoneList(); openPanelG('glPanelZone'); });

  document.getElementById('glFriendsBody').addEventListener('click', async (e) => {
    const acceptBtn = e.target.closest('[data-accept]');
    const declineBtn = e.target.closest('[data-decline]');
    const unfriendBtn = e.target.closest('[data-unfriend]');
    const addBtn = e.target.closest('[data-addfriend]');
    const tradeBtn = e.target.closest('[data-trade]');
    if (acceptBtn) { await API.post('/game/friends/accept', { fromId: acceptBtn.dataset.accept }); await loadFriends(); renderFriendsPanel('list'); Toast.success('Đã chấp nhận kết bạn'); }
    else if (declineBtn) { await API.post('/game/friends/decline', { fromId: declineBtn.dataset.decline }); await loadFriends(); renderFriendsPanel('requests'); }
    else if (unfriendBtn) { if (confirm('Hủy kết bạn?')) { await API.delete(`/game/friends/${unfriendBtn.dataset.unfriend}`); await loadFriends(); renderFriendsPanel('list'); } }
    else if (addBtn) { const res = await API.post('/game/friends/request', { targetId: addBtn.dataset.addfriend }); Toast[res?.success ? 'success' : 'error'](res?.message || ''); }
    else if (tradeBtn) { requestTrade(tradeBtn.dataset.trade, tradeBtn.dataset.tname); }
  });

  // ---------- Lời mời giao dịch đến ----------
  document.getElementById('glTradeReqAccept').addEventListener('click', () => {
    const fromUserId = document.getElementById('glTradeRequestPopup').dataset.from;
    GL.socketEmit('trade_accept', { fromUserId });
    closePanelG('glTradeRequestPopup');
  });
  document.getElementById('glTradeReqDecline').addEventListener('click', () => {
    const fromUserId = document.getElementById('glTradeRequestPopup').dataset.from;
    GL.socketEmit('trade_decline', { toUserId: fromUserId });
    closePanelG('glTradeRequestPopup');
  });

  document.getElementById('glTradeCloseBtn').addEventListener('click', () => {
    if (GL.trade) GL.socketEmit('trade_cancel', { tradeId: GL.trade.tradeId });
    closePanelG('glPanelTrade'); GL.trade = null;
  });
  document.getElementById('glTradeConfirmBtn').addEventListener('click', () => {
    if (!GL.trade) return;
    GL.socketEmit('trade_confirm', { tradeId: GL.trade.tradeId });
  });
  document.getElementById('glTradeMyGold').addEventListener('change', pushMyTradeOffer);
  document.getElementById('glTradeMyGem').addEventListener('change', pushMyTradeOffer);
});

function requestTrade(targetUserId, targetName) {
  GL.socketEmit('trade_request', { toUserId: targetUserId, fromName: GL.char.name });
  Toast.info(`Đã gửi lời mời giao dịch tới ${targetName}, đang chờ phản hồi…`);
}

GL.renderZonePopup = function (mapId, zones) {
  if (!GL.map || GL.map.id !== mapId) return;
  const body = document.getElementById('glZoneBody');
  body.innerHTML = zones.map((z) => `
    <div class="gl-friend-row">
      <span>Khu vực ${z.zone} ${z.zone === GL.player.zone ? '<b style="color:var(--gl-gold)">(hiện tại)</b>' : ''}<br><span style="color:var(--gl-text-dim);font-size:.68rem">${z.count}/${z.cap} người chơi</span></span>
      ${z.zone === GL.player.zone ? '' : `<button class="gl-btn-sm" data-gozone="${z.zone}" ${z.count >= z.cap ? 'disabled' : ''}>${z.count >= z.cap ? 'Đầy' : 'Vào'}</button>`}
    </div>`).join('');
  body.onclick = (e) => {
    const btn = e.target.closest('[data-gozone]'); if (!btn) return;
    GL.changeZone(Number(btn.dataset.gozone));
    closePanelG('glPanelZone');
  };
};

function pushMyTradeOffer() {
  if (!GL.trade) return;
  const gold = Math.max(0, Math.min(GL.char.gold, Number(document.getElementById('glTradeMyGold').value) || 0));
  const gem = Math.max(0, Math.min(GL.char.gem, Number(document.getElementById('glTradeMyGem').value) || 0));
  const items = GL.trade.myItems || [];
  GL.socketEmit('trade_update_offer', { tradeId: GL.trade.tradeId, gold, gem, items });
}

function renderTradeItemPicker() {
  const owned = GL.char.inventory.filter((i) => {
    if (i.kind === 'weapon' && i.itemId === GL.char.equipment.weapon) return false;
    if (i.kind === 'armor' && Object.values(GL.char.equipment).includes(i.itemId)) return false;
    return true;
  });
  const box = document.getElementById('glTradeMyItems');
  if (!owned.length) { box.innerHTML = `<div style="grid-column:1/-1;color:var(--gl-text-dim);font-size:.7rem;text-align:center">Không có vật phẩm rời để giao dịch</div>`; return; }
  box.innerHTML = owned.map((inv) => {
    const table = inv.kind === 'weapon' ? GL.data.weapons : inv.kind === 'armor' ? GL.data.armor : GL.data.consumables;
    const def = table[inv.itemId]; if (!def) return '';
    const selected = (GL.trade.myItems || []).some((it) => it.itemId === inv.itemId && it.kind === inv.kind);
    return `<div class="gl-item-chip ${selected ? 'selected' : ''}" data-tradeitem="${inv.itemId}" data-tradekind="${inv.kind}">
      <div class="gl-item-name ${def.rarity ? 'gl-rarity-' + def.rarity : ''}">${def.name}${inv.qty > 1 ? ' ×' + inv.qty : ''}</div>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-tradeitem]').forEach((chip) => chip.addEventListener('click', () => {
    GL.trade.myItems = GL.trade.myItems || [];
    const key = chip.dataset.tradeitem, kind = chip.dataset.tradekind;
    const idx = GL.trade.myItems.findIndex((it) => it.itemId === key && it.kind === kind);
    if (idx >= 0) GL.trade.myItems.splice(idx, 1);
    else GL.trade.myItems.push({ itemId: key, kind, qty: 1 });
    chip.classList.toggle('selected');
    pushMyTradeOffer();
  }));
}

function itemLabel(it) {
  const table = it.kind === 'weapon' ? GL.data.weapons : it.kind === 'armor' ? GL.data.armor : GL.data.consumables;
  return table[it.itemId]?.name || it.itemId;
}

function renderTheirOffer(offer) {
  document.getElementById('glTradeTheirCurrency').textContent = `🪙 ${offer.gold || 0} · 💎 ${offer.gem || 0}`;
  document.getElementById('glTradeTheirItems').innerHTML = (offer.items || []).map((it) => `<div class="gl-item-chip"><div class="gl-item-name">${itemLabel(it)}${it.qty > 1 ? ' ×' + it.qty : ''}</div></div>`).join('') || `<div style="grid-column:1/-1;color:var(--gl-text-dim);font-size:.7rem;text-align:center">Chưa đề nghị gì</div>`;
}

// ---------- Đăng ký sự kiện socket cho trade (gọi từ game-network.js sau khi socket kết nối) ----------
GL.initTradeSocket = function () {
  GL.socket.on('trade_request_received', ({ fromUserId, fromName }) => {
    const popup = document.getElementById('glTradeRequestPopup');
    popup.dataset.from = fromUserId;
    document.getElementById('glTradeReqName').textContent = fromName;
    openPanelG('glTradeRequestPopup');
  });
  GL.socket.on('trade_declined', () => { Toast.info('Lời mời giao dịch đã bị từ chối'); });
  GL.socket.on('trade_error', ({ message }) => Toast.error(message));

  GL.socket.on('trade_started', ({ tradeId, userA, userB }) => {
    const partnerId = GL.me._id === userA ? userB : userA;
    GL.trade = { tradeId, partnerUserId: partnerId, partnerName: GL.friendsCache.friends.find((f) => f.userId === partnerId)?.name || 'Đối phương', myItems: [], myConfirmed: false, theirConfirmed: false };
    document.getElementById('glTradePartnerName').textContent = GL.trade.partnerName;
    document.getElementById('glTradePartnerName2').textContent = GL.trade.partnerName;
    document.getElementById('glTradeMyGold').value = 0; document.getElementById('glTradeMyGem').value = 0;
    document.getElementById('glTradeMeConfirmed').style.display = 'none';
    document.getElementById('glTradePartnerConfirmed').style.display = 'none';
    renderTradeItemPicker();
    renderTheirOffer({ gold: 0, gem: 0, items: [] });
    openPanelG('glPanelTrade');
  });

  GL.socket.on('trade_offer_updated', ({ userId, offer }) => {
    if (!GL.trade) return;
    if (userId !== GL.me._id) renderTheirOffer(offer);
    document.getElementById('glTradeMeConfirmed').style.display = 'none';
    document.getElementById('glTradePartnerConfirmed').style.display = 'none';
  });

  GL.socket.on('trade_confirmed', ({ userId }) => {
    if (!GL.trade) return;
    if (userId === GL.me._id) document.getElementById('glTradeMeConfirmed').style.display = 'inline';
    else document.getElementById('glTradePartnerConfirmed').style.display = 'inline';
  });

  GL.socket.on('trade_completed', async () => {
    Toast.success('Giao dịch thành công!');
    closePanelG('glPanelTrade'); GL.trade = null;
    const char = await GL.fetchCharacter(); GL.updateCurrencyUI(); GL.updateVitalsUI();
  });

  GL.socket.on('trade_failed', ({ message }) => { Toast.error(message); });
  GL.socket.on('trade_cancelled', () => { Toast.info('Giao dịch đã bị hủy'); closePanelG('glPanelTrade'); GL.trade = null; });
};
