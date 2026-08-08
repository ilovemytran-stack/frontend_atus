// ============================================================================
// Thần Linh & Boss Thế Giới — trạng thái dùng chung từ server (không mô phỏng riêng lẻ). Giờ có TỐI ĐA
// 4 ChaosLord cùng lúc ở 4 map cuối khác nhau — client chỉ cần quan tâm con đang ở ĐÚNG map mình đứng
// (server đã lọc theo mapId), nên GL.worldBoss vẫn là 1 object duy nhất ("boss trên map hiện tại").
// ============================================================================
GL.worldBoss = null; // { mapId, form, hp, maxHp, singleFormMode }
GL.worldGod = null;  // { continentId, name, color, hp, maxHp }

GL.initWorldEventsSocket = function () {
  GL.socket.on('god_spawned', ({ continentId, name, color, hp, maxHp }) => {
    if (GL.map && GL.map.continentId === continentId && GL.map.role === 'god') {
      GL.worldGod = { continentId, name, color, hp, maxHp };
      GL.toast(`${name} đã xuất hiện tại đây!`, 'gl-toast-levelup', 'sparkles');
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
    GL.toast(`${godName} ban thưởng +${gold} Vàng +${gem} Ngọc`, '', 'hands');
  });

  GL.socket.on('boss_spawned', ({ mapId, form, hp, maxHp, singleFormMode }) => {
    if (GL.map && GL.map.id === mapId) {
      GL.worldBoss = { mapId, form, hp, maxHp, singleFormMode };
      GL.toast('CHAOSERAPH đã xuất hiện!', 'gl-toast-levelup', 'crown');
    }
  });
  GL.socket.on('boss_despawned', ({ mapId }) => { if (GL.worldBoss?.mapId === mapId) { GL.toast('Chaoseraph đã biến mất'); GL.worldBoss = null; } });
  GL.socket.on('boss_hp_update', ({ mapId, hp, maxHp }) => { if (GL.worldBoss?.mapId === mapId) { GL.worldBoss.hp = hp; GL.worldBoss.maxHp = maxHp; if (GL.selectedTarget === GL.worldBoss) GL.updateTargetFrame(); } });
  GL.socket.on('boss_form_changed', ({ mapId, form, hp, maxHp }) => {
    if (GL.worldBoss?.mapId === mapId) { GL.worldBoss.form = form; GL.worldBoss.hp = hp; GL.worldBoss.maxHp = maxHp; GL.toast(`Boss chuyển sang Dạng ${form}!`, '', 'warning'); }
  });
  GL.socket.on('boss_killed', ({ mapId }) => { if (GL.worldBoss?.mapId === mapId) { GL.toast('CHAOSERAPH ĐÃ BỊ HẠ GỤC!', 'gl-toast-levelup', 'skull'); GL.worldBoss = null; } });
  GL.socket.on('boss_kill_reward', async ({ vipCoin, drops, petGained }) => {
    GL.toast(`Phần thưởng: +${vipCoin} Xu VIP, +1 Đá Nâng Cấp${drops.length ? ', +' + drops.length + ' trang bị/pet quý!' : ''}`);
    if (petGained) GL.toast(`Chúc mừng! Bạn nhận được pet: ${GL.data.pets[petGained]?.name || petGained}!`, 'gl-toast-levelup', 'paw');
    await GL.fetchCharacter(); // đồng bộ lại inventory/pet mới nhận — trước đây không refetch nên drop không hiện ngay
    GL.spawnPetsFromChar();
    GL.updateVitalsUI(); GL.updateCurrencyUI();
  });
  // ChaosLord và Thần Linh CHẠM TRÁN thật (2 chiều gây sát thương lẫn nhau, mỗi 3s) khi cùng map+khu vực
  // — hiện hiệu ứng va chạm cho ai đang đứng xem, không chỉ cập nhật số máu khô khan.
  GL.socket.on('boss_vs_god_clash', ({ mapId, godName, dmgToGod, dmgToBoss }) => {
    if (GL.map?.id !== mapId) return;
    GL.spawnDamageNumber(GL.GOD_SPOT.x, GL.GOD_SPOT.y - 60, dmgToGod, 'gl-crit');
    GL.spawnDamageNumber(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y - 90, dmgToBoss, 'gl-crit');
    GL.spawnProjectile(GL.BOSS_SPOT.x, GL.BOSS_SPOT.y - 60, GL.GOD_SPOT.x, GL.GOD_SPOT.y - 60, '#E85C4C');
    GL.spawnProjectile(GL.GOD_SPOT.x, GL.GOD_SPOT.y - 60, GL.BOSS_SPOT.x, GL.BOSS_SPOT.y - 60, '#8FCFE8');
    GL.appendChat('world_event', 'Hệ Thống', `⚔️ ChaosLord & ${godName} đang giao chiến!`);
  });

  // Thông báo boss TOÀN SERVER — biết cả khi không đứng đúng map. Giờ 4 con spawn cùng lúc nên
  // "locations" là mảng (trước đây chỉ 1 mapId/mapName/continentName).
  GL.socket.on('world_boss_alert', (info) => {
    if (info.type === 'spawned') {
      GL.lastBossAlert = info;
      const names = info.locations.map((l) => `${l.continentName} · ${l.mapName}`).join(', ');
      GL.toast(`Chaoseraph xuất hiện đồng thời tại 4 nơi: ${names}!`, 'gl-toast-levelup', 'crown');
      document.getElementById('glNotifDot').style.display = 'block';
    } else {
      if (GL.lastBossAlert?.locations) GL.lastBossAlert.locations = GL.lastBossAlert.locations.filter((l) => l.mapId !== info.mapId);
      if (!GL.lastBossAlert?.locations?.length) GL.lastBossAlert = null;
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
