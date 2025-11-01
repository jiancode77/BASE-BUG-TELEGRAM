import { Telegraf } from 'telegraf';
import { JianBase } from './jianbase.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

const BOT_TOKEN = '7987531387:AAE2xVu_asKwVZvsBVP9hHuctPTaQHjmuTM';
const bot = new Telegraf(BOT_TOKEN);

const whatsappSessions = new Map();
const USER_SESSIONS_FILE = './user_sessions.json';

function loadUserSessions() {
  try {
    if (fs.existsSync(USER_SESSIONS_FILE)) {
      const data = fs.readFileSync(USER_SESSIONS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading user sessions:', error);
  }
  return {};
}

function saveUserSessions() {
  try {
    const sessions = {};
    for (const [telegramId, sessionId] of Object.entries(userSessions)) {
      sessions[telegramId] = sessionId;
    }
    fs.writeFileSync(USER_SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error('Error saving user sessions:', error);
  }
}

const userSessions = loadUserSessions();

function getUserSession(telegramId) {
  const sessionId = userSessions[telegramId];
  if (sessionId && whatsappSessions.has(sessionId)) {
    return whatsappSessions.get(sessionId);
  }
  return null;
}

function setUserSession(telegramId, sessionId) {
  userSessions[telegramId] = sessionId;
  saveUserSessions();
}

function escapeMarkdownV2(text) {
  return text.replace(/([_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, '\\$1');
}

function createCodeBlock(command, status, additional = '') {
  const time = new Date().toLocaleString('id-ID');
  let title = "P H O N E  R E G I S T R A T I O N";
  switch(command) {
    case '/start': title = "B O T  I N I T I A L I Z A T I O N"; break;
    case '/addsender': title = "W H A T S A P P  C O N N E C T"; break;
    case '/mystatus': title = "S T A T U S  C H E C K"; break;
    case '/send': title = "M E S S A G E  S E N D I N G"; break;
    case '/disconnect': title = "D I S C O N N E C T I O N"; break;
    case '/help': title = "H E L P  M E N U"; break;
    case 'QR': title = "Q R  C O D E  G E N E R A T E"; break;
    case 'PAIR': title = "P A I R I N G  C O D E"; break;
    case 'CANCEL': title = "C A N C E L L A T I O N"; break;
  }
  return `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
✧ ${title} ✧
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Format: ${command}
❯ Status: ${status}
❯ Time: ${time}
${additional}◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``;
}

bot.start(async (ctx) => {
  const codeBlock = createCodeBlock('/start', 'Bot Started');
  const welcomeMessage = `

🤖 *JIAN TELEGRAM\\-WHATSAPP BOT*

Selamat datang di bot penghubung Telegram dan WhatsApp\\!

*Perintah Tersedia:*
/addsender \\- Hubungkan akun WhatsApp
/mystatus \\- Cek status koneksi
/send \\- Kirim pesan WhatsApp
/disconnect \\- Putuskan WhatsApp
/help \\- Bantuan

*Fitur:*
✅ Multi\\-session support
✅ QR Code & Pairing Code
✅ Message bridging
✅ Session persistence`;
  await ctx.replyWithMarkdownV2(codeBlock + welcomeMessage);
});

bot.help(async (ctx) => {
  const codeBlock = createCodeBlock('/help', 'Help Menu');
  const helpMessage = `

*🤖 JIAN BOT HELP*

*Commands:*
/addsender \\- Hubungkan WhatsApp Anda
/mystatus \\- Cek koneksi WhatsApp
/send \\- Kirim pesan WhatsApp
/disconnect \\- Putuskan WhatsApp
/help \\- Tampilkan bantuan

*Contoh:*
/send 6281234567890 Halo dari Telegram\\!
/addsender \\- Mulai proses koneksi WhatsApp

*Catatan:* Format nomor: 6281234567890`;
  await ctx.replyWithMarkdownV2(codeBlock + helpMessage);
});

bot.command('addsender', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  let session = getUserSession(telegramId);
  if (session && session.isConnected) {
    const codeBlock = createCodeBlock('/addsender', 'Already Connected');
    const message = `\n❌ Anda sudah memiliki koneksi WhatsApp aktif\\. Gunakan /disconnect terlebih dahulu`;
    await ctx.replyWithMarkdownV2(codeBlock + message);
    return;
  }
  const sessionId = `user_${telegramId}`;
  session = new JianBase(sessionId);
  await session.initialize();
  whatsappSessions.set(sessionId, session);
  setUserSession(telegramId, sessionId);
  const codeBlock = createCodeBlock('/addsender', 'Connecting...');
  const connectionMessage = `\n🔗 *HUBUNGKAN WHATSAPP*\n\nPilih metode koneksi:\n\n1\\. *QR Code* \\- Scan QR code dengan WhatsApp\n2\\. *Pairing Code* \\- Masukkan kode di WhatsApp\n\nBalas dengan:\n*QR* \\- untuk QR Code\n*PAIR* \\- untuk Pairing Code\n*CANCEL* \\- untuk membatalkan`;
  await ctx.replyWithMarkdownV2(codeBlock + connectionMessage);
});

bot.command('mystatus', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);
  const status = session ? (session.isConnected ? 'Connected' : 'Disconnected') : 'No Session';
  const codeBlock = createCodeBlock('/mystatus', status);
  if (!session) {
    const message = `\n❌ Tidak ditemukan session WhatsApp\\. Gunakan /addsender untuk menghubungkan`;
    await ctx.replyWithMarkdownV2(codeBlock + message);
    return;
  }
  const info = session.getConnectionInfo();
  let statusMessage = '';
  switch (info.status) {
    case 'connected':
      statusMessage = `🟢 *WHATSAPP TERHUBUNG*\n\n✅ Status: Terhubung\n📱 Session: Aktif\n🔗 Siap mengirim pesan\n\nGunakan /send untuk mengirim pesan`;
      break;
    case 'qr_ready':
      statusMessage = `📱 *QR CODE SIAP*\n\nCek pesan Telegram untuk QR code\nStatus: Menunggu scan`;
      break;
    case 'pairing_ready':
      statusMessage = `🔢 *PAIRING CODE SIAP*\n\nKode Pairing: ${escapeMarkdownV2(info.pairingCode)}\nStatus: Menunggu pairing`;
      break;
    case 'disconnected':
      statusMessage = `🔴 *TERPUTUS*\n\nStatus: Tidak terhubung\nGunakan /addsender untuk menghubungkan ulang`;
      break;
    default:
      statusMessage = `⚪ *STATUS TIDAK DIKENAL*\n\nStatus: ${escapeMarkdownV2(info.status)}`;
  }
  await ctx.replyWithMarkdownV2(codeBlock + statusMessage);
});

bot.command('send', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);
  const status = session ? (session.isConnected ? 'Connected' : 'Disconnected') : 'No Session';
  const codeBlock = createCodeBlock('/send', status);
  if (!session || !session.isConnected) {
    const message = `\n❌ WhatsApp tidak terhubung\\. Gunakan /addsender terlebih dahulu`;
    await ctx.replyWithMarkdownV2(codeBlock + message);
    return;
  }
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    const usage = `\n❌ Penggunaan: /send <nomor> <pesan>\nContoh: /send 6281234567890 Halo dari Telegram\\!`;
    await ctx.replyWithMarkdownV2(codeBlock + usage);
    return;
  }
  const number = args[0];
  const message = args.slice(1).join(' ');
  const jid = `${number}@s.whatsapp.net`;
  try {
    await session.sendMessage(jid, message);
    const successMessage = `\n✅ Pesan terkirim ke ${escapeMarkdownV2(number)}`;
    await ctx.replyWithMarkdownV2(codeBlock + successMessage);
  } catch (error) {
    const errorMessage = `\n❌ Gagal mengirim pesan: ${escapeMarkdownV2(error.message)}`;
    await ctx.replyWithMarkdownV2(codeBlock + errorMessage);
  }
});

bot.command('disconnect', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);
  const status = session ? (session.isConnected ? 'Connected' : 'Disconnected') : 'No Session';
  const codeBlock = createCodeBlock('/disconnect', status);
  if (!session) {
    const message = `\n❌ Tidak ada session aktif untuk diputuskan`;
    await ctx.replyWithMarkdownV2(codeBlock + message);
    return;
  }
  try {
    await session.disconnect();
    whatsappSessions.delete(userSessions[telegramId]);
    delete userSessions[telegramId];
    saveUserSessions();
    const successMessage = `\n✅ WhatsApp berhasil diputuskan`;
    await ctx.replyWithMarkdownV2(codeBlock + successMessage);
  } catch (error) {
    const errorMessage = `\n❌ Error memutuskan koneksi: ${escapeMarkdownV2(error.message)}`;
    await ctx.replyWithMarkdownV2(codeBlock + errorMessage);
  }
});

bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text.trim();
  const session = getUserSession(telegramId);
  if (!session) return;
  if (text.toUpperCase() === 'QR') {
    const codeBlock = createCodeBlock('QR', 'Requesting QR Code');
    try {
      const qr = await session.getQRCode();
      if (qr) {
        qrcode.generate(qr, { small: true });
        const message = `\n📱 *QR CODE DIHASILKAN*\n\nCek terminal untuk QR code\nScan dengan WhatsApp \\> Linked Devices`;
        await ctx.replyWithMarkdownV2(codeBlock + message);
      } else {
        const message = `\n❌ QR code belum tersedia\nTunggu sebentar dan coba lagi`;
        await ctx.replyWithMarkdownV2(codeBlock + message);
      }
    } catch (error) {
      const message = `\n❌ Error: ${escapeMarkdownV2(error.message)}`;
      await ctx.replyWithMarkdownV2(codeBlock + message);
    }
  } else if (text.toUpperCase() === 'PAIR') {
    const codeBlock = createCodeBlock('PAIR', 'Requesting Pairing Code');
    try {
      const phone = ctx.message.text.split(' ').slice(1).join('').trim();
      const phoneNumber = phone || telegramId;
      const code = await session.requestPairingCode(phoneNumber);
      const formattedCode = code.replace(/-/g, '\\-');
      const pairingMessage = `\n🔢 *PAIRING CODE*\n\nKode pairing Anda: *${formattedCode}*\n\n*Instruksi:*\n1\\. Buka WhatsApp\n2\\. Pergi ke Settings \\> Linked Devices\n3\\. Ketuk "Link a Device"\n4\\. Masukkan kode ini: *${formattedCode}*`;
      await ctx.replyWithMarkdownV2(codeBlock + pairingMessage);
      const notify = `🔗 *Pairing Code Terkirim!*\n\nKode: *${formattedCode}*\nNomor: \`${phoneNumber}\`\n\nMasukkan kode ini di WhatsApp sekarang\\.`;
      await ctx.replyWithMarkdownV2(notify);
    } catch (error) {
      const message = `\n❌ Error: ${escapeMarkdownV2(error.message)}`;
      await ctx.replyWithMarkdownV2(codeBlock + message);
    }
  } else if (text.toUpperCase() === 'CANCEL') {
    const codeBlock = createCodeBlock('CANCEL', 'Cancelling Connection');
    await session.disconnect();
    whatsappSessions.delete(userSessions[telegramId]);
    delete userSessions[telegramId];
    saveUserSessions();
    const message = `\n✅ Proses koneksi dibatalkan`;
    await ctx.replyWithMarkdownV2(codeBlock + message);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log('Starting Telegram Bot...');
bot.launch().then(() => {
  console.log('Telegram Bot is running!');
}).catch(error => {
  console.error('Failed to start bot:', error);
});
