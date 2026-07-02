// ===== FEED =====
let currentTab = 'following';
let page = 1;
let loading = false;
let hasMore = true;
let selectedImages = [];
let selectedVideo = null;
const user = API.getCurrentUser();

document.addEventListener('DOMContentLoaded', () => {
  Layout.init();
  if (user) {
    document.getElementById('createBar').style.display = 'flex';
    document.getElementById('myAvatar').src = avatarURL(user);
    document.getElementById('myAvatar').parentElement.style.display = 'flex';
    document.getElementById('modalAvatar').src = avatarURL(user);
    document.getElementById('modalUsername').textContent = user.displayName || user.username;
  }
  loadFeed();
  loadSuggestedUsers();
  setupInfiniteScroll();
  setupSocket();
});

async function loadFeed(reset = true) {
  if (loading) return;
  if (reset) { page = 1; hasMore = true; document.getElementById('feed').innerHTML = ''; }
  if (!hasMore) return;

  loading = true;
  document.getElementById('feedLoader').style.display = 'block';
  document.getElementById('feedEnd').style.display = 'none';

  const endpoint = currentTab === 'following' && user
    ? `/feed/following?page=${page}&limit=10`
    : `/feed/explore?page=${page}&limit=10`;

  const res = await API.get(endpoint);
  loading = false;
  document.getElementById('feedLoader').style.display = 'none';

  if (res?.success) {
    const isFirstLoad = page === 1;
    if (isFirstLoad && res.posts.length === 0) {
      document.getElementById('feed').innerHTML = currentTab === 'following'
        ? `<div class="empty-state">
             <div class="empty-state-icon">${Icon.user}</div>
             <div class="empty-state-title">Chưa có bài viết nào để hiện</div>
             <div class="empty-state-text">Theo dõi thêm vài người để lấp đầy trang chủ, hoặc thử tab Đề xuất.</div>
           </div>`
        : `<div class="empty-state">
             <div class="empty-state-icon">${Icon.search}</div>
             <div class="empty-state-title">Chưa có bài viết đề xuất</div>
             <div class="empty-state-text">Quay lại sau khi cộng đồng đăng thêm bài viết nhé.</div>
           </div>`;
      hasMore = false;
      return;
    }
    res.posts.forEach((p, i) => renderPost(p, i));
    hasMore = res.hasMore;
    page++;
    if (!hasMore) document.getElementById('feedEnd').style.display = 'block';
  }
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  loadFeed(true);
}

function renderPost(post, index = 0) {
  const isLiked = user && post.likes?.includes(user._id);
  const card = document.createElement('div');
  card.className = 'post-card';
  card.id = `post-${post._id}`;
  card.style.animationDelay = `${Math.min(index, 6) * 0.06}s`;
  card.innerHTML = `
    <div class="post-header">
      <a href="profile.html?u=${post.author.username}">
        <img src="${avatarURL(post.author)}" class="avatar avatar-md" alt="">
      </a>
      <div class="post-header-info">
        <div class="post-author">
          <a href="profile.html?u=${post.author.username}">${post.author.displayName || post.author.username}</a>
          ${post.author.isVerified ? '<span title="Đã xác minh">✅</span>' : ''}
        </div>
        <div class="post-meta">${timeAgo(post.createdAt)}</div>
      </div>
      ${user?._id === post.author._id ? `<button class="btn btn-ghost btn-icon post-more-btn" onclick="deletePost('${post._id}')">🗑</button>` : ''}
    </div>
    ${post.content ? `<div class="post-content ${!post.images?.length && !post.video ? (post.content.length < 120 ? 'large' : '') : ''}">${escapeHTML(post.content)}</div>` : ''}
    ${renderPostMedia(post)}
    <div class="post-actions">
      <button class="post-action-btn ${isLiked ? 'liked' : ''}" id="like-${post._id}" onclick="likePost('${post._id}', this)">
        <span class="like-icon">${isLiked ? '❤️' : '🤍'}</span>
        <span id="likes-${post._id}">${formatNum(post.likesCount)}</span>
      </button>
      <button class="post-action-btn" onclick="toggleComments('${post._id}')">
        💬 <span>${formatNum(post.commentsCount)}</span>
      </button>
      <button class="post-action-btn" onclick="sharePost('${post._id}')">
        🔗 <span>${formatNum(post.sharesCount)}</span>
      </button>
    </div>
    <div class="post-comments" id="comments-${post._id}" style="display:none">
      ${user ? `<div class="comment-input-row">
        <img src="${avatarURL(user)}" class="avatar avatar-xs" alt="">
        <input class="comment-input" placeholder="Viết bình luận..." onkeydown="if(event.key==='Enter')submitComment('${post._id}',this)">
      </div>` : ''}
      <div id="comment-list-${post._id}">
        ${(post.comments?.slice(-3) || []).map(renderComment).join('')}
      </div>
    </div>`;
  document.getElementById('feed').appendChild(card);
}

