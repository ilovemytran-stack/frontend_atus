// ============================================================================
// Thách đấu Thần Linh (mỗi 10 cấp) — chiến đấu 1-1 trong không gian riêng
// ============================================================================
GL.duel = null; // { tier, continentId, god:{...}, godHp, godMaxHp, playerHp, playerMaxHp, timer }

function duelLog(text) {
  const log = document.getElementById('glDuelLog');
  const line = document.createElement('div');
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 40) log.removeChild(log.firstChild);
}

GL.startGodDuel = async function (tier) {
  const res = await API.post('/game/character/duel/start', { tier });
  if (!res?.success) { Toast.error(res?.message || 'Không thể bắt đầu thách đấu'); return; }
  const cls = GL.classById(GL.char.classId);
  GL.duel = {
    tier, continentId: res.duel.continentId, god: res.god,
    godHp: res.god.hp, godMaxHp: res.god.hp,
    playerHp: res.playerStats.hp, playerMaxHp: res.playerStats.hp,
    playerAtk: res.playerStats.atk, playerCrit: res.playerStats.crit, playerDef: res.playerStats.def,
    over: false,
  };
  document.getElementById('glDuelGodName').textContent = res.god.name;
  document.getElementById('glDuelGodPortrait').style.background = `${res.god.color} url(/assets/game/gods/${res.duel.continentId}.png) center/cover`;
  document.getElementById('glDuelPlayerName').textContent = GL.char.name;
  document.getElementById('glDuelPlayerPortrait').style.backgroundImage = `url(${cls.portrait})`;
  document.getElementById('glDuelLog').innerHTML = '';
  duelLog(`⚔️ Trận đấu với ${res.god.name} bắt đầu!`);
  updateDuelBars();
  closePanelG('glPanelNotif');
  openPanelG('glPanelDuel');

  clearInterval(GL.duel?.godTimer);
  GL.duel.godTimer = setInterval(godAutoAttack, 2400);
};

function updateDuelBars() {
  const d = GL.duel; if (!d) return;
  document.getElementById('glDuelGodHpFill').style.width = Math.max(0, d.godHp / d.godMaxHp * 100) + '%';
  document.getElementById('glDuelGodHpLabel').textContent = `${Math.max(0, Math.round(d.godHp))}/${d.godMaxHp}`;
  document.getElementById('glDuelPlayerHpFill').style.width = Math.max(0, d.playerHp / d.playerMaxHp * 100) + '%';
  document.getElementById('glDuelPlayerHpLabel').textContent = `${Math.max(0, Math.round(d.playerHp))}/${d.playerMaxHp}`;
}

function godAutoAttack() {
  const d = GL.duel; if (!d || d.over) return;
  const { dmg, crit } = GL.rollDamage(d.god.atk, d.playerDef, 5);
  d.playerHp = Math.max(0, d.playerHp - dmg);
  duelLog(`${d.god.name} tấn công bạn${crit ? ' (CHÍ MẠNG)' : ''}: -${dmg} HP`);
  updateDuelBars();
  if (d.playerHp <= 0) endDuel(false);
}

async function duelPlayerAttack(mult = 1, label = 'ĐÁNH') {
  const d = GL.duel; if (!d || d.over) return;
  const { dmg, crit } = GL.rollDamage(d.playerAtk * mult, d.god.def, d.playerCrit);
  d.godHp = Math.max(0, d.godHp - dmg);
  duelLog(`Bạn dùng ${label}${crit ? ' (CHÍ MẠNG)' : ''}: -${dmg} HP`);
  updateDuelBars();
  if (d.godHp <= 0) endDuel(true);
}

async function endDuel(won) {
  const d = GL.duel; if (!d || d.over) return;
  d.over = true;
  clearInterval(d.godTimer);
  duelLog(won ? `🎉 Bạn đã chiến thắng ${d.god.name}!` : `💀 Bạn đã gục ngã trước ${d.god.name}...`);
  const res = await API.post('/game/character/duel/resolve', { tier: d.tier, won });
  if (res?.success) {
    if (won) { GL.char = res.character; GL.updateVitalsUI(); }
    setTimeout(() => { Toast[won ? 'success' : 'info'](res.message); closePanelG('glPanelDuel'); GL.duel = null; }, 1200);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('glDuelAttackBtn').addEventListener('click', () => duelPlayerAttack(1, 'combo'));
  document.getElementById('glDuelSkill1').addEventListener('click', () => duelPlayerAttack(1.7, 'Chiêu 1'));
  document.getElementById('glDuelSkill2').addEventListener('click', () => duelPlayerAttack(2.7, 'Chiêu 2'));
  document.getElementById('glDuelFleeBtn').addEventListener('click', () => {
    if (GL.duel) { clearInterval(GL.duel.godTimer); GL.duel = null; }
    closePanelG('glPanelDuel');
  });
});
