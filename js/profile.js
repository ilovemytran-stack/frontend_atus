// ===== PROFILE =====
const me = API.getCurrentUser();
const username = new URLSearchParams(location.search).get('u') || me?.username;
let profileUser = null;
let profileTab = 'posts';

document.addEventListener('DOMContentLoaded', () => {
  Layout.init();
  if (!username) return (location.href = 'login.html');
  loadProfile();
});

async function loadProfile() {
  const res = await API.get(`/users/${username}`);
  if (!res?.success) { Toast.error('Không tìm thấy người dùng'); return; }
  profileUser = res.user;
  renderProfile();
  loadPosts();
}

function renderProfile() {
  const u = profileUser;
  const isMe = me && me.username === u.username;

  document.getElementById('mobileTitle').textContent = u.displayName || u.username;
  document.getElementById('profileCover').innerHTML = u.coverPhoto
    ? `<img src="${u.coverPhoto}" alt="">`
    : '';
  if (isMe) document.getElementById('profileCover').onclick = () => document.getElementById('coverInput')?.click();

  document.getElementById('profileAvatar').src = avatarURL(u);
  if (isMe) document.getElementById('profileAvatar').onclick = () => openAvatarMenu();

  document.getElementById('profileDisplayName').textContent = u.displayName || u.username;
  document.getElementById('profileVerified').textContent = u.isVerified ? '✅' : '';
  document.getElementById('profileUsername').textContent = '@' + u.username;
  document.getElementById('profileBio').textContent = u.bio || '';

  const metaParts = [];
  if (u.location) metaParts.push(`📍 ${u.location}`);
  if (u.website) metaParts.push(`🔗 <a href="${u.website}" target="_blank" style="color:var(--text-link)">${u.website}</a>`);
  metaParts.push(`📅 Tham gia ${new Date(u.createdAt).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`);
  document.getElementById('profileMeta').innerHTML = metaParts.map(p => `<span>${p}</span>`).join('');

  document.getElementById('statPosts').querySelector('strong').textContent = formatNum(u.postsCount);
  document.getElementById('statFollowersNum').textContent = formatNum(u.followersCount);
  document.getElementById('statFollowingNum').textContent = formatNum(u.followingCount);

  const actions = document.getElementById('profileActions');
  if (isMe) {
    actions.innerHTML = `<button class="btn btn-secondary" onclick="openEditModal()">✏️ Chỉnh sửa</button>`;
  } else if (me) {
    actions.innerHTML = `
      <button class="btn ${u.isFollowing ? 'btn-secondary' : 'btn-primary'}" id="followBtn" onclick="toggleFollow()">${u.isFollowing ? 'Đang theo dõi' : 'Theo dõi'}</button>
      <button class="btn btn-secondary" onclick="startChat()">💬 Nhắn tin</button>`;
  } else {
    actions.innerHTML = `<a href="login.html" class="btn btn-primary">Theo dõi</a>`;
  }

  // hidden file inputs for avatar/cover
  if (isMe && !document.getElementById('avatarInput')) {
    document.body.insertAdjacentHTML('beforeend', `
      <input type="file" id="avatarInput" accept="image/*" style="display:none" onchange="onAvatarFileChosen(event)">
      <input type="file" id="coverInput" accept="image/*" style="display:none" onchange="uploadCover(event)">`);
  }
}

function triggerAvatarUpload() { document.getElementById('avatarInput').click(); }

// ===== Avatar action menu =====
function openAvatarMenu() {
  const hasAvatar = !!profileUser.avatar;
  document.getElementById('deleteAvatarBtn').style.display = hasAvatar ? '' : 'none';
  document.getElementById('avatarMenuModal').classList.add('active');
}
function closeAvatarMenu() { document.getElementById('avatarMenuModal').classList.remove('active'); }

async function deleteAvatar() {
  if (!confirm('Xóa ảnh đại diện hiện tại?')) return;
  const res = await API.delete('/users/profile/avatar');
  if (res?.success) {
    profileUser.avatar = '';
    API.saveUser(res.user);
    document.getElementById('profileAvatar').src = avatarURL(res.user);
    closeAvatarMenu();
    Toast.success('Đã xóa ảnh đại diện');
  } else {
    Toast.error(res?.message || 'Có lỗi xảy ra');
  }
}

