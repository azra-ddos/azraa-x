// Vercel serverless function simulation
// This file simulates backend functionality for deployment

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve main dashboard
app.get('/dashboard', (req, res) => {
    // Check authentication (simulated)
    const token = req.headers['authorization'];
    if (!token && req.path !== '/login') {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Authentication endpoint (simulated)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Read users from JSON file
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8'));
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Generate simulated token
        const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
        res.json({ 
            success: true, 
            token: token,
            user: { username: user.username, role: user.role || 'hacker' }
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Simulated attack endpoint (doesn't actually attack)
app.post('/api/attack/start', (req, res) => {
    const { target, threads } = req.body;
    
    if (!target || !threads) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    // Simulate attack initiation
    const attackId = 'attack_' + Date.now();
    console.log(`[Simulation] Attack started on ${target} with ${threads} threads`);
    
    res.json({
        success: true,
        attackId: attackId,
        message: `Simulated attack started on ${target}`,
        estimatedCompletion: Date.now() + 30000 // 30 seconds from now
    });
});

// Stop attack endpoint
app.post('/api/attack/stop', (req, res) => {
    const { attackId } = req.body;
    
    console.log(`[Simulation] Attack ${attackId} stopped`);
    
    res.json({
        success: true,
        message: 'Attack stopped',
        statistics: {
            duration: Math.floor(Math.random() * 60) + 10,
            requestsSent: Math.floor(Math.random() * 1000000),
            successRate: Math.floor(Math.random() * 30) + 70
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'operational',
        version: '2.0',
        service: 'GoldRush DDoS Simulation'
    });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Start server (for local testing)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`GoldRush DDoS Suite running on http://localhost:${PORT}`);
        console.log('This is a simulation tool for educational purposes only.');
    });
}

// Export for Vercel
module.exports = app;