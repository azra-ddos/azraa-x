const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Path to users database
const USERS_FILE = path.join(__dirname, 'users.json');

// Load users
async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Create default users file if doesn't exist
        const defaultUsers = {
            users: [
                { username: "admin", password: "admin123" },
                { username: "operator", password: "op123" }
            ]
        };
        await fs.writeFile(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
        return defaultUsers;
    }
}

// Authentication endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usersData = await loadUsers();
        
        const user = usersData.users.find(u => 
            u.username === username && u.password === password
        );
        
        if (user) {
            res.json({ success: true, message: 'Authentication successful' });
        } else {
            res.json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// URL validation endpoint
app.post('/api/check-url', async (req, res) => {
    const { url } = req.body;
    
    // Simple validation - in production, use actual HTTP request
    const isValid = url && (
        url.startsWith('http://') || 
        url.startsWith('https://')
    );
    
    // Simulate network check
    const exists = isValid && Math.random() > 0.1; // 90% chance "exists"
    
    res.json({ 
        exists, 
        message: exists ? 'URL is reachable' : 'URL not reachable' 
    });
});

// DDoS simulation endpoints
app.post('/api/start-ddos', (req, res) => {
    const { url, threads, duration } = req.body;
    
    // Log attack (in real implementation, this would start actual attack)
    console.log(`[DDoS] Started attack on ${url} with ${threads} threads`);
    
    // Simulate attack processing
    res.json({ 
        success: true, 
        message: 'Attack initiated',
        attackId: Date.now().toString()
    });
});

app.post('/api/stop-ddos', (req, res) => {
    console.log('[DDoS] Attack stopped');
    res.json({ success: true, message: 'Attack stopped' });
});

// NGL spam endpoint
app.post('/api/ngl-spam', (req, res) => {
    const { username, message, count } = req.body;
    
    console.log(`[NGL] Spamming ${username} with "${message}" (${count} times)`);
    
    res.json({ 
        success: true, 
        message: 'NGL spam initiated',
        sent: count
    });
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('start-attack', (data) => {
        console.log('Attack started:', data);
        
        // Simulate attack progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            socket.emit('attack-update', {
                progress,
                message: `Sending requests to ${data.url}...`
            });
            
            if (progress >= 100) {
                clearInterval(progressInterval);
            }
        }, 1000);
        
        // Store interval for this socket
        socket.attackInterval = progressInterval;
    });
    
    socket.on('stop-attack', () => {
        console.log('Attack stopped for:', socket.id);
        if (socket.attackInterval) {
            clearInterval(socket.attackInterval);
        }
        socket.emit('attack-update', {
            progress: 0,
            message: 'Attack terminated'
        });
    });
    
    socket.on('ngl-spam', (data) => {
        console.log('NGL spam:', data);
        socket.emit('ngl-update', {
            sent: data.count,
            success: true
        });
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (socket.attackInterval) {
            clearInterval(socket.attackInterval);
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Web interface: http://localhost:${PORT}/index.html`);
});