// ===== Avatar crop (drag to pan, slider to zoom) =====
const cropState = { img: null, natW: 0, natH: 0, scale: 1, minScale: 1, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
const CROP_SIZE = 260;

// When a new file is chosen, open the crop modal instead of uploading directly
function onAvatarFileChosen(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => openCropModal(ev.target.result);
  reader.readAsDataURL(file);
  e.target.value = '';
}

function openCropModal(dataURL) {
  const img = document.getElementById('cropImage');
  cropState.img = img;
  img.onload = () => {
    cropState.natW = img.naturalWidth;
    cropState.natH = img.naturalHeight;
    cropState.minScale = Math.max(CROP_SIZE / cropState.natW, CROP_SIZE / cropState.natH);
    cropState.scale = cropState.minScale;
    document.getElementById('cropZoom').value = 100;
    centerCrop();
    applyCropTransform();
  };
  img.src = dataURL;
  document.getElementById('cropModal').classList.add('active');
  setupCropDrag();
}
function closeCropModal() { document.getElementById('cropModal').classList.remove('active'); }

function centerCrop() {
  cropState.x = (CROP_SIZE - cropState.natW * cropState.scale) / 2;
  cropState.y = (CROP_SIZE - cropState.natH * cropState.scale) / 2;
}

function applyCropTransform() {
  const img = cropState.img;
  img.style.width = (cropState.natW * cropState.scale) + 'px';
  img.style.height = (cropState.natH * cropState.scale) + 'px';
  img.style.transform = `translate(${cropState.x}px, ${cropState.y}px)`;
  clampCropPosition();
}

function clampCropPosition() {
  const w = cropState.natW * cropState.scale;
  const h = cropState.natH * cropState.scale;
  cropState.x = Math.min(0, Math.max(CROP_SIZE - w, cropState.x));
  cropState.y = Math.min(0, Math.max(CROP_SIZE - h, cropState.y));
  cropState.img.style.transform = `translate(${cropState.x}px, ${cropState.y}px)`;
}

let cropDragBound = false;
function setupCropDrag() {
  if (cropDragBound) return;
  cropDragBound = true;
  const stage = document.getElementById('cropStage');
  const zoom = document.getElementById('cropZoom');

  const start = (x, y) => { cropState.dragging = true; cropState.lastX = x; cropState.lastY = y; };
  const move = (x, y) => {
    if (!cropState.dragging) return;
    cropState.x += x - cropState.lastX;
    cropState.y += y - cropState.lastY;
    cropState.lastX = x; cropState.lastY = y;
    clampCropPosition();
  };
  const end = () => { cropState.dragging = false; };

  stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); start(e.clientX, e.clientY); });
  stage.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  zoom.addEventListener('input', () => {
    const pct = parseInt(zoom.value, 10) / 100;
    const cx = CROP_SIZE / 2, cy = CROP_SIZE / 2;
    const prevScale = cropState.scale;
    const newScale = cropState.minScale * pct;
    // keep the point under the center stable while zooming
    const imgCx = (cx - cropState.x) / prevScale;
    const imgCy = (cy - cropState.y) / prevScale;
    cropState.scale = newScale;
    cropState.x = cx - imgCx * newScale;
    cropState.y = cy - imgCy * newScale;
    applyCropTransform();
  });
}

async function confirmCrop() {
  const canvas = document.getElementById('cropCanvas');
  const OUT = 400;
  canvas.width = OUT; canvas.height = OUT;
  const ctx = canvas.getContext('2d');
  const ratio = OUT / CROP_SIZE;
  ctx.drawImage(
    cropState.img,
    -cropState.x / cropState.scale, -cropState.y / cropState.scale,
    CROP_SIZE / cropState.scale, CROP_SIZE / cropState.scale,
    0, 0, OUT, OUT
  );
  const btn = document.getElementById('cropConfirmBtn');
  loadingBtn(btn, true);
  canvas.toBlob(async (blob) => {
    const form = new FormData();
    form.append('avatar', blob, 'avatar.jpg');
    const res = await API.put('/users/profile/avatar', form, true);
    loadingBtn(btn, false);
    if (res?.success) {
      profileUser.avatar = res.user.avatar;
      API.saveUser(res.user);
      document.getElementById('profileAvatar').src = avatarURL(res.user);
      closeCropModal();
      Toast.success('Đã cập nhật ảnh đại diện');
    } else {
      Toast.error(res?.message || 'Có lỗi xảy ra');
    }
  }, 'image/jpeg', 0.92);
}

