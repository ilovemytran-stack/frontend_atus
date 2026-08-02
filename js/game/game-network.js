// ============================================================================
// Multiplayer thời gian thực qua Socket.io (dùng chung server socket đã có)
// ============================================================================
GL.initSocket = function () {
  GL.socket = io(API_URL.replace('/api', ''), { auth: { userId: GL.me._id } });

  GL.initTradeSocket();
  GL.initWorldEventsSocket();

  GL.socket.on('game_players_in_map', ({ players }) => {
    GL.remote = {};
    players.forEach((p) => { GL.remote[p.userId] = p; });
  });
  GL.socket.on('game_player_joined', ({ player }) => { GL.remote[player.userId] = player; });
  GL.socket.on('game_player_moved', ({ userId, x, y, dir, moving }) => {
    if (GL.remote[userId]) Object.assign(GL.remote[userId], { x, y, dir, moving });
  });
  GL.socket.on('game_player_left', ({ userId }) => { delete GL.remote[userId]; });
  GL.socket.on('game_player_attacked', ({ userId }) => {
    if (GL.remote[userId]) GL.remote[userId].attackFx = 0.2;
  });
  GL.socket.on('game_chat_message', ({ userId, name, text }) => GL.appendChat(userId, name, text));
  GL.socket.on('game_world_chat_message', ({ userId, name, text, expiresAt }) => GL.appendWorldChat(name, text, userId === GL.me._id, expiresAt));
  GL.socket.on('game_world_chat_error', ({ message }) => GL.toast(message, '', 'globe'));
  GL.socket.on('game_currency_update', ({ gold, gem }) => { if (GL.char) { GL.char.gold = gold; GL.char.gem = gem; GL.updateCurrencyUI(); } });
  GL.socket.on('game_guild_chat_message', ({ userId, name, text }) => {
    GL.guildChatHistory.push({ userId, name, text });
    while (GL.guildChatHistory.length > 60) GL.guildChatHistory.shift();
    GL.appendGuildChat(name, text, userId === GL.me._id);
  });

  // Hào Quang: người khác vừa phát "tiếng vang" gần đó -> nếu trong bán kính thì TỰ cộng buff +8%
  // sát thương cho bản thân (không cần server tính hộ, xem GL.auraDmgMult ở game-controls.js).
  GL.socket.on('game_aura_pulse_received', ({ userId }) => {
    const other = GL.remote[userId];
    if (!other) return;
    const d = GL.distX(other, GL.player);
    if (d > (GL.data.aura?.pulse?.radius || 150)) return;
    GL.auraDmgBuffUntil = performance.now() + (GL.data.aura?.pulse?.buffDurationSec || 8) * 1000;
    GL.nearbyAuraPulses.push({ userId, x: other.x, y: other.y, until: performance.now() + 1200 });
  });

  GL.socket.on('game_zone_assigned', ({ mapId, zone }) => {
    if (!GL.map || GL.map.id !== mapId) return;
    GL.player.zone = zone;
    GL.updateMapLabel();
    GL.requestWorldState(mapId, zone);
  });
  GL.socket.on('game_zone_list', ({ mapId, zones }) => GL.renderZonePopup(mapId, zones));
};

GL.socketEmit = function (evt, data) { if (GL.socket?.connected) GL.socket.emit(evt, data); };

GL.updateMapLabel = function () {
  const el = document.getElementById('glMapLabel');
  if (el) el.textContent = `${GL.continent.name} · ${GL.map.name} · Khu ${GL.player.zone}`;
};

GL.joinMap = function (map, zoneWanted) {
  GL.map = map;
  GL.continent = GL.continentById(map.continentId);
  GL.remote = {};
  GL.summons = [];
  GL.worldGod = null; GL.worldBoss = null;
  loadMapProps(map);
  GL.updateMapLabel();
  GL.spawnMonsters(map);
  GL.spawnPetsFromChar({ fresh: true });
  GL.socketEmit('game_leave_map', { mapId: GL.map.id });
  GL.socketEmit('game_join_map', {
    mapId: map.id,
    zone: zoneWanted,
    player: { name: GL.char.name, classId: GL.char.classId, level: GL.char.level, x: GL.player.x, y: GL.player.y, dir: 1, moving: false },
  });
  // world state được yêu cầu SAU khi server xác nhận zone (xem game_zone_assigned ở trên)
};

GL.changeZone = function (zone) {
  GL.socketEmit('game_change_zone', { mapId: GL.map.id, zone });
};

GL.requestZoneList = function () {
  GL.socketEmit('game_zone_list_request', { mapId: GL.map.id });
};

let lastSentPos = 0;
GL.maybeSendPosition = function (now) {
  if (now - lastSentPos < 90) return; // throttle ~11 lần/giây
  lastSentPos = now;
  GL.socketEmit('game_move', { mapId: GL.map.id, x: GL.player.x, y: GL.player.y, dir: GL.player.dir, moving: GL.player.moving });
};
