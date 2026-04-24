// ======== GLOBAL STATE ========
let currentUser = null;
let currentChatUser = null;
let currentChatId = null;
let usersCache = {};

// ======== AUTH - Login pake Anonymous + Username ========
async function login() {
  const username = document.getElementById('username-input').value.trim();
  const errorDiv = document.getElementById('login-error');

  if (!username) {
    errorDiv.textContent = 'Isi username dulu anjir!';
    return;
  }

  if (username.length < 3) {
    errorDiv.textContent = 'Username minimal 3 karakter, bos!';
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errorDiv.textContent = 'Cuma huruf, angka, sama underscore!';
    return;
  }

  document.getElementById('login-btn').disabled = true;
  document.getElementById('login-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Masuk...';

  try {
    // Check username udah dipake belum
    const snapshot = await db.collection('users')
      .where('username', '==', username.toLowerCase())
      .get();

    if (!snapshot.empty && snapshot.docs[0].data().online) {
      errorDiv.textContent = 'Username lagi dipake orang, cari nama lain!';
      document.getElementById('login-btn').disabled = false;
      document.getElementById('login-btn').innerHTML = '<i class="fas fa-arrow-right"></i> Masuk';
      return;
    }

    // Login anonymous Firebase Auth
    const result = await auth.signInAnonymously();
    currentUser = {
      uid: result.user.uid,
      username: username.toLowerCase()
    };

    // Simpan/timpa user ke Firestore
    await db.collection('users').doc(currentUser.uid).set({
      username: currentUser.username,
      online: true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Listen perubahan auth state
    auth.onAuthStateChanged((user) => {
      if (!user) {
        forceLogout();
      }
    });

    // Setup presence (online/offline)
    setupPresence(currentUser.uid);

    // Masuk ke chat screen
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');
    document.getElementById('my-username').textContent = '@' + currentUser.username;
    document.getElementById('my-avatar').textContent = currentUser.username[0].toUpperCase();

    // Load user list
    loadUsers();
    listenUsers();

    console.log('Login sukses:', currentUser.username);

  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = 'Error bro: ' + error.message;
    document.getElementById('login-btn').disabled = false;
    document.getElementById('login-btn').innerHTML = '<i class="fas fa-arrow-right"></i> Masuk';
  }
}

// ======== Setup Presence ========
function setupPresence(uid) {
  const userRef = db.collection('users').doc(uid);
  
  // Set offline pas disconnect
  window.addEventListener('beforeunload', async () => {
    await userRef.update({ online: false, lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
  });
}

// ======== Load & Listen Users ========
function loadUsers() {
  db.collection('users').get().then(snapshot => {
    snapshot.forEach(doc => {
      if (doc.id !== currentUser.uid) {
        usersCache[doc.id] = doc.data();
      }
    });
    renderUserList();
  });
}

function listenUsers() {
  db.collection('users').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.doc.id !== currentUser.uid) {
        if (change.type === 'added' || change.type === 'modified') {
          usersCache[change.doc.id] = change.doc.data();
        } else if (change.type === 'removed') {
          delete usersCache[change.doc.id];
        }
      }
    });
    renderUserList();
  });
}