function renderPostMedia(post) {
  if (post.video?.url) return `<video class="post-video" src="${post.video.url}" controls preload="metadata" poster="${post.video.thumbnail || ''}"></video>`;
  if (post.images?.length) {
    const count = Math.min(post.images.length, 4);
    return `<div class="post-images count-${count}">
      ${post.images.slice(0, 4).map((img, i) => `<img class="post-img" src="${img.url}" alt="" loading="lazy" onclick="openLightbox('${img.url}')">`).join('')}
    </div>`;
  }
  return '';
}

function renderComment(c) {
  return `<div class="comment-item">
    <a href="profile.html?u=${c.user?.username}"><img src="${avatarURL(c.user)}" class="avatar avatar-xs" alt=""></a>
    <div class="comment-bubble">
      <div class="comment-author">${c.user?.displayName || c.user?.username}</div>
      <div class="comment-text">${escapeHTML(c.text)}</div>
      <div class="comment-time">${timeAgo(c.createdAt)}</div>
    </div>
  </div>`;
}

function toggleComments(postId) {
  const el = document.getElementById(`comments-${postId}`);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function likePost(postId, btn) {
  if (!user) return (location.href = 'login.html');
  const res = await API.post(`/posts/${postId}/like`);
  if (res?.success) {
    btn.classList.toggle('liked', res.liked);
    btn.querySelector('.like-icon').textContent = res.liked ? '❤️' : '🤍';
    document.getElementById(`likes-${postId}`).textContent = formatNum(res.likesCount);
    if (res.liked) btn.querySelector('.like-icon').style.animation = 'none', requestAnimationFrame(() => btn.querySelector('.like-icon').style.animation = '');
  }
}

async function submitComment(postId, input) {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const res = await API.post(`/posts/${postId}/comment`, { text });
  if (res?.success) {
    const list = document.getElementById(`comment-list-${postId}`);
    list.insertAdjacentHTML('beforeend', renderComment(res.comment));
    list.lastElementChild.scrollIntoView({ behavior: 'smooth' });
  }
}

async function deletePost(postId) {
  if (!confirm('Xóa bài viết này?')) return;
  const res = await API.delete(`/posts/${postId}`);
  if (res?.success) { document.getElementById(`post-${postId}`)?.remove(); Toast.success('Đã xóa bài viết'); }
}

async function sharePost(postId) {
  await API.post(`/posts/${postId}/share`);
  if (navigator.share) { navigator.share({ url: location.origin + '/post.html?id=' + postId }); }
  else { navigator.clipboard.writeText(location.origin + '/post.html?id=' + postId); Toast.success('Đã sao chép link'); }
}

// Create post
function openCreateModal(type) {
  if (!user) return (location.href = 'login.html');
  document.getElementById('createModal').classList.add('active');
  if (type === 'image') document.getElementById('imageInput').click();
  if (type === 'video') document.getElementById('videoInput').click();
}
function closeCreateModal() {
  document.getElementById('createModal').classList.remove('active');
  document.getElementById('postContent').value = '';
  document.getElementById('imagePreviewContainer').innerHTML = '';
  document.getElementById('videoPreviewContainer').innerHTML = '';
  selectedImages = []; selectedVideo = null;
}

function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  selectedImages = files.slice(0, 10);
  const container = document.getElementById('imagePreviewContainer');
  container.innerHTML = selectedImages.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="preview-img-wrap"><img src="${url}" alt=""><div class="preview-remove" onclick="removePreviewImg(${i})">✕</div></div>`;
  }).join('');
}

function removePreviewImg(i) { selectedImages.splice(i, 1); handleImageSelect({ target: { files: selectedImages } }); }

function handleVideoSelect(e) {
  selectedVideo = e.target.files[0];
  if (!selectedVideo) return;
  const url = URL.createObjectURL(selectedVideo);
  document.getElementById('videoPreviewContainer').innerHTML = `<video src="${url}" controls style="width:100%;border-radius:var(--radius-sm);max-height:200px"></video>`;
}

async function submitPost() {
  const content = document.getElementById('postContent').value.trim();
  if (!content && !selectedImages.length && !selectedVideo) return Toast.error('Vui lòng nhập nội dung hoặc chọn media');
  const btn = document.getElementById('postSubmitBtn');
  loadingBtn(btn, true);

  const form = new FormData();
  form.append('content', content);
  selectedImages.forEach(f => form.append('images', f));
  if (selectedVideo) form.append('video', selectedVideo);
  form.append('type', selectedVideo ? 'video' : selectedImages.length ? 'image' : 'text');

  const endpoint = selectedVideo ? '/videos' : '/posts';
  const res = await API.post(endpoint, form, true);
  loadingBtn(btn, false);

  if (res?.success) {
    closeCreateModal();
    Toast.success('Đăng bài thành công! 🎉');
    if (!selectedVideo) { const feed = document.getElementById('feed'); const temp = document.createElement('div'); renderPost({ ...res.post, likes: [], comments: [] }); }
    else { loadFeed(true); }
  } else { Toast.error(res?.message || 'Đăng bài thất bại'); }
}

// Suggested users
async function loadSuggestedUsers() {
  const res = await API.get('/feed/suggested-users');
  if (!res?.success) return;
  const container = document.getElementById('suggestedUsers');
  container.innerHTML = `<div class="suggested-section">
    <div class="suggested-title">Gợi ý theo dõi</div>
    ${res.users.map(u => `
      <div class="suggested-user">
        <a href="profile.html?u=${u.username}"><img src="${avatarURL(u)}" class="avatar avatar-sm" alt=""></a>
        <div class="suggested-user-info">
          <a href="profile.html?u=${u.username}" class="suggested-user-name">${u.displayName || u.username}</a>
          <div class="suggested-user-meta">${formatNum(u.followersCount)} người theo dõi</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="followUser('${u._id}', this)">Theo dõi</button>
      </div>`).join('')}
  </div>`;
}

async function followUser(userId, btn) {
  if (!user) return (location.href = 'login.html');
  const res = await API.post(`/users/${userId}/follow`);
  if (res?.success) btn.textContent = res.following ? 'Đang theo dõi' : 'Theo dõi';
}

// Infinite scroll
function setupInfiniteScroll() {
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !loading && hasMore) loadFeed(false);
  }, { threshold: 0.1 });
  const sentinel = document.createElement('div'); sentinel.style.height = '1px';
  document.getElementById('feed').after(sentinel);
  observer.observe(sentinel);
}

// Socket.io real-time
function setupSocket() {
  if (!user || typeof io === 'undefined') return;
  const socket = io(API_URL.replace('/api', ''), { auth: { userId: user._id } });
  socket.on('notification', (data) => {
    const msgs = { like: '❤️ đã thích bài viết của bạn', comment: '💬 đã bình luận bài viết của bạn', follow: '👤 đã theo dõi bạn' };
    Toast.info(`${data.sender?.displayName} ${msgs[data.type] || ''}`);
  });
}

// Lightbox
function openLightbox(url) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  overlay.innerHTML = `<img src="${url}" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px">`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
