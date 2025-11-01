import { Telegraf } from 'telegraf';
import { JianBase } from './jianbase.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

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

function createCodeBlock(format, status) {
  const time = new Date().toLocaleString('id-ID');
  return `◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
✧ P H O N E  R E G I S T R A T I O N ✧
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Format: ${format}
❯ Status: ${status}
❯ Time: ${time}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢`;
}

function escapeMarkdown(text) {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

bot.start(async (ctx) => {
  const codeBlock = createCodeBlock('/start', 'Bot Started');
  const welcomeMessage = `
${codeBlock}

*Welcome to JIAN Telegram\\-WhatsApp Bot*

*Available Commands:*
/addsender \\- Connect WhatsApp account
/mystatus \\- Check connection status
/send \\- Send message via WhatsApp
/disconnect \\- Disconnect WhatsApp
/help \\- Show this help message

*Features:*
✅ Multi\\-session support
✅ QR Code & Pairing Code
✅ Message bridging
✅ Session persistence
  `.trim();

  await ctx.replyWithMarkdownV2(escapeMarkdown(welcomeMessage));
});

bot.help(async (ctx) => {
  const codeBlock = createCodeBlock('/help', 'Help Menu');
  const helpMessage = `
${codeBlock}

*🤖 JIAN BOT HELP*

*Commands:*
/addsender \\- Connect your WhatsApp account
/mystatus \\- Check your WhatsApp connection
/send \\- Send WhatsApp message
/disconnect \\- Disconnect your WhatsApp
/help \\- Show this help

*Examples:*
/send 6281234567890 Hello from Telegram\\!
/addsender \\- Start WhatsApp connection process

*Note:* Number format: 6281234567890 \\(without \\+ \\)
  `.trim();

  await ctx.replyWithMarkdownV2(escapeMarkdown(helpMessage));
});

bot.command('addsender', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  let session = getUserSession(telegramId);

  if (session && session.isConnected) {
    const codeBlock = createCodeBlock('/addsender', 'Already Connected');
    const message = `${codeBlock}\n\n❌ You already have an active WhatsApp connection\\. Use /disconnect first`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(message));
    return;
  }

  const sessionId = `user_${telegramId}`;
  session = new JianBase(sessionId);
  await session.initialize();
  
  whatsappSessions.set(sessionId, session);
  setUserSession(telegramId, sessionId);

  const codeBlock = createCodeBlock('/addsender', 'Connecting...');
  const connectionMessage = `
${codeBlock}

🔗 *CONNECT WHATSAPP*

Choose connection method:

1\\. *QR Code* \\- Scan QR code with WhatsApp
2\\. *Pairing Code* \\- Enter code in WhatsApp

Please reply with:
*QR* \\- for QR Code
*PAIR* \\- for Pairing Code
*CANCEL* \\- to cancel
  `.trim();

  await ctx.replyWithMarkdownV2(escapeMarkdown(connectionMessage));
});

bot.command('mystatus', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);

  const codeBlock = createCodeBlock('/mystatus', session ? (session.isConnected ? 'Connected' : 'Disconnected') : 'No Session');

  if (!session) {
    const message = `${codeBlock}\n\n❌ No WhatsApp session found\\. Use /addsender to connect`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(message));
    return;
  }

  const info = session.getConnectionInfo();
  let statusMessage = '';

  switch (info.status) {
    case 'connected':
      statusMessage = `🟢 *WHATSAPP CONNECTED*
      
✅ Status: Connected
📱 Session: Active
🔗 Ready to send messages

Use /send to send messages`;
      break;
    case 'qr_ready':
      statusMessage = `📱 *QR CODE READY*
      
Check your Telegram messages for QR code
Status: Waiting for scan`;
      break;
    case 'pairing_ready':
      statusMessage = `🔢 *PAIRING CODE READY*
      
Pairing Code: ${info.pairingCode}
Status: Waiting for pairing`;
      break;
    case 'disconnected':
      statusMessage = `🔴 *DISCONNECTED*
      
Status: Not connected
Use /addsender to reconnect`;
      break;
    default:
      statusMessage = `⚪ *UNKNOWN STATUS*
      
Status: ${info.status}`;
  }

  const fullMessage = `${codeBlock}\n\n${statusMessage}`;
  await ctx.replyWithMarkdownV2(escapeMarkdown(fullMessage));
});