function renderUserList(filter = '') {
  const container = document.getElementById('online-users');
  container.innerHTML = '';

  const sortedUsers = Object.entries(usersCache)
    .filter(([id, data]) => data.username && data.username.includes(filter.toLowerCase()))
    .sort((a, b) => b[1].online - a[1].online);

  if (sortedUsers.length === 0) {
    container.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">Ga ada user nih...</p>';
    return;
  }

  sortedUsers.forEach(([id, data]) => {
    const div = document.createElement('div');
    div.className = 'user-item';
    if (currentChatUser === id) div.classList.add('active');
    div.onclick = () => openChat(id, data.username);
    div.innerHTML = `
      <div class="avatar" style="background: ${stringToColor(data.username)}">
        ${data.username[0].toUpperCase()}
        ${data.online ? '<div class="online-dot"></div>' : ''}
      </div>
      <div class="info">
        <div class="name">@${data.username} ${data.online ? '<span class="badge">online</span>' : ''}</div>
        <div class="last-msg">${data.online ? 'Online sekarang' : 'Offline'}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

function filterUsers() {
  const filter = document.getElementById('search-user').value;
  renderUserList(filter);
}

// ======== Open Chat ========
function openChat(userId, username) {
  currentChatUser = userId;
  document.getElementById('chat-username').textContent = '@' + username;
  document.getElementById('chat-avatar').textContent = username[0].toUpperCase();
  document.getElementById('chat-status').textContent = usersCache[userId]?.online ? 'online' : 'offline';

  // Generate chat ID (sorted biar konsisten)
  currentChatId = [currentUser.uid, userId].sort().join('_');

  document.getElementById('messages').innerHTML = '';
  document.getElementById('input-area').style.display = 'flex';

  renderUserList();
  listenMessages();

  // Mobile: hide sidebar
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('hidden');
  }
}

// ======== Listen Messages ========
let messageListener = null;
function listenMessages() {
  if (messageListener) messageListener();

  if (!currentChatId) return;

  messageListener = db.collection('chats')
    .doc(currentChatId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      const messagesDiv = document.getElementById('messages');
      messagesDiv.innerHTML = '';

      if (snapshot.empty) {
        messagesDiv.innerHTML = `
          <div class="no-chat">
            <i class="fas fa-comments"></i>
            <p>Belum ada pesan. Gas kirim duluan!</p>
          </div>`;
        return;
      }

      snapshot.forEach(doc => {
        const msg = doc.data();
        const isSent = msg.senderId === currentUser.uid;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        msgDiv.innerHTML = `
          ${!isSent ? `<div class="msg-sender">@${msg.senderUsername}</div>` : ''}
          <div>${escapeHTML(msg.text)}</div>
          <div class="msg-time">${formatTime(msg.timestamp)}</div>
        `;
        messagesDiv.appendChild(msgDiv);
      });

      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

// ======== Send Message ========
async function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();

  if (!text || !currentChatId || !currentChatUser) return;

  try {
    await db.collection('chats').doc(currentChatId).collection('messages').add({
      senderId: currentUser.uid,
      senderUsername: currentUser.username,
      text: text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update last message di chat metadata
    await db.collection('chats').doc(currentChatId).set({
      lastMessage: text,
      lastSender: currentUser.username,
      lastTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
      participants: [currentUser.uid, currentChatUser]
    }, { merge: true });

    input.value = '';
  } catch (error) {
    console.error('Gagal kirim:', error);
    alert('Gagal ngirim pesan, coba lagi!');
  }
}

function handleKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// ======== Toggle Sidebar (Mobile) ========
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hidden');
}

// ======== Logout ========
async function logout() {
  if (currentUser) {
    try {
      await db.collection('users').doc(currentUser.uid).update({
        online: false,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {}
  }

  await auth.signOut();
  forceLogout();
}

function forceLogout() {
  currentUser = null;
  currentChatUser = null;
  currentChatId = null;
  usersCache = {};
  if (messageListener) messageListener();
  messageListener = null;

  document.getElementById('chat-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('username-input').value = '';
  document.getElementById('login-btn').disabled = false;
  document.getElementById('login-btn').innerHTML = '<i class="fas fa-arrow-right"></i> Masuk';
  document.getElementById('login-error').textContent = '';
}

// ======== UTILS ========
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function stringToColor(str) {
  const colors = ['#e17055', '#00cec9', '#6c5ce7', '#fd79a8', '#fdcb6e', '#00b894', '#e84393', '#0984e3'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ======== INIT ========
window.onload = () => {
  document.getElementById('username-input').focus();
  document.getElementById('username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
};