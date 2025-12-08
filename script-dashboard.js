// Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Socket.IO Connection
    const socket = io('http://localhost:3000'); // Ganti dengan URL backend saat deploy

    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            
            // Update active nav
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding page
            pages.forEach(p => {
                p.classList.remove('active');
                if (p.id === `page-${page}`) {
                    p.classList.add('active');
                }
            });
            
            // Update header
            const titles = {
                dashboard: { main: 'Dashboard', sub: 'Neural Cyber Operations Interface' },
                ddos: { main: 'DDoS Assault', sub: 'Layer 7 HTTP Flood with Intelligent Thread Management' },
                ngl: { main: 'NGL Spam', sub: 'High-Velocity Anonymous Message Flooding System' },
                logs: { main: 'Attack Logs', sub: 'Historical Operation Records' },
                config: { main: 'Configuration', sub: 'System & User Management' }
            };
            
            pageTitle.textContent = titles[page].main;
            pageSubtitle.textContent = titles[page].sub;
        });
    });

    // Session Timer
    let sessionSeconds = 0;
    setInterval(() => {
        sessionSeconds++;
        const hours = Math.floor(sessionSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((sessionSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (sessionSeconds % 60).toString().padStart(2, '0');
        document.getElementById('sessionTimer').textContent = `${hours}:${minutes}:${seconds}`;
    }, 1000);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        if (confirm('Terminate session?')) {
            window.location.href = 'index.html';
        }
    });

    // DDoS Controls
    const targetUrl = document.getElementById('targetUrl');
    const checkUrlBtn = document.getElementById('checkUrlBtn');
    const urlStatus = document.getElementById('urlStatus');
    const threadCount = document.getElementById('threadCount');
    const threadValue = document.getElementById('threadValue');
    const attackDuration = document.getElementById('attackDuration');
    const visualFill = document.getElementById('visualFill');
    const intensityValue = document.getElementById('intensityValue');
    const startDDoS = document.getElementById('startDDoS');
    const stopDDoS = document.getElementById('stopDDoS');
    const ddosConsole = document.getElementById('ddosConsole');

    // Thread count display
    threadCount.addEventListener('input', function() {
        threadValue.textContent = this.value;
    });

    // URL Verification
    checkUrlBtn.addEventListener('click', async function() {
        const url = targetUrl.value.trim();
        if (!url) {
            urlStatus.innerHTML = '<span style="color:#ff5555">Please enter a URL</span>';
            return;
        }

        urlStatus.innerHTML = '<span style="color:#ffd700">Checking...</span>';
        
        try {
            const response = await fetch('/api/check-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            
            const data = await response.json();
            if (data.exists) {
                urlStatus.innerHTML = '<span style="color:#00ff00">✓ Target is reachable</span>';
            } else {
                urlStatus.innerHTML = '<span style="color:#ff5555">✗ Target not reachable</span>';
            }
        } catch (error) {
            urlStatus.innerHTML = `<span style="color:#ff5555">Error: ${error.message}</span>`;
        }
    });

    // DDoS Attack Simulation
    let attackInterval;
    let currentIntensity = 0;
    let isAttacking = false;

    function updateVisual(intensity) {
        const colors = [
            'linear-gradient(90deg, #001133, #4d7cff)',
            'linear-gradient(90deg, #4d7cff, #ff7700)',
            'linear-gradient(90deg, #ff7700, #ff3300)',
            'linear-gradient(90deg, #ff3300, #ff0000)',
            'linear-gradient(90deg, #ff0000, #990000)'
        ];
        
        const colorIndex = Math.min(Math.floor(intensity / 25), 4);
        visualFill.style.width = `${intensity}%`;
        visualFill.style.background = colors[colorIndex];
        intensityValue.textContent = `${intensity}%`;
        
        // Warna background halaman berubah perlahan
        document.body.style.background = `linear-gradient(135deg, #0a0a0f ${100-intensity}%, #${Math.floor(intensity*2.55).toString(16).padStart(2,'0')}0000 ${intensity}%)`;
    }

    function addConsoleMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.innerHTML = `[${timestamp}] ${message}`;
        ddosConsole.appendChild(line);
        ddosConsole.scrollTop = ddosConsole.scrollHeight;
    }

    startDDoS.addEventListener('click', function() {
        const url = targetUrl.value.trim();
        const threads = parseInt(threadCount.value);
        const duration = parseInt(attackDuration.value);
        
        if (!url) {
            alert('Please enter a target URL');
            return;
        }

        if (!urlStatus.textContent.includes('reachable')) {
            alert('Please verify the URL first');
            return;
        }

        isAttacking = true;
        startDDoS.disabled = true;
        stopDDoS.disabled = false;
        
        addConsoleMessage(`Starting DDoS attack on ${url} with ${threads} threads`);
        addConsoleMessage(`Duration: ${duration === 0 ? 'Until stopped' : duration + ' seconds'}`);
        
        // Simulate attack
        currentIntensity = 0;
        attackInterval = setInterval(() => {
            currentIntensity = Math.min(currentIntensity + 5, 100);
            updateVisual(currentIntensity);
            
            // Simulate traffic
            const requests = Math.floor(threads * (currentIntensity / 100) * Math.random());
            addConsoleMessage(`Sending ${requests} requests...`);
            
            // Send attack command to backend
            socket.emit('start-attack', {
                url,
                threads,
                duration
            });
            
            // Auto-stop if duration set
            if (duration > 0) {
                setTimeout(() => {
                    if (isAttacking) {
                        stopAttack();
                    }
                }, duration * 1000);
            }
        }, 1000);
    });

    stopDDoS.addEventListener('click', stopAttack);

    function stopAttack() {
        if (!isAttacking) return;
        
        clearInterval(attackInterval);
        isAttacking = false;
        startDDoS.disabled = false;
        stopDDoS.disabled = true;
        
        addConsoleMessage('Attack stopped');
        addConsoleMessage('Cleaning up threads...');
        
        // Reset visual
        let resetInterval = setInterval(() => {
            currentIntensity = Math.max(currentIntensity - 2, 0);
            updateVisual(currentIntensity);
            
            if (currentIntensity <= 0) {
                clearInterval(resetInterval);
                document.body.style.background = '#0a0a0f';
                addConsoleMessage('System returned to normal');
            }
        }, 50);
        
        // Stop attack on backend
        socket.emit('stop-attack');
    }

    // NGL Spam Controls
    const nglLink = document.getElementById('nglLink');
    const messageCount = document.getElementById('messageCount');
    const spamMessage = document.getElementById('spamMessage');
    const delay = document.getElementById('delay');
    const delayValue = document.getElementById('delayValue');
    const startNGL = document.getElementById('startNGL');
    const stopNGL = document.getElementById('stopNGL');
    const sentCount = document.getElementById('sentCount');
    const nglSuccessRate = document.getElementById('nglSuccessRate');
    const nglSpeed = document.getElementById('nglSpeed');

    delay.addEventListener('input', function() {
        delayValue.textContent = this.value;
    });

    let nglInterval;
    let isSpamming = false;
    let totalSent = 0;
    let successful = 0;
    let startTime = null;

    startNGL.addEventListener('click', async function() {
        const link = nglLink.value.trim();
        const count = parseInt(messageCount.value);
        const message = spamMessage.value.trim();
        const msgDelay = parseInt(delay.value);
        
        if (!link || !message) {
            alert('Please fill in all fields');
            return;
        }

        if (!link.includes('ngl.link/')) {
            alert('Please enter a valid NGL link');
            return;
        }

        isSpamming = true;
        startNGL.disabled = true;
        stopNGL.disabled = false;
        totalSent = 0;
        successful = 0;
        startTime = Date.now();

        // Extract username from link
        const username = link.split('/').pop();
        
        // Simulate NGL spam
        nglInterval = setInterval(async () => {
            if (totalSent >= count) {
                stopNGLSpam();
                return;
            }

            try {
                // Simulate API request to NGL
                const success = Math.random() > 0.2; // 80% success rate
                
                totalSent++;
                if (success) successful++;
                
                sentCount.textContent = totalSent;
                nglSuccessRate.textContent = `${Math.round((successful / totalSent) * 100)}%`;
                
                const elapsed = (Date.now() - startTime) / 1000;
                nglSpeed.textContent = `${(totalSent / elapsed).toFixed(1)} msg/s`;
                
                // Send to backend for actual attack
                socket.emit('ngl-spam', {
                    username,
                    message,
                    count: 1
                });
                
            } catch (error) {
                console.error('NGL Error:', error);
            }
        }, msgDelay);
    });

    stopNGL.addEventListener('click', stopNGLSpam);

    function stopNGLSpam() {
        if (!isSpamming) return;
        
        clearInterval(nglInterval);
        isSpamming = false;
        startNGL.disabled = false;
        stopNGL.disabled = true;
        
        alert(`NGL spam stopped. Sent: ${totalSent}, Success: ${successful}`);
    }

    // Quick Actions
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            
            switch(action) {
                case 'ddos':
                    navItems[1].click();
                    break;
                case 'ngl':
                    navItems[2].click();
                    break;
                case 'scan':
                    alert('Scan feature coming soon...');
                    break;
                case 'report':
                    alert('Generating report...');
                    break;
            }
        });
    });

    // Socket Events
    socket.on('connect', () => {
        addConsoleMessage('Connected to attack server');
    });

    socket.on('attack-update', (data) => {
        addConsoleMessage(`Backend: ${data.message}`);
    });

    socket.on('ngl-update', (data) => {
        console.log('NGL Update:', data);
    });

    // Initialize stats
    function updateStats() {
        document.getElementById('totalAttacks').textContent = 
            Math.floor(Math.random() * 1000);
        document.getElementById('successRate').textContent = 
            `${Math.floor(Math.random() * 30) + 70}%`;
        document.getElementById('activeThreads').textContent = 
            isAttacking ? threadCount.value : '0';
        document.getElementById('bandwidth').textContent = 
            `${(Math.random() * 10).toFixed(1)} GB`;
    }

    setInterval(updateStats, 5000);
    updateStats();
});