bot.command('send', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);

  const codeBlock = createCodeBlock('/send', session ? (session.isConnected ? 'Connected' : 'Disconnected') : 'No Session');

  if (!session || !session.isConnected) {
    const message = `${codeBlock}\n\n❌ WhatsApp not connected\\. Use /addsender first`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(message));
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    const usage = `${codeBlock}\n\n❌ Usage: /send <number> <message>\nExample: /send 6281234567890 Hello from Telegram\\!`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(usage));
    return;
  }

  const number = args[0];
  const message = args.slice(1).join(' ');
  const jid = `${number}@s.whatsapp.net`;

  try {
    const sentMsg = await session.sendMessage(jid, message);
    const successMessage = `${codeBlock}\n\n✅ Message sent to ${number}`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(successMessage));
  } catch (error) {
    const errorMessage = `${codeBlock}\n\n❌ Failed to send message: ${error.message}`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(errorMessage));
  }
});

bot.command('disconnect', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const session = getUserSession(telegramId);

  const codeBlock = createCodeBlock('/disconnect', session ? (session.isConnected ? 'Connected' : 'Disconnected') : 'No Session');

  if (!session) {
    const message = `${codeBlock}\n\n❌ No active session to disconnect`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(message));
    return;
  }

  try {
    await session.disconnect();
    whatsappSessions.delete(userSessions[telegramId]);
    delete userSessions[telegramId];
    saveUserSessions();
    const successMessage = `${codeBlock}\n\n✅ WhatsApp disconnected successfully`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(successMessage));
  } catch (error) {
    const errorMessage = `${codeBlock}\n\n❌ Error disconnecting: ${error.message}`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(errorMessage));
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
        const message = `${codeBlock}\n\n📱 *QR CODE GENERATED*\n\nCheck your terminal for QR code\\nScan with WhatsApp > Linked Devices`;
        await ctx.replyWithMarkdownV2(escapeMarkdown(message));
      } else {
        const message = `${codeBlock}\n\n❌ QR code not available yet\\nPlease wait a moment and try again`;
        await ctx.replyWithMarkdownV2(escapeMarkdown(message));
      }
    } catch (error) {
      const message = `${codeBlock}\n\n❌ Error: ${error.message}`;
      await ctx.replyWithMarkdownV2(escapeMarkdown(message));
    }
  } else if (text.toUpperCase() === 'PAIR') {
    const codeBlock = createCodeBlock('PAIR', 'Requesting Pairing Code');
    try {
      const phoneNumber = ctx.from.id.toString();
      const code = await session.requestPairingCode(phoneNumber);
      const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
      
      const pairingMessage = `
${codeBlock}

🔢 *PAIRING CODE*

Your pairing code: *${formattedCode}*

*Instructions:*
1\\. Open WhatsApp
2\\. Go to Settings > Linked Devices
3\\. Tap on "Link a Device"
4\\. Enter this code: *${formattedCode}*
      `.trim();

      await ctx.replyWithMarkdownV2(escapeMarkdown(pairingMessage));
    } catch (error) {
      const message = `${codeBlock}\n\n❌ Error: ${error.message}`;
      await ctx.replyWithMarkdownV2(escapeMarkdown(message));
    }
  } else if (text.toUpperCase() === 'CANCEL') {
    const codeBlock = createCodeBlock('CANCEL', 'Cancelling Connection');
    await session.disconnect();
    whatsappSessions.delete(userSessions[telegramId]);
    delete userSessions[telegramId];
    saveUserSessions();
    const message = `${codeBlock}\n\n✅ Connection process cancelled`;
    await ctx.replyWithMarkdownV2(escapeMarkdown(message));
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log('🤖 Starting Telegram Bot...');
bot.launch().then(() => {
  console.log('✅ Telegram Bot is running!');
}).catch(error => {
  console.error('❌ Failed to start bot:', error);
});