async function uploadCover(e) {
  const file = e.target.files[0];
  if (!file) return;
  const form = new FormData(); form.append('cover', file);
  const res = await API.put('/users/profile/cover', form, true);
  if (res?.success) {
    document.getElementById('profileCover').innerHTML = `<img src="${res.user.coverPhoto}" alt="">`;
    Toast.success('Đã cập nhật ảnh bìa');
  }
}

async function toggleFollow() {
  const res = await API.post(`/users/${profileUser._id}/follow`);
  if (res?.success) {
    profileUser.isFollowing = res.following;
    document.getElementById('followBtn').textContent = res.following ? 'Đang theo dõi' : 'Theo dõi';
    document.getElementById('followBtn').className = `btn ${res.following ? 'btn-secondary' : 'btn-primary'}`;
    const num = document.getElementById('statFollowersNum');
    num.textContent = formatNum((parseInt(profileUser.followersCount) || 0) + (res.following ? 1 : -1));
  }
}

async function startChat() {
  const res = await API.post('/chat/conversation', { userId: profileUser._id });
  if (res?.success) location.href = `messages.html?c=${res.conversation._id}`;
}

// Edit modal
const USERNAME_COOLDOWN_MS = 60 * 60 * 1000;

function openEditModal() {
  document.getElementById('editDisplayName').value = profileUser.displayName || '';
  document.getElementById('editUsername').value = profileUser.username || '';
  document.getElementById('editBio').value = profileUser.bio || '';
  document.getElementById('editWebsite').value = profileUser.website || '';
  document.getElementById('editLocation').value = profileUser.location || '';
  updateUsernameCooldownUI();
  document.getElementById('editModal').classList.add('active');
}
function closeEditModal() { document.getElementById('editModal').classList.remove('active'); }

function updateUsernameCooldownUI() {
  const input = document.getElementById('editUsername');
  const hint = document.getElementById('usernameHint');
  const last = profileUser.usernameChangedAt;
  if (!last) {
    input.disabled = false;
    hint.textContent = 'Chỉ đổi được 1 lần mỗi giờ.';
    return;
  }
  const elapsed = Date.now() - new Date(last).getTime();
  if (elapsed < USERNAME_COOLDOWN_MS) {
    const remainingMin = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / 60000);
    input.disabled = true;
    hint.textContent = `Bạn vừa đổi tên người dùng. Thử lại sau ${remainingMin} phút.`;
  } else {
    input.disabled = false;
    hint.textContent = 'Chỉ đổi được 1 lần mỗi giờ.';
  }
}

async function saveProfile() {
  const btn = document.getElementById('saveProfileBtn');
  loadingBtn(btn, true);

  const res = await API.put('/users/profile/update', {
    displayName: document.getElementById('editDisplayName').value.trim(),
    bio: document.getElementById('editBio').value.trim(),
    website: document.getElementById('editWebsite').value.trim(),
    location: document.getElementById('editLocation').value.trim(),
  });

  let mergedUser = res?.success ? res.user : null;
  let ok = !!res?.success;

  // Đổi username riêng (có giới hạn 1 lần / giờ ở backend)
  const newUsername = document.getElementById('editUsername').value.trim().toLowerCase();
  if (newUsername && newUsername !== profileUser.username) {
    const uRes = await API.put('/users/profile/username', { username: newUsername });
    if (uRes?.success) {
      mergedUser = { ...(mergedUser || profileUser), ...uRes.user };
      // Cập nhật URL để phản ánh username mới
      history.replaceState(null, '', `profile.html?u=${uRes.user.username}`);
    } else {
      ok = false;
      Toast.error(uRes?.message || 'Không thể đổi tên người dùng');
    }
  }

  loadingBtn(btn, false);

  if (mergedUser) {
    profileUser = { ...profileUser, ...mergedUser };
    API.saveUser(mergedUser);
    renderProfile();
  }
  if (ok) {
    closeEditModal();
    Toast.success('Đã cập nhật trang cá nhân');
  } else if (mergedUser) {
    updateUsernameCooldownUI();
  }
}

