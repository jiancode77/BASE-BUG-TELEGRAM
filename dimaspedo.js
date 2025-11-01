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
    const message = `

❌ Anda sudah memiliki koneksi WhatsApp aktif\\. Gunakan /disconnect terlebih dahulu`;
    await ctx.replyWithMarkdownV2(codeBlock + message);
    return;
  }

  const sessionId = `user_${telegramId}`;
  session = new JianBase(sessionId);
  await session.initialize();
  
  whatsappSessions.set(sessionId, session);
  setUserSession(telegramId, sessionId);

  const codeBlock = createCodeBlock('/addsender', 'Connecting...');
  const connectionMessage = `

🔗 *HUBUNGKAN WHATSAPP*

Pilih metode koneksi:

1\\. *QR Code* \\- Scan QR code dengan WhatsApp
2\\. *Pairing Code* \\- Masukkan kode di WhatsApp

Balas dengan:
*QR* \\- untuk QR Code
*PAIR* \\- untuk Pairing Code
*CANCEL* \\- untuk membatalkan`;

  await ctx.replyWithMarkdownV2(codeBlock + connectionMessage);
});

bot.command('mystatus', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);

  const status = session ? (session.isConnected ? 'Connected' : 'Disconnected') : 'No Session';
  const codeBlock = createCodeBlock('/mystatus', status);

  if (!session) {
    const message = `

❌ Tidak ditemukan session WhatsApp\\. Gunakan /addsender untuk menghubungkan`;
    await ctx.replyWithMarkdownV2(codeBlock + message);
    return;
  }

  const info = session.getConnectionInfo();
  let statusMessage = '';

  switch (info.status) {
    case 'connected':
      statusMessage = `🟢 *WHATSAPP TERHUBUNG*

✅ Status: Terhubung
📱 Session: Aktif
🔗 Siap mengirim pesan

Gunakan /send untuk mengirim pesan`;
      break;
    case 'qr_ready':
      statusMessage = `📱 *QR CODE SIAP*

Cek pesan Telegram untuk QR code
Status: Menunggu scan`;
      break;
    case 'pairing_ready':
      statusMessage = `🔢 *PAIRING CODE SIAP*

Kode Pairing: ${escapeMarkdownV2(info.pairingCode)}
Status: Menunggu pairing`;
      break;
    case 'disconnected':
      statusMessage = `🔴 *TERPUTUS*

Status: Tidak terhubung
Gunakan /addsender untuk menghubungkan ulang`;
      break;
    default:
      statusMessage = `⚪ *STATUS TIDAK DIKENAL*

Status: ${escapeMarkdownV2(info.status)}`;
  }

  await ctx.replyWithMarkdownV2(codeBlock + statusMessage);
});

bot.command('send', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);

  const status = session ? (session.isConnected ? 'Connected' : 'Disconnected') : 'No Session';
  const codeBlock = createCodeBlock('/send', status);

  if (!session || !session.isConnected) {
    const message = `

❌ WhatsApp tidak terhubung\\. Gunakan /addsender terlebih dahulu`;
    await ctx.replyWithMarkdownV2(codeBlock + message);
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    const usage = `

❌ Penggunaan: /send <nomor> <pesan>
Contoh: /send 6281234567890 Halo dari Telegram\\!`;
    await ctx.replyWithMarkdownV2(codeBlock + usage);
    return;
  }

  const number = args[0];
  const message = args.slice(1).join(' ');
  const jid = `${number}@s.whatsapp.net`;

  try {
    await session.sendMessage(jid, message);
    const successMessage = `

✅ Pesan terkirim ke ${escapeMarkdownV2(number)}`;
    await ctx.replyWithMarkdownV2(codeBlock + successMessage);
  } catch (error) {
    const errorMessage = `

❌ Gagal mengirim pesan: ${escapeMarkdownV2(error.message)}`;
    await ctx.replyWithMarkdownV2(codeBlock + errorMessage);
  }
});

bot.command('disconnect', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);

  const status = session ? (session.isConnected ? 'Connected' : 'Disconnected') : 'No Session';
  const codeBlock = createCodeBlock('/disconnect', status);

  if (!session) {
    const message = `

❌ Tidak ada session aktif untuk diputuskan`;
    await ctx.replyWithMarkdownV2(codeBlock + message);
    return;
  }

  try {
    await session.disconnect();
    whatsappSessions.delete(userSessions[telegramId]);
    delete userSessions[telegramId];
    saveUserSessions();
    const successMessage = `

✅ WhatsApp berhasil diputuskan`;
    await ctx.replyWithMarkdownV2(codeBlock + successMessage);
  } catch (error) {
    const errorMessage = `

❌ Error memutuskan koneksi: ${escapeMarkdownV2(error.message)}`;
    await ctx.replyWithMarkdownV2(codeBlock + errorMessage);
  }
});

bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;
  const session = getUserSession(telegramId);

  if (!session) return;

  if (text.toUpperCase() === 'QR') {
    const codeBlock = createCodeBlock('QR', 'Requesting QR Code');
    try {
      const qr = await session.getQRCode();
      if (qr) {
        qrcode.generate(qr, { small: true });
        const message = `

📱 *QR CODE DIHASILKAN*

Cek terminal untuk QR code
Scan dengan WhatsApp \\> Linked Devices`;
        await ctx.replyWithMarkdownV2(codeBlock + message);
      } else {
        const message = `

❌ QR code belum tersedia
Tunggu sebentar dan coba lagi`;
        await ctx.replyWithMarkdownV2(codeBlock + message);
      }
    } catch (error) {
      const message = `

❌ Error: ${escapeMarkdownV2(error.message)}`;
      await ctx.replyWithMarkdownV2(codeBlock + message);
    }
  } else if (text.toUpperCase() === 'PAIR') {
    const codeBlock = createCodeBlock('PAIR', 'Requesting Pairing Code');
    try {
      const phoneNumber = ctx.from.id.toString();
      const code = await session.requestPairingCode(phoneNumber);
      const formattedCode = code.match(/.{1,4}/g)?.join('\\-') || code;
      
      const pairingMessage = `

🔢 *PAIRING CODE*

Kode pairing Anda: *${formattedCode}*

*Instruksi:*
1\\. Buka WhatsApp
2\\. Pergi ke Settings \\> Linked Devices
3\\. Ketuk "Link a Device"
4\\. Masukkan kode ini: *${formattedCode}*`;

      await ctx.replyWithMarkdownV2(codeBlock + pairingMessage);
    } catch (error) {
      const message = `

❌ Error: ${escapeMarkdownV2(error.message)}`;
      await ctx.replyWithMarkdownV2(codeBlock + message);
    }
  } else if (text.toUpperCase() === 'CANCEL') {
    const codeBlock = createCodeBlock('CANCEL', 'Cancelling Connection');
    await session.disconnect();
    whatsappSessions.delete(userSessions[telegramId]);
    delete userSessions[telegramId];
    saveUserSessions();
    const message = `

✅ Proses koneksi dibatalkan`;
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
