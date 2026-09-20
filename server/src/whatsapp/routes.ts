import { Router, Request, Response } from 'express';
import { MetaWhatsAppConnector, SimulatorWhatsAppConnector } from './connector.js';
import { WhatsAppIngestionService } from './ingestion.service.js';
import { WhatsAppWebhookService } from './webhook.js';

export function createWhatsAppRouter(service?: WhatsAppIngestionService, webhookService?: WhatsAppWebhookService): Router {
  const router = Router();
  const metaConnector = new MetaWhatsAppConnector();
  const simConnector = new SimulatorWhatsAppConnector();
  const ingestionService = service || new WhatsAppIngestionService();
  const webhookHandler = webhookService || new WhatsAppWebhookService();

  // 1. Meta Webhook Verification (GET)
  router.get('/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    const verified = webhookHandler.verify(mode, token, challenge);
    if (verified !== null) {
      return res.status(200).send(verified);
    }
    return res.status(403).json({ error: 'Verification token mismatch or invalid mode' });
  });

  // 2. Meta Webhook Inbound Ingestion (POST)
  router.post('/webhook', async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (signature && !webhookHandler.validateSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }

    try {
      const result = await webhookHandler.processPayload(req.body, rawBody);
      if (result.status === 'REPLAY_IGNORED') {
        return res.status(200).json({ success: true, message: 'Replay ignored' });
      }

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err: any) {
      console.error('[WhatsApp Ingestion Error]:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. Admin / Test Ingestion Simulator (POST)
  router.post('/simulate', (req: Request, res: Response) => {
    try {
      const messages = simConnector.parseInboundPayload(req.body);
      const result = ingestionService.processInboundMessages(messages, JSON.stringify(req.body));

      return res.status(201).json({
        success: true,
        message: 'Simulated WhatsApp message ingested successfully into moderation queue.',
        result
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // 4. List Inbound Messages (GET)
  router.get('/messages', (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const messages = ingestionService.listMessages({ status, limit });

      return res.json({
        success: true,
        count: messages.length,
        data: messages
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
