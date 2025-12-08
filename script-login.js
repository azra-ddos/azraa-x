document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const terminal = document.getElementById('terminal');
    const dynamicLogo = document.getElementById('dynamicLogo');

    // Ganti logo dengan path yang diinginkan (edit manual di sini)
    // dynamicLogo.src = 'path/to/your/logo.png';

    function addTerminalLine(text) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `> ${text}`;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        addTerminalLine(`Authenticating: ${username}...`);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                addTerminalLine('<span class="gold-text">ACCESS GRANTED</span>');
                addTerminalLine('Redirecting to dashboard...');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                addTerminalLine('<span style="color:#ff5555">ACCESS DENIED - Invalid credentials</span>');
            }
        } catch (error) {
            addTerminalLine(`<span style="color:#ff5555">Network Error: ${error.message}</span>`);
        }
    });

    // Initial terminal messages
    setTimeout(() => addTerminalLine('> Firewall: Stateful Inspection Active'), 500);
    setTimeout(() => addTerminalLine('> Protocol: TLS 1.3 Encrypted'), 1000);
});