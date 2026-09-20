import crypto from 'crypto';

export interface InboundWhatsAppMessage {
  source_id: string;
  meta_message_id: string;
  sender_phone: string;
  message_type: 'text' | 'image' | 'video' | 'document' | 'unknown';
  raw_text?: string;
  caption?: string;
  media_id?: string;
  timestamp: string;
}

export interface WhatsAppConnector {
  verifyWebhook(mode: string, token: string, challenge: string): string | null;
  validateSignature(rawBody: string, signatureHeader?: string): boolean;
  parseInboundPayload(payload: any, sourceId?: string): InboundWhatsAppMessage[];
}

export class MetaWhatsAppConnector implements WhatsAppConnector {
  private verifyToken: string;
  private appSecret: string;

  constructor(verifyToken?: string, appSecret?: string) {
    this.verifyToken = verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'gizmovault_secure_verify_token_2026';
    this.appSecret = appSecret || process.env.WHATSAPP_APP_SECRET || 'gizmovault_meta_app_secret_dev';
  }

  public verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken) {
      return challenge;
    }
    return null;
  }

  public validateSignature(rawBody: string, signatureHeader?: string): boolean {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      // In development/test mode without appSecret configured, allow graceful bypass if explicit
      if (process.env.NODE_ENV === 'test' && !signatureHeader) {
        return true;
      }
      return false;
    }

    const expectedSignature = signatureHeader.slice(7);
    const hmac = crypto.createHmac('sha256', this.appSecret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    );
  }

  public parseInboundPayload(payload: any, sourceId: string = 'src_wa_meta'): InboundWhatsAppMessage[] {
    const messages: InboundWhatsAppMessage[] = [];

    if (!payload || !payload.entry || !Array.isArray(payload.entry)) {
      return messages;
    }

    for (const entry of payload.entry) {
      if (!entry.changes || !Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;
        const val = change.value;
        if (!val || !val.messages || !Array.isArray(val.messages)) continue;

        for (const msg of val.messages) {
          const sender = msg.from;
          const msgId = msg.id;
          const timestamp = msg.timestamp
            ? new Date(parseInt(msg.timestamp, 10) * 1000).toISOString()
            : new Date().toISOString();

          let msgType: InboundWhatsAppMessage['message_type'] = 'unknown';
          let rawText: string | undefined;
          let caption: string | undefined;
          let mediaId: string | undefined;

          if (msg.type === 'text' && msg.text) {
            msgType = 'text';
            rawText = msg.text.body;
          } else if (msg.type === 'image' && msg.image) {
            msgType = 'image';
            mediaId = msg.image.id;
            caption = msg.image.caption;
            rawText = caption;
          } else if (msg.type === 'video' && msg.video) {
            msgType = 'video';
            mediaId = msg.video.id;
            caption = msg.video.caption;
            rawText = caption;
          } else if (msg.type === 'document' && msg.document) {
            msgType = 'document';
            mediaId = msg.document.id;
            caption = msg.document.caption;
            rawText = caption || msg.document.filename;
          }

          messages.push({
            source_id: sourceId,
            meta_message_id: msgId,
            sender_phone: sender,
            message_type: msgType,
            raw_text: rawText,
            caption: caption,
            media_id: mediaId,
            timestamp
          });
        }
      }
    }

    return messages;
  }
}

export class SimulatorWhatsAppConnector implements WhatsAppConnector {
  public verifyWebhook(_mode: string, _token: string, challenge: string): string | null {
    return challenge;
  }

  public validateSignature(_rawBody: string, _signatureHeader?: string): boolean {
    return true;
  }

  public parseInboundPayload(payload: any, sourceId: string = 'src_wa_sim'): InboundWhatsAppMessage[] {
    const rawText = payload.text || payload.caption || '';
    const messageId = payload.meta_message_id || `sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    return [
      {
        source_id: sourceId,
        meta_message_id: messageId,
        sender_phone: payload.sender_phone || '+919988776655',
        message_type: payload.message_type || (payload.media_url ? 'image' : 'text'),
        raw_text: rawText,
        caption: payload.caption || rawText,
        media_id: payload.media_id || (payload.media_url ? `med_${Date.now()}` : undefined),
        timestamp: new Date().toISOString()
      }
    ];
  }
}
