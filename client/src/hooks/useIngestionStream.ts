import { useState, useEffect, useRef, useCallback } from 'react';

export interface IngestionProductMedia {
  url: string;
  media_type: 'IMAGE' | 'VIDEO';
  position: number;
}

export interface IngestionProduct {
  id: string;
  merchant_id: string;
  title: string;
  description_html: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  category: string;
  price: number;
  currency: string;
  media: IngestionProductMedia[];
  raw_whatsapp_source?: any;
  created_at?: string;
  updated_at?: string;
}

export interface StreamEvent {
  type: 'CONNECTED' | 'INGESTION_STARTED' | 'INGESTION_COMPLETED' | 'INGESTION_FAILED' | 'CATALOG_UPDATED' | 'CATALOG_DELETED';
  timestamp: string;
  trackingId?: string;
  product?: IngestionProduct;
  productId?: string;
  latencyMs?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface UseIngestionStreamOptions {
  onIngestionStarted?: (event: StreamEvent) => void;
  onIngestionCompleted?: (event: StreamEvent) => void;
  onIngestionFailed?: (event: StreamEvent) => void;
  onCatalogUpdated?: (event: StreamEvent) => void;
  onCatalogDeleted?: (event: StreamEvent) => void;
  enabled?: boolean;
}

export function useIngestionStream(options: UseIngestionStreamOptions = {}) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(() => {
    if (options.enabled === false) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus('connecting');
    const es = new EventSource('/api/v1/admin/ingestion-stream');
    eventSourceRef.current = es;

    es.addEventListener('CONNECTED', (e: MessageEvent) => {
      setStatus('connected');
      try {
        const data: StreamEvent = JSON.parse(e.data);
        setLastEvent(data);
      } catch {
        // Handshake
      }
    });

    es.addEventListener('INGESTION_STARTED', (e: MessageEvent) => {
      try {
        const data: StreamEvent = JSON.parse(e.data);
        setLastEvent(data);
        optionsRef.current.onIngestionStarted?.(data);
      } catch (err) {
        console.error('[SSE Parse Error]:', err);
      }
    });

    es.addEventListener('INGESTION_COMPLETED', (e: MessageEvent) => {
      try {
        const data: StreamEvent = JSON.parse(e.data);
        setLastEvent(data);
        optionsRef.current.onIngestionCompleted?.(data);
      } catch (err) {
        console.error('[SSE Parse Error]:', err);
      }
    });

    es.addEventListener('INGESTION_FAILED', (e: MessageEvent) => {
      try {
        const data: StreamEvent = JSON.parse(e.data);
        setLastEvent(data);
        optionsRef.current.onIngestionFailed?.(data);
      } catch (err) {
        console.error('[SSE Parse Error]:', err);
      }
    });

    es.addEventListener('CATALOG_UPDATED', (e: MessageEvent) => {
      try {
        const data: StreamEvent = JSON.parse(e.data);
        setLastEvent(data);
        optionsRef.current.onCatalogUpdated?.(data);
      } catch (err) {
        console.error('[SSE Parse Error]:', err);
      }
    });

    es.addEventListener('CATALOG_DELETED', (e: MessageEvent) => {
      try {
        const data: StreamEvent = JSON.parse(e.data);
        setLastEvent(data);
        optionsRef.current.onCatalogDeleted?.(data);
      } catch (err) {
        console.error('[SSE Parse Error]:', err);
      }
    });

    es.onerror = () => {
      setStatus('disconnected');
    };
  }, [options.enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return {
    status,
    lastEvent,
    reconnect: connect
  };
}
