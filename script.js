// DOM Elements
const targetUrlInput = document.getElementById('target-url');
const validateBtn = document.getElementById('validate-btn');
const urlStatus = document.getElementById('url-status');
const threadsSlider = document.getElementById('threads');
const threadCount = document.getElementById('thread-count');
const powerBar = document.getElementById('power-bar');
const startAttackBtn = document.getElementById('start-attack');
const stopAttackBtn = document.getElementById('stop-attack');
const visualContainer = document.getElementById('visual-container');
const statusText = document.getElementById('status-text');
const requestsSentEl = document.getElementById('requests-sent');
const successRateEl = document.getElementById('success-rate');
const targetStatusEl = document.getElementById('target-status');
const logContainer = document.getElementById('log-container');

// State
let isAttacking = false;
let attackInterval = null;
let requestCount = 0;
let successCount = 0;

// Update thread display
threadsSlider.addEventListener('input', function() {
    const value = this.value;
    threadCount.textContent = value;
    powerBar.style.width = `${value / 10}%`;
});

// Validate URL
validateBtn.addEventListener('click', async function() {
    const url = targetUrlInput.value.trim();
    if (!url) {
        addLog('ERROR: URL target kosong.');
        return;
    }

    urlStatus.textContent = 'Memeriksa...';
    urlStatus.style.color = 'var(--gold)';

    const isValid = await validateTarget(url);
    
    if (isValid) {
        urlStatus.textContent = 'VALID';
        urlStatus.style.color = 'var(--blue)';
        startAttackBtn.disabled = false;
        addLog(`Target ${url} valid dan siap diserang.`);
    } else {
        urlStatus.textContent = 'INVALID';
        urlStatus.style.color = 'var(--red)';
        startAttackBtn.disabled = true;
        addLog(`Target ${url} tidak valid atau tidak dapat diakses.`);
    }
});

// Start Attack
startAttackBtn.addEventListener('click', function() {
    if (isAttacking) return;
    
    const url = targetUrlInput.value.trim();
    const threads = parseInt(threadsSlider.value);
    
    if (!url) {
        addLog('ERROR: Tentukan target terlebih dahulu.');
        return;
    }

    isAttacking = true;
    startAttackBtn.disabled = true;
    stopAttackBtn.disabled = false;
    
    // Start color transition
    startColorTransition();
    
    // Update UI
    statusText.textContent = 'ATTACKING';
    statusText.style.color = 'var(--red)';
    visualContainer.classList.add('attack-active');
    
    addLog(`[!] Memulai serangan DDoS ke ${url} dengan ${threads} thread.`);
    addLog(`[!] Metode: HTTP Flood + Slowloris hybrid.`);
    
    // Start DDoS simulation
    attackInterval = setInterval(() => {
        if (!isAttacking) return;
        
        // Simulate requests
        const batchSize = Math.floor(threads / 10);
        requestCount += batchSize;
        const success = Math.floor(batchSize * (0.7 + Math.random() * 0.2));
        successCount += success;
        
        // Update metrics
        requestsSentEl.textContent = requestCount.toLocaleString();
        const rate = Math.floor((successCount / requestCount) * 100);
        successRateEl.textContent = `${rate}%`;
        targetStatusEl.textContent = rate > 50 ? 'CRITICAL' : 'STRESSED';
        targetStatusEl.style.color = rate > 50 ? 'var(--red)' : 'var(--gold)';
        
        // Random log entries
        if (Math.random() > 0.7) {
            const methods = ['GET Flood', 'POST Flood', 'Slow Headers', 'WebSocket Spam'];
            const method = methods[Math.floor(Math.random() * methods.length)];
            addLog(`[+] ${method} berhasil dikirim. Response: ${Math.floor(Math.random() * 5000)}ms`);
        }
        
        // Check for "server down" simulation (5% chance each interval after 5 seconds)
        if (Date.now() - attackStartTime > 5000 && Math.random() > 0.95) {
            addLog('[!] TARGET DOWN: Server tidak merespon (kode 503/Timeout).');
            targetStatusEl.textContent = 'DOWN';
            targetStatusEl.style.color = 'var(--red)';
        }
    }, 100);
    
    const attackStartTime = Date.now();
});

// Stop Attack
stopAttackBtn.addEventListener('click', function() {
    if (!isAttacking) return;
    
    isAttacking = false;
    clearInterval(attackInterval);
    
    startAttackBtn.disabled = false;
    stopAttackBtn.disabled = true;
    
    // Reset colors
    resetColors();
    
    // Update UI
    statusText.textContent = 'STOPPED';
    statusText.style.color = 'var(--blue)';
    visualContainer.classList.remove('attack-active');
    
    addLog(`[!] Serangan dihentikan. Total requests: ${requestCount}`);
});

// Add log entry
function addLog(message) {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `[<span class="timestamp">${timestamp}</span>] ${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    addLog('Sistem GoldRush DDoS Suite diinisialisasi.');
    addLog('Versi 2.0 - Hybrid HTTP Flood + Slowloris');
    addLog('Status: READY');
});