// ============================================================================
// Thần Linh & Boss Thế Giới — trạng thái dùng chung từ server (không mô phỏng riêng lẻ)
// ============================================================================
GL.worldBoss = null; // { mapId, form, hp, maxHp, singleFormMode }
GL.worldGod = null;  // { continentId, name, color, hp, maxHp }

GL.initWorldEventsSocket = function () {
  GL.socket.on('god_spawned', ({ continentId, name, color, hp, maxHp }) => {
    if (GL.map && GL.map.continentId === continentId && GL.map.role === 'god') {
      GL.worldGod = { continentId, name, color, hp, maxHp };
      GL.toast(`✨ ${name} đã xuất hiện tại đây!`, 'gl-toast-levelup');
    }
  });
  GL.socket.on('god_despawned', ({ continentId }) => {
    if (GL.worldGod?.continentId === continentId) { GL.toast(`${GL.worldGod.name} đã rời đi`); GL.worldGod = null; }
  });
  GL.socket.on('god_damaged', ({ continentId, hp, maxHp }) => {
    if (GL.worldGod?.continentId === continentId) { GL.worldGod.hp = hp; GL.worldGod.maxHp = maxHp; }
  });
  GL.socket.on('god_gift', ({ gold, gem, godName }) => {
    GL.char.gold += gold; GL.char.gem += gem;
    GL.updateCurrencyUI();
    GL.toast(`🙏 ${godName} ban thưởng +${gold}🪙 +${gem}💎`);
  });

  GL.socket.on('boss_spawned', ({ mapId, form, hp, maxHp, singleFormMode }) => {
    if (GL.map && GL.map.id === mapId) {
      GL.worldBoss = { mapId, form, hp, maxHp, singleFormMode };
      GL.toast('👑 CHAOSERAPH đã xuất hiện!', 'gl-toast-levelup');
    }
  });
  GL.socket.on('boss_despawned', () => { if (GL.worldBoss) { GL.toast('Chaoseraph đã biến mất'); GL.worldBoss = null; } });
  GL.socket.on('boss_hp_update', ({ hp, maxHp }) => { if (GL.worldBoss) { GL.worldBoss.hp = hp; GL.worldBoss.maxHp = maxHp; if (GL.selectedTarget === GL.worldBoss) GL.updateTargetFrame(); } });
  GL.socket.on('boss_form_changed', ({ form, hp, maxHp }) => {
    if (GL.worldBoss) { GL.worldBoss.form = form; GL.worldBoss.hp = hp; GL.worldBoss.maxHp = maxHp; GL.toast(`⚠️ Boss chuyển sang Dạng ${form}!`); }
  });
  GL.socket.on('boss_killed', () => { GL.toast('💀 CHAOSERAPH ĐÃ BỊ HẠ GỤC!', 'gl-toast-levelup'); GL.worldBoss = null; });
  GL.socket.on('boss_kill_reward', ({ vipCoin, drops }) => {
    GL.toast(`Phần thưởng: +${vipCoin} Xu VIP, +1 Đá Nâng Cấp${drops.length ? ', +' + drops.length + ' trang bị đặc biệt!' : ''}`);
  });

  // Thông báo boss TOÀN SERVER — biết cả khi không đứng đúng map
  GL.socket.on('world_boss_alert', (info) => {
    if (info.type === 'spawned') {
      GL.lastBossAlert = info;
      GL.toast(`👑 Chaoseraph xuất hiện tại ${info.continentName} · ${info.mapName}!`, 'gl-toast-levelup');
      document.getElementById('glNotifDot').style.display = 'block';
    } else {
      GL.lastBossAlert = null;
    }
  });
  GL.socket.on('world_boss_status', (status) => {
    GL.lastBossStatus = status;
    if (document.getElementById('glPanelNotif').style.display === 'flex') renderNotifPanel();
  });
};

// Gọi khi vào map để đồng bộ trạng thái thần/boss đang có sẵn (nếu server đã spawn từ trước khi mình vào)
GL.requestWorldState = function (mapId, zone) {
  GL.worldGod = null; GL.worldBoss = null;
  GL.socketEmit('world_state_request', { mapId, zone });
};

GL.lastBossAlert = null;
GL.requestBossStatus = function () {
  GL.socketEmit('world_boss_status_request', {});
};

// Boss/Thần đứng cố định tại 1 điểm nổi bật trên map, trên cùng đường ground (mô hình cuộn ngang)
GL.BOSS_SPOT = { x: 2200, y: GL.GROUND_Y };
GL.GOD_SPOT = { x: 1900, y: GL.GROUND_Y };

// Mục tiêu boss thế giới được ưu tiên hơn quái thường khi trong tầm đánh
GL.nearestBossTarget = function (range) {
  if (!GL.worldBoss) return null;
  const d = GL.distX(GL.BOSS_SPOT, GL.player);
  return d < range * 2.2 ? GL.worldBoss : null; // phạm vi rộng hơn quái thường vì boss là mục tiêu lớn
};
