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
  } catch (error) {}
  return {};
}

function saveUserSessions() {
  try {
    const sessions = {};
    for (const [telegramId, sessionId] of Object.entries(userSessions)) {
      sessions[telegramId] = sessionId;
    }
    fs.writeFileSync(USER_SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (error) {}
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

function createCodeBlock() {
  return `◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
✧  ✧
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ 
❯ 
❯ 
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢`;
}

function escape(text) {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

bot.start(async (ctx) => {
  const codeBlock = createCodeBlock();
  const welcomeMessage = escape(`${codeBlock}

*Welcome to JIAN Telegram\\-WhatsApp Bot*

*Available Commands:*
/addsender \\- Connect WhatsApp account
/mystatus \\- Check connection status
/send \\- Send message via WhatsApp
/disconnect \\- Disconnect WhatsApp
/help \\- Show this help message

*Features:*
Multi\\-session support
QR Code & Pairing Code
Message bridging
Session persistence`);
  await ctx.reply(welcomeMessage, { parse_mode: 'MarkdownV2' });
});

bot.help(async (ctx) => {
  const codeBlock = createCodeBlock();
  const helpMessage = escape(`${codeBlock}

*JIAN BOT HELP*

*Commands:*
/addsender \\- Connect your WhatsApp account
/mystatus \\- Check your WhatsApp connection
/send \\- Send WhatsApp message
/disconnect \\- Disconnect your WhatsApp
/help \\- Show this help

*Examples:*
/send 6281234567890 Hello from Telegram\\!
/addsender \\- Start WhatsApp connection process

*Note:* Number format: 6281234567890 \\(without \\+ \\)`);
  await ctx.reply(helpMessage, { parse_mode: 'MarkdownV2' });
});

bot.command('addsender', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  let session = getUserSession(telegramId);

  if (session && session.isConnected) {
    const codeBlock = createCodeBlock();
    const message = escape(`${codeBlock}\n\nYou already have an active WhatsApp connection\\. Use /disconnect first`);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    return;
  }

  const sessionId = `user_${telegramId}`;
  session = new JianBase(sessionId);
  await session.initialize();
  
  whatsappSessions.set(sessionId, session);
  setUserSession(telegramId, sessionId);

  const codeBlock = createCodeBlock();
  const connectionMessage = escape(`${codeBlock}

*CONNECT WHATSAPP*

Choose connection method:

1\\. *QR Code* \\- Scan QR code with WhatsApp
2\\. *Pairing Code* \\- Enter code in WhatsApp

Please reply with:
*QR* \\- for QR Code
*PAIR* \\- for Pairing Code
*CANCEL* \\- to cancel`);
  await ctx.reply(connectionMessage, { parse_mode: 'MarkdownV2' });
});

bot.command('mystatus', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);

  const codeBlock = createCodeBlock();

  if (!session) {
    const message = escape(`${codeBlock}\n\nNo WhatsApp session found\\. Use /addsender to connect`);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    return;
  }

  const info = session.getConnectionInfo();
  let statusMessage = '';

  switch (info.status) {
    case 'connected':
      statusMessage = `*WHATSAPP CONNECTED*
      
Status: Connected
Session: Active
Ready to send messages

Use /send to send messages`;
      break;
    case 'qr_ready':
      statusMessage = `*QR CODE READY*
      
Check your terminal for QR code
Status: Waiting for scan`;
      break;
    case 'pairing_ready':
      statusMessage = `*PAIRING CODE READY*
      
Pairing Code: ${escape(info.pairingCode)}
Status: Waiting for pairing`;
      break;
    case 'disconnected':
      statusMessage = `*DISCONNECTED*
      
Status: Not connected
Use /addsender to reconnect`;
      break;
    default:
      statusMessage = `*UNKNOWN STATUS*
      
Status: ${escape(info.status)}`;
  }

  const fullMessage = escape(`${codeBlock}\n\n${statusMessage}`);
  await ctx.reply(fullMessage, { parse_mode: 'MarkdownV2' });
});

bot.command('send', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);

  const codeBlock = createCodeBlock();

  if (!session || !session.isConnected) {
    const message = escape(`${codeBlock}\n\nWhatsApp not connected\\. Use /addsender first`);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    const usage = escape(`${codeBlock}\n\nUsage: /send <number> <message>\nExample: /send 6281234567890 Hello from Telegram\\!`);
    await ctx.reply(usage, { parse_mode: 'MarkdownV2' });
    return;
  }

  const number = args[0];
  const message = args.slice(1).join(' ');
  const jid = `${number}@s.whatsapp.net`;

  try {
    await session.sendMessage(jid, message);
    const successMessage = escape(`${codeBlock}\n\nMessage sent to ${number}`);
    await ctx.reply(successMessage, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    const errorMessage = escape(`${codeBlock}\n\nFailed to send message: ${error.message}`);
    await ctx.reply(errorMessage, { parse_mode: 'MarkdownV2' });
  }
});

bot.command('disconnect', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);

  const codeBlock = createCodeBlock();

  if (!session) {
    const message = escape(`${codeBlock}\n\nNo active session to disconnect`);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    return;
  }

  try {
    await session.disconnect();
    whatsappSessions.delete(userSessions[telegramId]);
    delete userSessions[telegramId];
    saveUserSessions();
    const successMessage = escape(`${codeBlock}\n\nWhatsApp disconnected successfully`);
    await ctx.reply(successMessage, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    const errorMessage = escape(`${codeBlock}\n\nError disconnecting: ${error.message}`);
    await ctx.reply(errorMessage, { parse_mode: 'MarkdownV2' });
  }
});

bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;
  const session = getUserSession(telegramId);

  if (!session) return;

  if (text.toUpperCase() === 'QR') {
    const codeBlock = createCodeBlock();
    try {
      const qr = await session.getQRCode();
      if (qr) {
        qrcode.generate(qr, { small: true });
        const message = escape(`${codeBlock}\n\n*QR CODE GENERATED*\n\nCheck your terminal for QR code\\nScan with WhatsApp > Linked Devices`);
        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
      } else {
        const message = escape(`${codeBlock}\n\nQR code not available yet\\nPlease wait a moment and try again`);
        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
      }
    } catch (error) {
      const message = escape(`${codeBlock}\n\nError: ${error.message}`);
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    }
  } else if (text.toUpperCase() === 'PAIR') {
    const codeBlock = createCodeBlock();
    try {
      const phoneNumber = ctx.from.id.toString();
      const code = await session.requestPairingCode(phoneNumber);
      const formattedCode = code.match(/.{1,4}/g)?.join('\\-') || code;
      
      const pairingMessage = escape(`${codeBlock}

*PAIRING CODE*

Your pairing code: *${formattedCode}*

*Instructions:*
1\\. Open WhatsApp
2\\. Go to Settings > Linked Devices
3\\. Tap on "Link a Device"
4\\. Enter this code: *${formattedCode}*`);
      await ctx.reply(pairingMessage, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      const message = escape(`${codeBlock}\n\nError: ${error.message}`);
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    }
  } else if (text.toUpperCase() === 'CANCEL') {
    const codeBlock = createCodeBlock();
    try {
      await session.disconnect();
      whatsappSessions.delete(userSessions[telegramId]);
      delete userSessions[telegramId];
      saveUserSessions();
      const message = escape(`${codeBlock}\n\nConnection process cancelled`);
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      const message = escape(`${codeBlock}\n\nError cancelling: ${error.message}`);
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    }
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
