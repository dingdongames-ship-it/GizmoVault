import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

export interface AuditEvent {
  id: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export class AuditService {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
    this.ensureAuditTable();
  }

  private ensureAuditTable(): void {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        details_json TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id)
    `).run();
    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_logs(event_type)
    `).run();
  }

  logEvent(params: {
    eventType: string;
    actorId: string;
    actorRole: string;
    action: string;
    details?: Record<string, any>;
    ipAddress?: string;
  }): AuditEvent {
    const id = `audit_${crypto.randomBytes(8).toString('hex')}`;
    const detailsJson = params.details ? JSON.stringify(params.details) : null;
    const ip = params.ipAddress || '127.0.0.1';

    this.db.prepare(`
      INSERT INTO audit_logs (id, event_type, actor_id, actor_role, action, details_json, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, params.eventType, params.actorId, params.actorRole, params.action, detailsJson, ip);

    return {
      id,
      eventType: params.eventType,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      details: params.details,
      ipAddress: ip,
      createdAt: new Date().toISOString(),
    };
  }

  getRecentLogs(limit = 50): AuditEvent[] {
    const rows = this.db.prepare(
      `SELECT id, event_type, actor_id, actor_role, action, details_json, ip_address, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT ?`
    ).all(limit) as any[];

    return rows.map(r => ({
      id: r.id,
      eventType: r.event_type,
      actorId: r.actor_id,
      actorRole: r.actor_role,
      action: r.action,
      details: r.details_json ? JSON.parse(r.details_json) : undefined,
      ipAddress: r.ip_address,
      createdAt: r.created_at,
    }));
  }
}
