// Aplikasi Chat Real-time dengan Firebase

class ChatApp {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.listeners = [];
        this.messagesListener = null;
        this.contactsListener = null;
        
        this.init();
    }
    
    init() {
        this.checkAuthState();
        this.setupEventListeners();
        this.setupUIListeners();
    }
    
    // ================= AUTHENTICATION =================
    
    checkAuthState() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.updateUserProfile(user);
                
                // Redirect based on current page
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage === 'index.html' || currentPage === '') {
                    window.location.href = 'contacts.html';
                } else {
                    this.loadUserData();
                }
            } else {
                // Redirect to login if not on login page
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage !== 'index.html' && currentPage !== '') {
                    window.location.href = 'index.html';
                }
            }
        });
    }
    
    async updateUserProfile(user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                // Create user profile if it doesn't exist
                const userId = this.generateUserId();
                await db.collection('users').doc(user.uid).set({
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || user.email.split('@')[0],
                    userId: userId,
                    status: 'online',
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    avatarColor: this.getRandomColor()
                });
            } else {
                // Update user status to online
                await db.collection('users').doc(user.uid).update({
                    status: 'online',
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error updating user profile:', error);
            this.showNotification('Error updating profile', 'error');
        }
    }
    
    generateUserId() {
        const prefix = 'USER';
        const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
        return prefix + randomStr;
    }
    
    getRandomColor() {
        const colors = ['#0088cc', '#25d366', '#ff6b6b', '#ffa502', '#2ed573', '#1e90ff', '#ff4757', '#3742fa'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    async login(email, password) {
        try {
            const loginBtn = document.getElementById('login-btn-text');
            const loginIcon = document.getElementById('login-btn-icon');
            
            loginBtn.textContent = 'Memproses...';
            loginIcon.className = 'fas fa-spinner fa-spin';
            
            await auth.signInWithEmailAndPassword(email, password);
            this.showNotification('Login berhasil!', 'success');
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification(this.getErrorMessage(error), 'error');
        } finally {
            if (document.getElementById('login-btn-text')) {
                document.getElementById('login-btn-text').textContent = 'Masuk';
                document.getElementById('login-btn-icon').className = 'fas fa-arrow-right';
            }
        }
    }
    
    async register(name, email, password) {
        try {
            const registerBtn = document.getElementById('register-btn-text');
            const registerIcon = document.getElementById('register-btn-icon');
            
            registerBtn.textContent = 'Mendaftarkan...';
            registerIcon.className = 'fas fa-spinner fa-spin';
            
            // Create user with email and password
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            
            // Update profile with name
            await userCredential.user.updateProfile({
                displayName: name
            });
            
            // Create user document in Firestore
            const userId = this.generateUserId();
            await db.collection('users').doc(userCredential.user.uid).set({
                uid: userCredential.user.uid,
                email: email,
                name: name,
                userId: userId,
                status: 'online',
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                avatarColor: this.getRandomColor()
            });
            
            this.showNotification('Pendaftaran berhasil!', 'success');
            
            // Auto login after registration
            await this.login(email, password);
        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification(this.getErrorMessage(error), 'error');
            
            if (document.getElementById('register-btn-text')) {
                document.getElementById('register-btn-text').textContent = 'Daftar Sekarang';
                document.getElementById('register-btn-icon').className = 'fas fa-user-plus';
            }
        }
    }
    
    async logout() {
        try {
            // Update status to offline
            if (this.currentUser) {
                await db.collection('users').doc(this.currentUser.uid).update({
                    status: 'offline',
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            await auth.signOut();
            this.currentUser = null;
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Error saat logout', 'error');
        }
    }
    
    // ================= CONTACTS MANAGEMENT =================
    
    async loadUserData() {
        if (!this.currentUser) return;
        
        // Load current user info
        const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            this.updateUIWithUserData(userData);
            
            // Setup real-time listener for user updates
            db.collection('users').doc(this.currentUser.uid)
                .onSnapshot((doc) => {
                    const updatedData = doc.data();
                    this.updateUIWithUserData(updatedData);
                });
        }
        
        // Load contacts
        this.loadContacts();
        
        // Load recent chats
        this.loadRecentChats();
    }
    
    updateUIWithUserData(userData) {
        // Update in contacts page
        const currentUserName = document.getElementById('current-user-name');
        const currentUserAvatar = document.getElementById('current-user-avatar');
        const userIdDisplay = document.getElementById('user-id-display');
        const sidebarUserName = document.getElementById('sidebar-user-name');
        const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
        
        if (currentUserName) {
            currentUserName.textContent = userData.name;
        }
        
        if (userIdDisplay) {
            userIdDisplay.textContent = userData.userId;
        }
        
        if (sidebarUserName) {
            sidebarUserName.textContent = userData.name;
        }
        
        // Update avatar with color
        const avatarElements = [currentUserAvatar, sidebarUserAvatar];
        avatarElements.forEach(avatar => {
            if (avatar) {
                avatar.style.background = userData.avatarColor || this.getRandomColor();
                avatar.innerHTML = `<i class="fas fa-user"></i>`;
            }
        });
    }
    
    async loadContacts() {
        if (!this.currentUser) return;
        
        try {
            // Get all users except current user
            this.contactsListener = db.collection('users')
                .where('uid', '!=', this.currentUser.uid)
                .onSnapshot((snapshot) => {
                    const contactsList = document.getElementById('contacts-list');
                    const contactsCount = document.getElementById('contacts-count');
                    const onlineCount = document.getElementById('online-count');
                    
                    if (!contactsList) return;
                    
                    contactsList.innerHTML = '';
                    
                    let onlineContacts = 0;
                    
                    snapshot.forEach((doc) => {
                        const user = doc.data();
                        const isOnline = user.status === 'online';
                        
                        if (isOnline) onlineContacts++;
                        
                        const contactItem = this.createContactItem(user);
                        contactsList.appendChild(contactItem);
                    });
                    
                    if (contactsCount) {
                        contactsCount.textContent = `${snapshot.size} kontak`;
                    }
                    
                    if (onlineCount) {
                        onlineCount.textContent = onlineContacts;
                    }
                    
                    // If no contacts, show empty state
                    if (snapshot.size === 0) {
                        contactsList.innerHTML = `
                            <div class="empty-contacts">
                                <i class="fas fa-users"></i>
                                <p>Belum ada kontak</p>
                                <p class="subtext">Mulai chat dengan mencari ID pengguna</p>
                            </div>
                        `;
                    }
                });
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    }
    
    createContactItem(user) {
        const div = document.createElement('div');
        div.className = 'contact-item';
        div.dataset.userId = user.uid;
        div.dataset.userData = JSON.stringify(user);
        
        div.innerHTML = `
            <div class="contact-avatar" style="background: ${user.avatarColor || this.getRandomColor()}">
                <i class="fas fa-user"></i>
            </div>
            <div class="contact-info">
                <div class="contact-name">${user.name}</div>
                <div class="contact-last-message">${user.status === 'online' ? 'Online' : 'Offline'}</div>
            </div>
            <div class="contact-meta">
                <div class="contact-time">${user.userId}</div>
                ${user.status === 'online' ? '<div class="online-indicator"></div>' : ''}
            </div>
        `;
        
        div.addEventListener('click', () => {
            this.startChat(user);
        });
        
        return div;
    }
    
    async loadRecentChats() {
        if (!this.currentUser) return;
        
        try {
            // Get recent chats where current user is a participant
            const chatsSnapshot = await db.collection('chats')
                .where('participants', 'array-contains', this.currentUser.uid)
                .orderBy('lastMessageAt', 'desc')
                .limit(10)
                .get();
            
            const recentChatsList = document.getElementById('recent-chats-list');
            if (!recentChatsList) return;
            
            recentChatsList.innerHTML = '';
            
            if (chatsSnapshot.empty) {
                recentChatsList.innerHTML = `
                    <div class="empty-recent-chats">
                        <p>Belum ada percakapan terbaru</p>
                    </div>
                `;
                return;
            }
            
            // Get user data for each participant
            for (const chatDoc of chatsSnapshot.docs) {
                const chatData = chatDoc.data();
                const otherParticipantId = chatData.participants.find(id => id !== this.currentUser.uid);
                
                if (otherParticipantId) {
                    const userDoc = await db.collection('users').doc(otherParticipantId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        const recentChatItem = this.createRecentChatItem(chatData, userData);
                        recentChatsList.appendChild(recentChatItem);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading recent chats:', error);
        }
    }
    
    createRecentChatItem(chatData, userData) {
        const div = document.createElement('div');
        div.className = 'recent-chat-item';
        div.dataset.chatId = chatData.chatId;
        div.dataset.userId = userData.uid;
        
        div.innerHTML = `
            <div class="recent-chat-avatar" style="background: ${userData.avatarColor || this.getRandomColor()}">
                <i class="fas fa-user"></i>
            </div>
            <div class="recent-chat-info">
                <div class="recent-chat-name">${userData.name}</div>
                <div class="recent-chat-last-message">${chatData.lastMessage || 'Belum ada pesan'}</div>
            </div>
            <div class="recent-chat-time">${this.formatTime(chatData.lastMessageAt?.toDate())}</div>
        `;
        
        div.addEventListener('click', () => {
            this.startChat(userData);
        });
        
        return div;
    }
    
    // ================= CHAT FUNCTIONALITY =================
    
    async startChat(user) {
        if (!this.currentUser) return;
        
        try {
            // Check if chat already exists
            const chatId = this.generateChatId(this.currentUser.uid, user.uid);
            const chatRef = db.collection('chats').doc(chatId);
            const chatDoc = await chatRef.get();
            
            let chatData;
            
            if (!chatDoc.exists) {
                // Create new chat
                chatData = {
                    chatId: chatId,
                    participants: [this.currentUser.uid, user.uid],
                    participantNames: {
                        [this.currentUser.uid]: this.currentUser.displayName || this.currentUser.email,
                        [user.uid]: user.name
                    },
                    participantIds: {
                        [this.currentUser.uid]: this.currentUser.uid,
                        [user.uid]: user.uid
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: null,
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    unreadCount: {
                        [this.currentUser.uid]: 0,
                        [user.uid]: 0
                    }
                };
                
                await chatRef.set(chatData);
                
                // Create initial system message
                await db.collection('chats').doc(chatId).collection('messages').add({
                    senderId: 'system',
                    senderName: 'System',
                    content: `Percakapan dimulai antara ${this.currentUser.displayName || this.currentUser.email} dan ${user.name}`,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    type: 'system'
                });
            } else {
                chatData = chatDoc.data();
            }
            
            // Store current chat info
            this.currentChat = {
                chatId: chatId,
                userId: user.uid,
                userData: user
            };
            
            // Navigate to chat page
            window.location.href = `chat.html?chatId=${chatId}`;
            
        } catch (error) {
            console.error('Error starting chat:', error);
            this.showNotification('Error memulai chat', 'error');
        }
    }
    
    generateChatId(userId1, userId2) {
        // Generate consistent chat ID regardless of order
        const sortedIds = [userId1, userId2].sort();
        return `chat_${sortedIds[0]}_${sortedIds[1]}`;
    }
    
    async loadChat(chatId) {
        if (!this.currentUser || !chatId) return;
        
        try {
            // Get chat data
            const chatDoc = await db.collection('chats').doc(chatId).get();
            if (!chatDoc.exists) {
                this.showNotification('Chat tidak ditemukan', 'error');
                return;
            }
            
            const chatData = chatDoc.data();
            this.currentChat = {
                chatId: chatId,
                userId: chatData.participants.find(id => id !== this.currentUser.uid),
                chatData: chatData
            };
            
            // Get other user's data
            const otherUserId = this.currentChat.userId;
            const userDoc = await db.collection('users').doc(otherUserId).get();
            if (userDoc.exists) {
                this.currentChat.userData = userDoc.data();
                this.updateChatUI(this.currentChat.userData);
            }
            
            // Load messages
            this.loadMessages(chatId);
            
            // Setup real-time listener for new messages
            this.setupMessageListener(chatId);
            
        } catch (error) {
            console.error('Error loading chat:', error);
            this.showNotification('Error memuat chat', 'error');
        }
    }
    
    updateChatUI(userData) {
        // Update chat header
        const partnerName = document.getElementById('partner-name');
        const partnerAvatar = document.getElementById('partner-avatar');
        const partnerStatus = document.getElementById('partner-status');
        const infoName = document.getElementById('info-name');
        const infoAvatar = document.getElementById('info-avatar');
        const infoUserId = document.getElementById('info-user-id');
        const infoStatus = document.getElementById('info-status');
        
        if (partnerName) partnerName.textContent = userData.name;
        if (partnerStatus) partnerStatus.textContent = userData.status === 'online' ? 'Online' : 'Offline';
        if (infoName) infoName.textContent = userData.name;
        if (infoStatus) infoStatus.textContent = userData.status === 'online' ? 'Online' : 'Offline';
        if (infoUserId) infoUserId.textContent = userData.userId;
        
        // Update avatars
        const avatarElements = [partnerAvatar, infoAvatar];
        avatarElements.forEach(avatar => {
            if (avatar) {
                avatar.style.background = userData.avatarColor || this.getRandomColor();
                avatar.innerHTML = `<i class="fas fa-user"></i>`;
            }
        });
    }
    
    async loadMessages(chatId) {
        try {
            const messagesSnapshot = await db.collection('chats').doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'asc')
                .limit(50)
                .