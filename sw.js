const CACHE = 'socialshop-v6'; // v6 (2026-08-01): bump vì đã gỡ liquid-glass khỏi hầu hết trang + đổi
// query ?v= của global.css/feed.css/layout.js/api.js... — máy nào đang giữ cache CŨ (kể cả từ trước v5)
// phải bỏ hết, lấy lại bản mới hoàn toàn thay vì chỉ giữ 4 file trong STATIC dưới đây.
const STATIC = ['/css/global.css', '/css/feed.css', '/js/api.js', '/js/layout.js', '/manifest.json'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Đổi từ cache-first sang network-first: trước đây (cache-first) hễ đã cache 1
// lần là dùng mãi bản đó, KỂ CẢ SAU KHI DEPLOY BẢN MỚI — vì sw.js không đổi
// byte nào thì trình duyệt không coi là có bản service-worker mới, không chạy
// lại install/activate, nên cache cũ (đúng lỗi lần này: "đã deploy vẫn lỗi").
// Giờ luôn thử lấy mạng trước; chỉ dùng cache khi mất mạng (offline) — không
// còn phải nhớ bump version CACHE ở trên mỗi lần sửa CSS/JS nữa.
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
