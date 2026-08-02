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
  pets: [],              // pet của NGƯỜI CHƠI HIỆN TẠI đang hoạt động trên map (từ char.pets, tối đa 2)
  remote: {},           // userId -> {x,y,dir,moving,name,classId,level}
  player: {
    x: 400, y: 300, dir: 1, moving: false, attackCooldown: 0, skillCd: [0, 0], zone: 1,
    // Nhảy/Bay (yêu cầu mới: joystick tròn kéo lên = nhảy, nút Bay = bay tốn Ki liên tục) — z/vz CHỈ
    // ảnh hưởng hiển thị (offset dọc lúc vẽ), toạ độ va chạm/tấn công vẫn dùng x/y như cũ (xem ghi chú
    // trong game-entities.js updateJumpFly để hiểu vì sao chọn cách này thay vì thêm hẳn 1 trục Y vật lý).
    z: 0, vz: 0, jumping: false, flying: false, flyKiTimer: 0,
    dashCd: 0, flyCd: 0,
  },
  fx: [],               // hiệu ứng nổi tạm thời (damage numbers, hit flash)
  selectedClass: null,
  camera: { x: 0, y: 0 },
  keys: {},
  auraPulseTimer: 0,     // đếm ngược tới lần phát "Tôn Sùng" tiếp theo (chỉ chạy khi char.hasAura)
  auraDmgBuffUntil: 0,   // performance.now() timestamp còn hiệu lực +8% sát thương (mục pulse Aura)
  nearbyAuraPulses: [],  // { userId, x, y, until } các "tiếng vang" Aura của người khác gần đây còn hiệu lực hiển thị
  deathFx: [],            // { category, defId, x, y, dir, until } quái vừa chết — chơi animation death rồi tự biến mất
  projectiles: [],        // { x1,y1,x2,y2, color, spawnedAt } hiệu ứng đường bắn của quái đánh xa (caster/archer)
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

GL.toast = function (text, cls = '', iconName = '') {
  const wrap = document.getElementById('glFloatToast');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'gl-toast-item ' + cls;
  if (iconName) el.insertAdjacentHTML('beforeend', GL.icon(iconName)); // icon là chuỗi do dev viết, an toàn
  const span = document.createElement('span');
  span.textContent = text; // text có thể echo lại nội dung chat của người dùng -> luôn qua textContent, không dùng innerHTML
  el.appendChild(span);
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 1800);
};
