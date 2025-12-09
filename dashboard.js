let socket = null;
let currentToken = null;

function connectSocket(token) {
    if (socket) socket.disconnect();
    socket = io({ query: { token } });
    socket.on('console-update', (data) => {
        addConsoleLine(`[${data.time.split('T')[1].split('.')[0]}] ${data.message}`);
    });
    socket.on('console-history', (logs) => {
        logs.forEach(log => {
            addConsoleLine(`[${log.time.split('T')[1].split('.')[0]}] ${log.message}`);
        });
    });
}

function addConsoleLine(text) {
    const consoleEl = document.getElementById('consoleOutput');
    const line = document.createElement('div');
    line.className = 'console-line';
    line.textContent = text;
    if (text.includes('✅')) line.classList.add('text-green-400');
    if (text.includes('❌')) line.classList.add('text-red-400');
    if (text.includes('⚠️')) line.classList.add('text-yellow-400');
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

async function startBot() {
    const token = document.getElementById('botToken').value.trim();
    if (!token) return alert('Masukkan bot token!');
    
    currentToken = token;
    connectSocket(token);
    
    const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (data.success) {
        addConsoleLine(`✅ Bot started successfully (PID: ${data.pid})`);
        document.getElementById('status-indicator').textContent = 'ONLINE';
        document.getElementById('status-indicator').className = 'font-bold text-green-400';
        updateActiveBots();
    } else {
        addConsoleLine(`❌ Gagal: ${data.error || data.message}`);
    }
}

async function stopBot() {
    if (!currentToken) return;
    const res = await fetch('/api/bot/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentToken })
    });
    const data = await res.json();
    if (data.success) {
        addConsoleLine('❌ Bot stopped.');
        document.getElementById('status-indicator').textContent = 'OFFLINE';
        document.getElementById('status-indicator').className = 'font-bold text-red-400';
        updateActiveBots();
    }
}

async function updateActiveBots() {
    // Implementasi: fetch dari API jika ada endpoint /api/bots
}

async function generateQR() {
    const data = document.getElementById('qrData').value;
    if (!data) return alert('Masukkan data untuk QR!');
    const res = await fetch('/api/generate/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, size: 300 })
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const img = document.getElementById('qrOutput');
    img.src = url;
    img.classList.remove('hidden');
}

async function encryptText() {
    const text = document.getElementById('encryptText').value;
    const res = await fetch('/api/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, key: 'secret-key', algorithm: 'AES' })
    });
    const data = await res.json();
    document.getElementById('encryptOutput').textContent = data.encrypted;
}

async function createSticker() {
    const fileInput = document.getElementById('stickerImage');
    if (!fileInput.files[0]) return alert('Pilih gambar!');
    
    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    formData.append('emojis', '🤖');
    
    const res = await fetch('/api/create/sticker', {
        method: 'POST',
        body: formData
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const img = document.getElementById('stickerOutput');
    img.src = url;
    img.classList.remove('hidden');
}

function clearConsole() {
    document.getElementById('consoleOutput').innerHTML = 
        '<div class="console-line text-gray-400">// Console cleared.</div>';
}

function exportLogs() {
    const lines = Array.from(document.querySelectorAll('#consoleOutput .console-line'))
        .map(el => el.textContent).join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-console-${new Date().toISOString().split('T')[0]}.log`;
    a.click();
}

function sendCommand() {
    const input = document.getElementById('consoleInput');
    if (!input.value.trim()) return;
    addConsoleLine(`> ${input.value}`);
    // Implementasi: kirim ke bot via WebSocket atau API
    input.value = '';
}