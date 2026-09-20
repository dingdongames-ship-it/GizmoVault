import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';
import { InboundWhatsAppMessage } from './connector.js';

export interface IngestionJobRecord {
  id: string;
  source_message_id: string;
  job_status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempt_count: number;
  error_message?: string;
  created_at: string;
}

export class WhatsAppIngestionService {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  public processInboundMessages(messages: InboundWhatsAppMessage[], rawPayloadJson: string): {
    received: number;
    saved: number;
    duplicates: number;
    messageIds: string[];
  } {
    let saved = 0;
    let duplicates = 0;
    const messageIds: string[] = [];

    const checkMsg = this.db.prepare('SELECT id FROM whatsapp_messages WHERE meta_message_id = ?');
    const insertMsg = this.db.prepare(`
      INSERT INTO whatsapp_messages (
        id, source_id, meta_message_id, sender_phone,
        message_type, raw_text, caption, media_id,
        processing_status, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
    `);

    const insertEvent = this.db.prepare(`
      INSERT OR IGNORE INTO webhook_events (
        id, provider, event_type, idempotency_key, payload, processed
      ) VALUES (?, 'WHATSAPP', 'INBOUND_MESSAGE', ?, ?, 1)
    `);

    const insertJob = this.db.prepare(`
      INSERT INTO ingestion_jobs (id, source_message_id, job_status, attempt_count)
      VALUES (?, ?, 'PENDING', 0)
    `);

    for (const msg of messages) {
      // 1. Check idempotency
      const existing = checkMsg.get(msg.meta_message_id);
      if (existing) {
        duplicates++;
        continue;
      }

      const internalMsgId = `wa_msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // 2. Insert into webhook_events
      insertEvent.run(
        `wh_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        msg.meta_message_id,
        rawPayloadJson
      );

      // 3. Insert into whatsapp_messages
      insertMsg.run(
        internalMsgId,
        msg.source_id,
        msg.meta_message_id,
        msg.sender_phone,
        msg.message_type,
        msg.raw_text || null,
        msg.caption || null,
        msg.media_id || null
      );

      // 4. Create pending ingestion job
      const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      insertJob.run(jobId, internalMsgId);

      saved++;
      messageIds.push(internalMsgId);
    }

    return {
      received: messages.length,
      saved,
      duplicates,
      messageIds
    };
  }

  public listMessages(options: { limit?: number; offset?: number; status?: string } = {}): any[] {
    let query = `
      SELECT m.*, s.display_name as source_name
      FROM whatsapp_messages m
      LEFT JOIN whatsapp_sources s ON m.source_id = s.id
    `;
    const params: any[] = [];

    if (options.status) {
      query += ' WHERE m.processing_status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY m.received_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);

    return this.db.prepare(query).all(...params);
  }

  public getMessageById(id: string): any | null {
    return this.db.prepare(`
      SELECT m.*, s.display_name as source_name
      FROM whatsapp_messages m
      LEFT JOIN whatsapp_sources s ON m.source_id = s.id
      WHERE m.id = ? OR m.meta_message_id = ?
    `).get(id, id) || null;
  }
}
