import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import type { ShopifyProductDraft } from '../models/catalog.model.js';

export type IngestionEventType = 
  | 'CONNECTED' 
  | 'INGESTION_STARTED'
  | 'INGESTION_COMPLETED' 
  | 'INGESTION_FAILED'
  | 'CATALOG_UPDATED' 
  | 'CATALOG_DELETED' 
  | 'PING';

export interface IngestionEventPayload {
  type: IngestionEventType;
  timestamp: string;
  trackingId?: string;
  product?: ShopifyProductDraft;
  productId?: string;
  latencyMs?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export class IngestionEventBus extends EventEmitter {
  private static instance: IngestionEventBus;
  private clientCount = 0;

  private constructor() {
    super();
    // Allow any number of dashboard listeners without Node maxListeners warning
    this.setMaxListeners(100);
  }

  public static getInstance(): IngestionEventBus {
    if (!IngestionEventBus.instance) {
      IngestionEventBus.instance = new IngestionEventBus();
    }
    return IngestionEventBus.instance;
  }

  public broadcast(event: IngestionEventPayload): void {
    this.emit('ingestion_event', event);
  }

  public handleSseConnection(req: Request, res: Response): void {
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Prevent proxy buffering (e.g. Nginx)
    });

    this.clientCount++;

    // Send initial handshake
    const initialPayload: IngestionEventPayload = {
      type: 'CONNECTED',
      timestamp: new Date().toISOString(),
      message: 'Connected to GizmoVault Ingestion Event Stream',
      metadata: { activeClients: this.clientCount }
    };
    res.write(`event: ${initialPayload.type}\ndata: ${JSON.stringify(initialPayload)}\n\n`);

    // Listener function for events
    const listener = (event: IngestionEventPayload) => {
      try {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch (err) {
        console.error('[SSE Error]: Failed to write to client stream', err);
      }
    };

    this.on('ingestion_event', listener);

    // Keepalive ping every 25 seconds to keep connection open through reverse proxies
    const keepAliveTimer = setInterval(() => {
      try {
        res.write(':keepalive\n\n');
      } catch {
        clearInterval(keepAliveTimer);
      }
    }, 25000);

    // Clean up when client disconnects
    req.on('close', () => {
      clearInterval(keepAliveTimer);
      this.off('ingestion_event', listener);
      this.clientCount = Math.max(0, this.clientCount - 1);
    });
  }

  public getActiveClientCount(): number {
    return this.clientCount;
  }
}

export const ingestionEventBus = IngestionEventBus.getInstance();
