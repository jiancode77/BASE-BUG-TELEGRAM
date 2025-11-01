const config = require("./database/config.js");
const TelegramBot = require("node-telegram-bot-api");
const moment = require('moment');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require("fs");
const P = require("pino");
const path = require("path");
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

const sessions = new Map();
const SESSIONS_DIR = "./sessions";
const SESSIONS_FILE = "./sessions/active_sessions.json";

function createSessionDir(botNumber) {
    const deviceDir = path.join(SESSIONS_DIR, `device${botNumber}`);
    if (!fs.existsSync(deviceDir)) {
        fs.mkdirSync(deviceDir, { recursive: true });
    }
    return deviceDir;
}

function saveActiveSessions(botNumber) {
    try {
        let activeSessions = [];
        if (fs.existsSync(SESSIONS_FILE)) {
            const existing = JSON.parse(fs.readFileSync(SESSIONS_FILE));
            activeSessions = [...existing];
        }
        if (!activeSessions.includes(botNumber)) {
            activeSessions.push(botNumber);
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify(activeSessions));
        }
    } catch (error) {
        console.error("Error saving session:", error);
    }
}

async function initializeWhatsAppConnections() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const activeNumbers = JSON.parse(fs.readFileSync(SESSIONS_FILE));
            console.log(`┃ Ditemukan ${activeNumbers.length} sesi WhatsApp aktif ┃`);

            for (const botNumber of activeNumbers) {
                await connectWithRetry(botNumber);
            }
        }
    } catch (error) {
        console.error("Error initializing WhatsApp connections:", error);
    }
}

async function connectWithRetry(botNumber, attempt = 1, maxAttempts = 3) {
    const sessionDir = createSessionDir(botNumber);
    
    try {
        console.log(`┃ Menghubungkan: ${botNumber} (Percobaan ${attempt}/${maxAttempts}) ┃`);

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: P({ level: "silent" }),
            defaultQueryTimeoutMs: undefined,
        });

        const isConnected = await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                sock.ev.off('connection.update', connectionHandler);
                resolve(false);
            }, 10000);

            const connectionHandler = (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === "open") {
                    clearTimeout(timeout);
                    console.log(`┃ Bot ${botNumber} terhubung! ┃`);
                    sessions.set(botNumber, sock);
                    sock.ev.on("creds.update", saveCreds);
                    resolve(true);
                } else if (connection === "close") {
                    clearTimeout(timeout);
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    resolve(shouldReconnect ? false : 'loggedOut');
                }
            };

            sock.ev.on('connection.update', connectionHandler);
        });

        if (isConnected === true) {
            return; 
        } else if (isConnected === 'loggedOut') {
            throw new Error('Logged out');
        }

        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return connectWithRetry(botNumber, attempt + 1, maxAttempts);
        } else {
            throw new Error('Gagal setelah 3x percobaan');
        }

    } catch (error) {
        console.error(`┃ Error bot ${botNumber}: ${error.message} ┃`);

        if (attempt >= maxAttempts || error.message === 'Logged out') {
            console.log(`┃ Menghapus sesi untuk bot ${botNumber}... ┃`);
            
            if (fs.existsSync(SESSIONS_FILE)) {
                const activeNumbers = JSON.parse(fs.readFileSync(SESSIONS_FILE));
                const updatedNumbers = activeNumbers.filter(num => num !== botNumber);
                fs.writeFileSync(SESSIONS_FILE, JSON.stringify(updatedNumbers));
            }
            
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }

            console.log(`┃ Sesi bot ${botNumber} telah dihapus ┃`);
        }
    }
}

async function connectToWhatsApp(botNumber, chatId) {
    let statusMessage = await bot.sendMessage(
        chatId,
        `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
         𝗠𝗘𝗠𝗨𝗟𝗔𝗜
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Format: ${botNumber}
❯ Status: Inisialisasi...
❯ Time: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
        { parse_mode: "Markdown" }
    ).then((msg) => msg.message_id);

    const sessionDir = createSessionDir(botNumber);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: P({ level: "silent" }),
        defaultQueryTimeoutMs: undefined,
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode && statusCode >= 500 && statusCode < 600) {
                await bot.editMessageText(
                    `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
         𝗥𝗘𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗜𝗡𝗚
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Format: ${botNumber}
❯ Status: Mencoba menghubungkan...
❯ Time: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
                    {
                        chat_id: chatId,
                        message_id: statusMessage,
                        parse_mode: "Markdown",
                    }
                );
                await connectToWhatsApp(botNumber, chatId);
            } else {
                await bot.editMessageText(
                    `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
        KONEKSI GAGAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Format: ${botNumber}
❯ Status: Tidak dapat terhubung
❯ Time: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
                    {
                        chat_id: chatId,
                        message_id: statusMessage,
                        parse_mode: "Markdown",
                    }
                );
                try {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                } catch (error) {
                    console.error("Error deleting session:", error);
                }
            }
        } else if (connection === "open") {
            sessions.set(botNumber, sock);
            saveActiveSessions(botNumber);
            await bot.editMessageText(
                `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
         𝗧𝗘𝗥𝗛𝗨𝗕𝗨𝗡𝗚
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Format: ${botNumber}
❯ Status: Berhasil terhubung!
❯ Time: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
                {
                    chat_id: chatId,
                    message_id: statusMessage,
                    parse_mode: "Markdown",
                }
            );
        } else if (connection === "connecting") {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            try {
                let customcode = "ABCDEFGH";
                if (!fs.existsSync(`${sessionDir}/creds.json`)) {
                    const code = await sock.requestPairingCode(botNumber, customcode);
                    const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
                    await bot.editMessageText(
                        `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
         KODE PAIRING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Format: ${botNumber}
❯ Kode: ${formattedCode}
❯ Time: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
                        {
                            chat_id: chatId,
                            message_id: statusMessage,
                            parse_mode: "Markdown",
                        }
                    );
                }
            } catch (error) {
                console.error("Error requesting pairing code:", error);
                await bot.editMessageText(
                    `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
          𝗘𝗥𝗥𝗢𝗥
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Format: ${botNumber}
❯ Pesan: ${error.message}
❯ Time: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
                    {
                        chat_id: chatId,
                        message_id: statusMessage,
                        parse_mode: "Markdown",
                    }
                );
            }
        }
    });

    sock.ev.on("creds.update", saveCreds);
    return sock;
}

