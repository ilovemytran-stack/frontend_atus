// ===== CHAT =====
if (!API.requireAuth()) {}
const me = API.getCurrentUser();
let socket = null;
let activeConversation = null;
let activePartner = null;
let typingTimeout = null;

const EMOJIS = ['😀','😂','🥰','😍','😘','😎','🤔','😢','😭','😡','👍','👎','❤️','🔥','🎉','👏','🙏','💯','😱','🤣','😅','🥳','😴','🤩','😇','🙄','😏','🤗','😋','🤤','🥺','😤'];

document.addEventListener('DOMContentLoaded', () => {
  Layout.init();
  setupSocket();
  loadConversations();
  renderEmojiPicker();

  // Open specific conversation from URL
  const convId = new URLSearchParams(location.search).get('c');
  if (convId) openConversation(convId);
});

function setupSocket() {
  socket = io(API_URL.replace('/api', ''), { auth: { userId: me._id } });

  socket.on('new_message', (data) => {
    if (data.conversationId === activeConversation?._id) {
      appendMessage(data.message);
      scrollChatToBottom();
    }
    loadConversations(); // refresh list with new last message
    if (data.conversationId !== activeConversation?._id) {
      Toast.info(`${data.message.sender?.displayName || 'Tin nhắn mới'}: ${data.message.content || '📷 Ảnh'}`);
    }
  });

  socket.on('user_online', ({ userId }) => updatePartnerStatus(userId, true));
  socket.on('user_offline', ({ userId }) => updatePartnerStatus(userId, false));

  socket.on('user_typing', ({ userId }) => {
    if (activePartner?._id === userId) document.getElementById('chatTyping').style.display = 'block';
  });
  socket.on('user_stop_typing', ({ userId }) => {
    if (activePartner?._id === userId) document.getElementById('chatTyping').style.display = 'none';
  });
}

function updatePartnerStatus(userId, online) {
  if (activePartner?._id === userId) {
    document.getElementById('chatPartnerStatus').textContent = online ? '🟢 Đang hoạt động' : 'Ngoại tuyến';
  }
}

async function loadConversations() {
  const res = await API.get('/chat/conversations');
  const container = document.getElementById('conversationList');
  if (!res?.success || !res.conversations.length) {
    document.getElementById('chatListEmpty').style.display = 'block';
    container.innerHTML = '';
    return;
  }
  document.getElementById('chatListEmpty').style.display = 'none';
  container.innerHTML = res.conversations.map(c => {
    const partner = c.participants.find(p => p._id !== me._id);
    if (!partner) return '';
    return `
      <div class="conv-item ${activeConversation?._id === c._id ? 'active' : ''}" onclick="openConversation('${c._id}')">
        <div class="conv-avatar-wrap">
          <img src="${avatarURL(partner)}" class="avatar avatar-md" alt="">
          ${partner.isOnline ? '<span class="online-dot"></span>' : ''}
        </div>
        <div class="conv-info">
          <div class="conv-name">${partner.displayName || partner.username}</div>
          <div class="conv-last-msg">${c.lastMessageText || 'Bắt đầu trò chuyện'}</div>
        </div>
        <div class="conv-time">${c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</div>
      </div>`;
  }).join('');
}

async function openConversation(convId) {
  const res = await API.get('/chat/conversations');
  const conv = res?.conversations?.find(c => c._id === convId);
  if (!conv) return;
  activeConversation = conv;
  activePartner = conv.participants.find(p => p._id !== me._id);

  socket.emit('join_conversation', convId);

  document.getElementById('chatEmpty').style.display = 'none';
  document.getElementById('chatActive').style.display = 'flex';
  document.getElementById('chatWindow').classList.add('show');
  document.getElementById('chatListPanel').classList.add('hide');

  document.getElementById('chatPartnerAvatar').src = avatarURL(activePartner);
  document.getElementById('chatPartnerName').textContent = activePartner.displayName || activePartner.username;
  document.getElementById('chatPartnerStatus').textContent = activePartner.isOnline ? '🟢 Đang hoạt động' : 'Ngoại tuyến';

  loadMessages(convId);
  loadConversations();
}

