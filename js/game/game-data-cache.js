// ============================================================================
// GL — namespace chung cho toàn bộ game G.Legendary
// ============================================================================
window.GL = {
  data: null,          // dữ liệu tĩnh: classes, continents, maps, monsters, weapons, armor...
  char: null,           // nhân vật hiện tại (từ server)
  me: null,             // user web hiện tại
  socket: null,
  map: null,            // định nghĩa map hiện tại (từ GL.data.maps)
  continent: null,
  monsters: [],         // quái đang sống trên map (client-side, respawn theo timer)
  summons: [],           // thú triệu hồi của Malakai đang hoạt động
  remote: {},           // userId -> {x,y,dir,moving,name,classId,level}
  player: { x: 400, y: 300, dir: 1, moving: false, attackCooldown: 0, skillCd: [0, 0], zone: 1 },
  fx: [],               // hiệu ứng nổi tạm thời (damage numbers, hit flash)
  selectedClass: null,
  camera: { x: 0, y: 0 },
  keys: {},
};
// GL.WORLD và GL.GROUND_Y được định nghĩa trong game-entities.js (mô hình hành lang ngang)

GL.fetchGameData = async function () {
  const res = await API.get('/game/data');
  if (!res?.success) throw new Error('Không tải được dữ liệu game');
  GL.data = res;
  return res;
};

GL.fetchCharacter = async function () {
  const res = await API.get('/game/character');
  if (!res?.success) throw new Error('Không tải được nhân vật');
  GL.char = res.character;
  return res.character;
};

GL.rarityColor = (r) => GL.data?.rarityColor?.[r] || '#B8B8C8';
GL.rarityLabel = (r) => GL.data?.rarityLabel?.[r] || r;

GL.mapById = (id) => GL.data.maps.find((m) => m.id === id);
GL.continentById = (id) => GL.data.continents.find((c) => c.id === id);
GL.classById = (id) => GL.data.classes[id];

GL.toast = function (text, cls = '') {
  const wrap = document.getElementById('glFloatToast');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'gl-toast-item ' + cls;
  el.textContent = text;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 1800);
};
