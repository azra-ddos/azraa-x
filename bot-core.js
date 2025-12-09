import { Telegraf } from 'telegraf';
import { setupImageProcessor } from './image-processor.js';
import { setupEncryptionEngine } from './encryption-engine.js';

export async function botEngine(token, logCallback) {
  const bot = new Telegraf(token);
  
  bot.start((ctx) => {
    const welcomeText = `✨ *BOT ADVANCED ACTIVATED* ✨
━━━━━━━━━━━━━━━━━━
👤 User: ${ctx.from.first_name}
🆔 ID: ${ctx.from.id}
📅 Date: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━
🔐 /encrypt - Enkripsi teks
🖼️ /qr - Generate QR Code
🎨 /sticker - Buat stiker dari foto
🔧 /code - Eksekusi kode JavaScript
📊 /stats - Status bot
━━━━━━━━━━━━━━━━━━`;
    ctx.replyWithPhoto({ url: 'https://raw.githubusercontent.com/your-repo/logo/main/bot-banner.png' }, { caption: welcomeText, parse_mode: 'Markdown' });
    logCallback(`[START] ${ctx.from.id} triggered start`);
  });

  bot.command('encrypt', async (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    const encrypted = setupEncryptionEngine.encrypt(text, 'secret-key', 'AES');
    ctx.reply(`🔐 Encrypted:\n\`${encrypted}\``, { parse_mode: 'Markdown' });
    logCallback(`[ENCRYPT] ${ctx.from.id}: ${text.substring(0, 50)}`);
  });

  bot.command('qr', async (ctx) => {
    const data = ctx.message.text.split(' ').slice(1).join(' ') || 'https://t.me/yourbot';
    const qrBuffer = await setupImageProcessor.generateQR(data, 300);
    ctx.replyWithPhoto({ source: qrBuffer });
    logCallback(`[QR] Generated for ${ctx.from.id}`);
  });

  bot.command('sticker', async (ctx) => {
    if (ctx.message.reply_to_message?.photo) {
      const photo = ctx.message.reply_to_message.photo.pop();
      const file = await ctx.telegram.getFileLink(photo.file_id);
      const stickerBuffer = await setupImageProcessor.createSticker(file.href, '🤖');
      ctx.replyWithSticker({ source: stickerBuffer });
      logCallback(`[STICKER] Created for ${ctx.from.id}`);
    } else {
      ctx.reply('Balas foto dengan perintah /sticker');
    }
  });

  bot.command('code', (ctx) => {
    const code = ctx.message.text.split(' ').slice(1).join(' ');
    try {
      const result = eval(code);
      ctx.reply(`✅ Output:\n\`\`\`${result}\`\`\``, { parse_mode: 'Markdown' });
      logCallback(`[CODE EXEC] ${ctx.from.id}: ${code}`);
    } catch (err) {
      ctx.reply(`❌ Error:\n\`\`\`${err.message}\`\`\``, { parse_mode: 'Markdown' });
    }
  });

  bot.launch();
  logCallback(`🤖 Bot instance launched`);

  return {
    id: Math.random().toString(36).substring(7),
    stop: () => bot.stop()
  };
}