function closeChatWindow() {
  document.getElementById('chatWindow').classList.remove('show');
  document.getElementById('chatListPanel').classList.remove('hide');
}

async function loadMessages(convId) {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '<div class="skeleton" style="height:60px;border-radius:16px;margin-bottom:8px"></div>';
  const res = await API.get(`/chat/${convId}/messages`);
  container.innerHTML = '';
  if (res?.success) res.messages.forEach(appendMessage);
  scrollChatToBottom();
}

function appendMessage(msg) {
  const isMine = msg.sender._id === me._id || msg.sender === me._id;
  const div = document.createElement('div');
  div.className = `msg-row ${isMine ? 'mine' : ''}`;
  let content = '';
  if (msg.type === 'image' && msg.media?.url) content = `<div class="msg-bubble"><img src="${msg.media.url}" onclick="openImageView('${msg.media.url}')" alt=""></div>`;
  else content = `<div class="msg-bubble">${escapeHTML(msg.content || '')}</div>`;
  div.innerHTML = `${content}`;
  document.getElementById('chatMessages').appendChild(div);
}

function scrollChatToBottom() {
  const container = document.getElementById('chatMessages');
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !activeConversation) return;
  input.value = '';
  document.getElementById('emojiPicker').style.display = 'none';

  const res = await API.post(`/chat/${activeConversation._id}/messages`, { content: text, type: 'text' });
  if (res?.success) { appendMessage(res.message); scrollChatToBottom(); }
}

async function sendImageMessage(e) {
  const file = e.target.files[0];
  if (!file || !activeConversation) return;
  const form = new FormData();
  form.append('image', file);
  form.append('type', 'image');
  const res = await API.post(`/chat/${activeConversation._id}/messages`, form, true);
  if (res?.success) { appendMessage(res.message); scrollChatToBottom(); }
}

function handleChatKeydown(e) {
  if (e.key === 'Enter') sendMessage();
}

function handleTyping() {
  if (!activeConversation) return;
  socket.emit('typing', { conversationId: activeConversation._id, userId: me._id });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('stop_typing', { conversationId: activeConversation._id, userId: me._id }), 1500);
}

function toggleEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  picker.style.display = picker.style.display === 'none' ? 'grid' : 'none';
}

function renderEmojiPicker() {
  document.getElementById('emojiPicker').innerHTML = EMOJIS.map(e => `<button onclick="insertEmoji('${e}')">${e}</button>`).join('');
}

function insertEmoji(emoji) {
  const input = document.getElementById('chatInput');
  input.value += emoji;
  input.focus();
}

// Search users to start new chat
const searchUsersDebounced = debounce(async () => {
  const q = document.getElementById('userSearchInput').value.trim();
  const results = document.getElementById('userSearchResults');
  if (!q) { results.classList.remove('show'); return; }
  const res = await API.get(`/search?q=${encodeURIComponent(q)}&type=users`);
  if (res?.success && res.results.users?.length) {
    results.innerHTML = res.results.users.map(u => `
      <div class="user-search-item" onclick="startNewChat('${u._id}')">
        <img src="${avatarURL(u)}" class="avatar avatar-sm" alt="">
        <div>
          <div style="font-weight:600;font-size:0.88rem">${u.displayName || u.username}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">@${u.username}</div>
        </div>
      </div>`).join('');
    results.classList.add('show');
  } else { results.classList.remove('show'); }
}, 300);

async function startNewChat(userId) {
  document.getElementById('userSearchResults').classList.remove('show');
  document.getElementById('userSearchInput').value = '';
  const res = await API.post('/chat/conversation', { userId });
  if (res?.success) { await loadConversations(); openConversation(res.conversation._id); }
}

function openImageView(url) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  overlay.innerHTML = `<img src="${url}" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px">`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

function escapeHTML(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