// Tabs
function switchProfileTab(tab) {
  profileTab = tab;
  document.querySelectorAll('.profile-tabs .feed-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('profilePosts').style.display = tab === 'posts' ? 'flex' : 'none';
  document.getElementById('profileVideos').style.display = tab === 'videos' ? 'grid' : 'none';
  if (tab === 'posts') loadPosts(); else loadVideos();
}

async function loadPosts() {
  const container = document.getElementById('profilePosts');
  container.innerHTML = '<div class="skeleton" style="height:150px;border-radius:16px"></div>';
  const res = await API.get(`/posts/user/${profileUser._id}`);
  container.innerHTML = '';
  if (res?.success && res.posts.length) {
    res.posts.forEach(p => renderProfilePost(p));
    document.getElementById('profileEmpty').style.display = 'none';
  } else {
    document.getElementById('profileEmpty').style.display = 'block';
  }
}

function renderProfilePost(post) {
  const div = document.createElement('div');
  div.className = 'post-card';
  const isLiked = me && post.likes?.includes(me._id);
  div.innerHTML = `
    <div class="post-header">
      <img src="${avatarURL(post.author)}" class="avatar avatar-md" alt="">
      <div class="post-header-info">
        <div class="post-author">${post.author.displayName || post.author.username}</div>
        <div class="post-meta">${timeAgo(post.createdAt)}</div>
      </div>
    </div>
    ${post.content ? `<div class="post-content">${post.content.replace(/</g,'&lt;')}</div>` : ''}
    ${post.images?.length ? `<div class="post-images count-${Math.min(post.images.length,4)}">${post.images.slice(0,4).map(img => `<img class="post-img" src="${img.url}" alt="">`).join('')}</div>` : ''}
    <div class="post-actions">
      <button class="post-action-btn ${isLiked ? 'liked' : ''}">${isLiked ? '❤️' : '🤍'} ${formatNum(post.likesCount)}</button>
      <button class="post-action-btn">💬 ${formatNum(post.commentsCount)}</button>
      <button class="post-action-btn">🔗 ${formatNum(post.sharesCount)}</button>
    </div>`;
  document.getElementById('profilePosts').appendChild(div);
}

async function loadVideos() {
  const container = document.getElementById('profileVideos');
  container.innerHTML = '';
  const res = await API.get(`/videos/user/${profileUser._id}`);
  if (res?.success && res.videos.length) {
    document.getElementById('profileEmpty').style.display = 'none';
    res.videos.forEach(v => {
      container.insertAdjacentHTML('beforeend', `
        <a href="videos.html" class="video-grid-item">
          <video src="${v.url}" muted preload="metadata"></video>
          <div class="video-grid-stats">▶ ${formatNum(v.viewsCount)}</div>
        </a>`);
    });
  } else {
    document.getElementById('profileEmpty').style.display = 'block';
  }
}

// Follow lists
async function openFollowList(type) {
  document.getElementById('followModalTitle').textContent = type === 'followers' ? 'Người theo dõi' : 'Đang theo dõi';
  document.getElementById('followModal').classList.add('active');
  const res = await API.get(`/users/${profileUser._id}/${type}`);
  const list = res?.success ? res[type] : [];
  document.getElementById('followList').innerHTML = list.length
    ? list.map(u => `
      <a href="profile.html?u=${u.username}" class="follow-list-item">
        <img src="${avatarURL(u)}" class="avatar avatar-md" alt="">
        <div class="follow-list-info">
          <div class="follow-list-name">${u.displayName || u.username}</div>
          <div class="follow-list-handle">@${u.username}</div>
        </div>
      </a>`).join('')
    : '<p style="text-align:center;color:var(--text-muted);padding:20px">Chưa có ai</p>';
}
function closeFollowModal() { document.getElementById('followModal').classList.remove('active'); }
