// Users database (in production, this should be server-side)
const users = [
    { username: "admin", password: "admin123" },
    { username: "hacker", password: "elite" },
    { username: "root", password: "toor" }
];

// DOM Elements
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');

// Toggle password visibility
togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
});

// Login form submission
loginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    // Simulate authentication delay
    const loginBtn = this.querySelector('.btn-login');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AUTHENTICATING...';
    loginBtn.disabled = true;
    
    setTimeout(() => {
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            // Successful login
            loginBtn.innerHTML = '<i class="fas fa-check"></i> ACCESS GRANTED';
            loginBtn.style.background = 'linear-gradient(90deg, #00cc66, #00ff88)';
            
            // Simulate redirect to dashboard
            addLoginLog(`User ${username} berhasil login.`);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            // Failed login
            loginBtn.innerHTML = '<i class="fas fa-times"></i> ACCESS DENIED';
            loginBtn.style.background = 'linear-gradient(90deg, #cc0022, #ff0033)';
            addLoginLog(`Gagal login untuk user ${username}.`);
            
            // Reset after 2 seconds
            setTimeout(() => {
                loginBtn.innerHTML = originalText;
                loginBtn.disabled = false;
                loginBtn.style.background = '';
            }, 2000);
        }
    }, 1500);
});

// Add login log (simulated)
function addLoginLog(message) {
    const log = document.createElement('div');
    log.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0,0,0,0.8);
        color: var(--gold);
        padding: 10px 20px;
        border-radius: 8px;
        border-left: 4px solid var(--gold);
        z-index: 1000;
        font-family: monospace;
    `;
    log.textContent = `[AUTH] ${message}`;
    document.body.appendChild(log);
    
    setTimeout(() => log.remove(), 3000);
}

// Check if already logged in (simulated session)
window.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') && !sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
    }
    
    if (window.location.pathname.includes('login.html') && sessionStorage.getItem('loggedIn')) {
        window.location.href = 'index.html';
    }
});

// Simulated session storage
loginForm.addEventListener('submit', function(event) {
    // In real implementation, set session after server validation
    sessionStorage.setItem('loggedIn', 'true');
    sessionStorage.setItem('username', usernameInput.value);
});