bot.onText(/\/addsender/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    if (userId !== config.OWNER_ID) {
        return bot.sendMessage(
            chatId,
            `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
          𝗔𝗞𝗦𝗘𝗦 𝗗𝗜𝗧𝗢𝗟𝗔𝗞
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Status: Hanya owner yang dapat menggunakan command ini
❯ Time: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
            { parse_mode: "Markdown" }
        );
    }

    const messageText = msg.text;
    const phoneNumber = messageText.split(' ')[1];
    
    if (!phoneNumber) {
        return bot.sendMessage(
            chatId,
            `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
          𝗘𝗥𝗥𝗢𝗥
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Format: /addsender [nomor]
❯ Status: Nomor tidak valid
❯ Time: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
            { parse_mode: "Markdown" }
        );
    }

    await connectToWhatsApp(phoneNumber, chatId);
});

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    if (userId === config.OWNER_ID) {
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "ᴀᴅᴅ sᴇɴᴅᴇʀ", callback_data: "add_sender" }],
                    [{ text: "ɪɴꜰᴏ ʙᴏᴛ", callback_data: "info_bot" }],
                    [{ text: "ʟɪsᴛ sᴇsɪ", callback_data: "list_sessions" }]
                ]
            }
        };

        await bot.sendPhoto(
            chatId,
            'https://uploader.zenzxz.dpdns.org/uploads/1761998302554.jpeg',
            {
                caption: `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
         ʏᴏᴜ ʙᴏᴛ ᴏᴡɴᴇʀ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ ɴɢᴀᴘᴀɪɴ xɪʟʟ
❯ ɪᴅ: ${userId}
❯ ᴛɪᴍᴇ: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
                parse_mode: "Markdown",
                reply_markup: keyboard.reply_markup
            }
        );
    } else {
        await bot.sendMessage(
            chatId,
            `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
          𝗔𝗞𝗦𝗘𝗦 𝗗𝗜𝗧𝗢𝗟𝗔𝗞
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ Status: Bot khusus owner
❯ Time: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
            { parse_mode: "Markdown" }
        );
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id.toString();
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (userId !== config.OWNER_ID) {
        return bot.answerCallbackQuery(callbackQuery.id, {
            text: "ᴋᴀᴍᴜ ʙᴜᴋᴀɴ ᴏᴡɴᴇʀ!",
            show_alert: true
        });
    }

    if (data === "add_sender") {
        await bot.sendMessage(
            chatId,
            `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
         ᴀᴅᴅ sᴇɴᴅᴇʀ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ ᴋɪʀɪᴍ: /addsender [nomor]
❯ ᴄᴏɴᴛᴏʜ: /addsender 628123456789
❯ ᴛɪᴍᴇ: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
            { parse_mode: "Markdown" }
        );
    } else if (data === "info_bot") {
        const activeSessions = sessions.size;
        const totalSavedSessions = fs.existsSync(SESSIONS_FILE) 
            ? JSON.parse(fs.readFileSync(SESSIONS_FILE)).length 
            : 0;
            
        await bot.sendMessage(
            chatId,
            `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
         ɪɴꜰᴏ ʙᴏᴛ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ sᴇsɪ ᴀᴋᴛɪꜰ: ${activeSessions}
❯ sᴇsɪ ᴛᴇʀsɪᴍᴘᴀɴ: ${totalSavedSessions}
❯ ᴏᴡɴᴇʀ ɪᴅ: ${userId}
❯ ᴛɪᴍᴇ: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
            { parse_mode: "Markdown" }
        );
    } else if (data === "list_sessions") {
        let sessionList = "ᴛɪᴅᴀᴋ ᴀᴅᴀ sᴇsɪ";
        if (fs.existsSync(SESSIONS_FILE)) {
            const activeNumbers = JSON.parse(fs.readFileSync(SESSIONS_FILE));
            if (activeNumbers.length > 0) {
                sessionList = activeNumbers.map(num => `• ${num}`).join('\n');
            }
        }
        
        await bot.sendMessage(
            chatId,
            `\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
        ʟɪsᴛ sᴇsɪ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${sessionList}
❯ ᴛɪᴍᴇ: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``,
            { parse_mode: "Markdown" }
        );
    }

    await bot.answerCallbackQuery(callbackQuery.id);
});

initializeWhatsAppConnections();

console.log(`\`\`\`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
         ʙᴏᴛ ᴛᴇʟᴇɢʀᴀᴍ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯ sᴛᴀᴛᴜs: ʙᴏᴛ ʙᴇʀʜᴀsɪʟ ᴅɪᴊᴀʟᴀɴᴋᴀɴ
❯ ᴏᴡɴᴇʀ ɪᴅ: ${config.OWNER_ID}
❯ ᴛɪᴍᴇ: ${moment().format('HH:mm:ss')}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢
\`\`\``);
