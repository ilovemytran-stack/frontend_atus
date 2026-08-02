// Gợn sóng nhẹ khi bấm cho .glass-btn (phản hồi chạm thông thường, không còn
// hiệu ứng "ánh sáng bám con trỏ" của bản kính mờ cũ vì .glass giờ là mặt phẳng đặc).
// Tự tắt hoàn toàn nếu người dùng bật "giảm chuyển động".
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  function attachRipple(el) {
    el.addEventListener('pointerdown', function (e) {
      var r = el.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 1.4;
      var span = document.createElement('span');
      span.className = 'lg-ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - r.left - size / 2) + 'px';
      span.style.top = (e.clientY - r.top - size / 2) + 'px';
      var prevPos = getComputedStyle(el).position;
      if (prevPos === 'static') el.style.position = 'relative';
      el.appendChild(span);
      span.addEventListener('animationend', function () { span.remove(); });
    });
  }

  function init() {
    document.querySelectorAll('.glass-btn').forEach(attachRipple);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Sidebar/bottom-nav do layout.js render SAU khi trang tải xong, nên quan
  // sát DOM để tự gắn hiệu ứng cho phần tử mới xuất hiện thay vì chỉ chạy 1 lần.
  var mo = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('.glass-btn')) attachRipple(node);
        if (node.querySelectorAll) node.querySelectorAll('.glass-btn').forEach(attachRipple);
      });
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
