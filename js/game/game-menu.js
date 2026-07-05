// ============================================================================
// Menu chính + Gắn Chiêu (chọn 2 trong số chiêu đã biết để hiện nút ngoài màn hình)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('glBtnMenu').addEventListener('click', () => openPanelG('glPanelMenu'));

  document.getElementById('glMenuBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open]');
    if (!btn) return;
    const target = btn.dataset.open;
    closePanelG('glPanelMenu');
    if (target.startsWith('glPanelInventory')) {
      const tab = target.split('-')[1] || 'equip';
      renderInventoryPanel(tab);
      openPanelG('glPanelInventory');
    } else if (target === 'glPanelMap') { renderMapPanel(); openPanelG('glPanelMap'); }
    else if (target === 'glPanelFriends') { loadFriends().then(() => renderFriendsPanel('list')); openPanelG('glPanelFriends'); }
    else if (target === 'glPanelNotif') { renderNotifPanel(); openPanelG('glPanelNotif'); }
  });

  document.getElementById('glMenuLoadout').addEventListener('click', () => {
    closePanelG('glPanelMenu');
    renderLoadoutPanel();
    openPanelG('glPanelLoadout');
  });

  document.getElementById('glMenuAccount').addEventListener('click', () => { window.location.href = `profile.html?u=${GL.me.username}`; });

  document.getElementById('glMenuExit').addEventListener('click', () => {
    if (confirm('Thoát game và về trang chủ?')) window.location.href = 'index.html';
  });
});

function renderLoadoutPanel() {
  const activeSkills = (GL.char.allSkills || []).filter((s) => s.type === 'active');
  const equipped = GL.char.effectiveEquippedSkills || [];
  const body = document.getElementById('glLoadoutBody');
  if (activeSkills.length <= 2) {
    body.innerHTML = `<div style="text-align:center;color:var(--gl-text-dim);padding:16px 0">Bạn chỉ có ${activeSkills.length} chiêu chủ động, cả 2 đều tự động hiện ngoài màn hình. Thắng thách đấu Thần Linh để học thêm chiêu và có thể chọn lựa!</div>`;
    return;
  }
  body.innerHTML = `<div style="font-size:.72rem;color:var(--gl-text-dim);margin-bottom:10px">Chọn đúng 2 chiêu để hiện ra nút ① ② ngoài màn hình chiến đấu.</div>` +
    activeSkills.map((s) => `
      <div class="gl-loadout-item ${equipped.includes(s.id) ? 'equipped' : ''}" data-loadoutpick="${s.id}">
        <div><b style="${s.color ? `color:${s.color}` : ''}">${s.name}</b><br><span style="color:var(--gl-text-dim);font-size:.65rem">${s.desc}</span></div>
        <span style="font-size:.68rem;color:var(--gl-xp)">${s.kiCost || 0} Ki</span>
      </div>`).join('');
  const picked = new Set(equipped);
  body.querySelectorAll('[data-loadoutpick]').forEach((el) => el.addEventListener('click', async () => {
    const id = el.dataset.loadoutpick;
    if (picked.has(id)) picked.delete(id);
    else { if (picked.size >= 2) { const first = picked.values().next().value; picked.delete(first); } picked.add(id); }
    if (picked.size === 2) {
      const res = await API.post('/game/character/equip-skills', { skillIds: Array.from(picked) });
      if (res?.success) { GL.char = res.character; Toast.success('Đã cập nhật chiêu ngoài màn hình'); GL.updateSkillButtonsUI(); }
    }
    renderLoadoutPanel();
  }));
}
