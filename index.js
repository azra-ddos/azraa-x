import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { botEngine } from './bot-core.js';
import { startWebDashboard } from './web-dashboard.js';
import { setupEncryptionEngine } from './encryption-engine.js';
import { setupImageProcessor } from './image-processor.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Config
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Global State
const activeBots = new Map();
const consoleLogs = new Map();

// Socket.IO Real-time Console
io.on('connection', (socket) => {
  const botToken = socket.handshake.query.token;
  if (botToken && consoleLogs.has(botToken)) {
    socket.join(botToken);
    socket.emit('console-history', consoleLogs.get(botToken));
  }
});

function logToConsole(token, message) {
  if (!consoleLogs.has(token)) consoleLogs.set(token, []);
  const logs = consoleLogs.get(token);
  logs.push({ time: new Date().toISOString(), message });
  if (logs.length > 100) logs.shift();
  io.to(token).emit('console-update', { time: new Date().toISOString(), message });
}

// API Endpoints
app.post('/api/bot/start', async (req, res) => {
  const { token } = req.body;
  if (activeBots.has(token)) {
    return res.json({ success: false, message: 'Bot sudah berjalan' });
  }
  try {
    const bot = await botEngine(token, (msg) => logToConsole(token, msg));
    activeBots.set(token, bot);
    logToConsole(token, `✅ Bot started: ${token.substring(0, 15)}...`);
    res.json({ success: true, pid: bot.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bot/stop', (req, res) => {
  const { token } = req.body;
  const bot = activeBots.get(token);
  if (bot) {
    bot.stop();
    activeBots.delete(token);
    logToConsole(token, '❌ Bot stopped');
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Bot tidak ditemukan' });
  }
});

app.post('/api/encrypt', (req, res) => {
  const { text, key, algorithm } = req.body;
  const result = setupEncryptionEngine.encrypt(text, key, algorithm);
  res.json({ encrypted: result });
});

app.post('/api/generate/qr', async (req, res) => {
  const { data, size } = req.body;
  const qrBuffer = await setupImageProcessor.generateQR(data, size);
  res.set('Content-Type', 'image/png');
  res.send(qrBuffer);
});

app.post('/api/create/sticker', async (req, res) => {
  const { imageUrl, emojis } = req.body;
  const stickerBuffer = await setupImageProcessor.createSticker(imageUrl, emojis);
  res.set('Content-Type', 'image/webp');
  res.send(stickerBuffer);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});