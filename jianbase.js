import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

export class JianBase {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.sessionDir = path.join('./sessions', `wa_${sessionId}`);
    this.sock = null;
    this.isConnected = false;
    this.qrCode = null;
    this.pairingCode = null;
    this.connectionStatus = 'disconnected';
  }

  async initialize() {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: logger,
      browser: ['Firefox', 'Linux', '110.0'],
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 15000,
    });

    this.setupEventHandlers(saveCreds);
    return this;
  }

  setupEventHandlers(saveCreds) {
    this.sock.ev.on('connection.update', (update) => {
      const { connection, qr, pairingCode, lastDisconnect } = update;

      if (qr) {
        this.qrCode = qr;
        this.connectionStatus = 'qr_ready';
      }

      if (pairingCode) {
        this.pairingCode = pairingCode;
        this.connectionStatus = 'pairing_ready';
      }

      if (connection === 'open') {
        this.isConnected = true;
        this.connectionStatus = 'connected';
      }

      if (connection === 'close') {
        this.isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          this.connectionStatus = 'logged_out';
          try {
            fs.rmSync(this.sessionDir, { recursive: true, force: true });
          } catch (error) {
            console.error('Error deleting session:', error);
          }
        } else {
          this.connectionStatus = 'disconnected';
        }
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
  }

  async requestPairingCode(phoneNumber) {
    try {
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
      const code = await this.sock.requestPairingCode(cleanNumber);
      this.pairingCode = code;
      this.connectionStatus = 'pairing_ready';
      return code;
    } catch (error) {
      throw new Error(`Failed to request pairing code: ${error.message}`);
    }
  }

  getConnectionInfo() {
    return {
      status: this.connectionStatus,
      qrCode: this.qrCode,
      pairingCode: this.pairingCode,
      isConnected: this.isConnected,
      sessionId: this.sessionId
    };
  }

  async sendMessage(jid, message) {
    if (!this.isConnected) {
      throw new Error('WhatsApp not connected');
    }
    return await this.sock.sendMessage(jid, { text: message });
  }

  async getQRCode() {
    if (this.connectionStatus !== 'qr_ready') {
      throw new Error('QR code not available');
    }
    return this.qrCode;
  }

  async disconnect() {
    if (this.sock) {
      await this.sock.ws.close();
      this.isConnected = false;
      this.connectionStatus = 'disconnected';
    }
  }
}
