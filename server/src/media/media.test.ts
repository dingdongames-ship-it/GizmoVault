import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { initializeDatabase, getDb } from '../db/index.js';
import { MediaPipelineService } from './media.service.js';
import { app } from '../index.js';

describe('Phase 10: Media Processing Pipeline & CDN Protection', () => {
  let db: DatabaseSync;
  let service: MediaPipelineService;

  // Helpers to generate valid dummy media buffers with exact magic headers
  const createMockJpeg = (): Buffer => {
    // FF D8 FF E0 00 10 4A 46 49 46 (JPEG JFIF header)
    const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const body = Buffer.alloc(512, 0xaa);
    return Buffer.concat([header, body]);
  };

  const createMockPng = (): Buffer => {
    // 89 50 4E 47 0D 0A 1A 0A (PNG header)
    const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const body = Buffer.alloc(512, 0xbb);
    return Buffer.concat([header, body]);
  };

  const createMockWebp = (): Buffer => {
    // RIFF [4 bytes size] WEBP
    const riff = Buffer.from('RIFF');
    const size = Buffer.from([0x00, 0x02, 0x00, 0x00]);
    const webp = Buffer.from('WEBP');
    const body = Buffer.alloc(512, 0xcc);
    return Buffer.concat([riff, size, webp, body]);
  };

  const createMockMp4 = (): Buffer => {
    // 00 00 00 20 'ftyp' 'isom'
    const boxSize = Buffer.from([0x00, 0x00, 0x00, 0x20]);
    const ftyp = Buffer.from('ftypisom');
    const body = Buffer.alloc(1024, 0xdd);
    return Buffer.concat([boxSize, ftyp, body]);
  };

  beforeEach(() => {
    initializeDatabase();
    db = getDb();
    service = new MediaPipelineService({}, db);

    // Clean test media records
    db.prepare("DELETE FROM whatsapp_media WHERE id LIKE 'test_wamedia_%'").run();

    // Ensure dummy WhatsApp message exists for foreign key
    db.prepare(`
      INSERT OR IGNORE INTO whatsapp_messages (id, source_id, meta_message_id, sender_phone, message_type, raw_text)
      VALUES ('msg_test_media_01', 'src_wa_sim', 'wamid.HBgLTESTMEDIA1', '+919876543210', 'image', 'Watch photo attachment')
    `).run();
  });

  describe('File Validation & Magic Byte Detection', () => {
    it('detects and validates genuine JPEG, PNG, and WebP image buffers', () => {
      const jpeg = service.validateMediaBuffer(createMockJpeg(), 'watch.jpg');
      expect(jpeg.valid).toBe(true);
      expect(jpeg.mediaType).toBe('IMAGE');
      expect(jpeg.mimeType).toBe('image/jpeg');

      const png = service.validateMediaBuffer(createMockPng(), 'watch.png');
      expect(png.valid).toBe(true);
      expect(png.mediaType).toBe('IMAGE');
      expect(png.mimeType).toBe('image/png');

      const webp = service.validateMediaBuffer(createMockWebp(), 'watch.webp');
      expect(webp.valid).toBe(true);
      expect(webp.mediaType).toBe('IMAGE');
      expect(webp.mimeType).toBe('image/webp');
    });

    it('detects and validates MP4 video container buffers', () => {
      const mp4 = service.validateMediaBuffer(createMockMp4(), 'demo.mp4');
      expect(mp4.valid).toBe(true);
      expect(mp4.mediaType).toBe('VIDEO');
      expect(mp4.mimeType).toBe('video/mp4');
    });

    it('rejects corrupt, executable, or non-whitelisted files', () => {
      const phpScript = Buffer.from('<?php echo "malicious payload"; ?>');
      const phpRes = service.validateMediaBuffer(phpScript, 'exploit.php');
      expect(phpRes.valid).toBe(false);
      expect(phpRes.error).toContain('Unsupported or unverified file format');

      const emptyRes = service.validateMediaBuffer(Buffer.alloc(0));
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.error).toContain('Empty or missing');
    });
  });

  describe('Image & Video Processing Pipeline', () => {
    it('processes image buffer, computes deterministic CDN URLs, and generates thumbnail artifact', () => {
      const jpeg = createMockJpeg();
      const result = service.processImage(jpeg, 'chrono_royal.jpg');

      expect(result.mediaId).toMatch(/^img_[a-f0-9]{16}$/);
      expect(result.cdnUrl).toBe(`https://cdn.gizmovault.com/media/products/${result.mediaId}.webp`);
      expect(result.thumbnailUrl).toBe(`https://cdn.gizmovault.com/media/thumbnails/${result.mediaId}_thumb.webp`);
      expect(result.cardUrl).toBe(`https://cdn.gizmovault.com/media/products/${result.mediaId}_card.webp`);
      expect(result.aspectRatio).toBe('1:1');
      expect(result.secureToken).toBeDefined();
    });

    it('processes video buffer, prepares streaming descriptor, and creates video poster reference', () => {
      const mp4 = createMockMp4();
      const result = service.processVideo(mp4, 'drone_flight_demo.mp4');

      expect(result.mediaId).toMatch(/^vid_[a-f0-9]{16}$/);
      expect(result.cdnUrl).toBe(`https://cdn.gizmovault.com/media/videos/${result.mediaId}.mp4`);
      expect(result.thumbnailUrl).toBe(`https://cdn.gizmovault.com/media/posters/${result.mediaId}_poster.webp`);
      expect(result.isStreamingReady).toBe(true);
      expect(result.durationSeconds).toBe(15);
    });
  });

  describe('URL Cloaking & Source Shielding', () => {
    it('shields upstream private vendor URLs with deterministic CDN URLs', () => {
      const privateUrl = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=99281726&enc=secret';
      const cloaked = service.cloakSourceUrl(privateUrl);

      expect(cloaked.isCloaked).toBe(true);
      expect(cloaked.cdnUrl).toMatch(/^https:\/\/cdn\.gizmovault\.com\/media\/proxied\/[a-f0-9]{16}\.webp$/);
      // Ensure private query parameters and tokens are completely hidden
      expect(cloaked.cdnUrl).not.toContain('lookaside');
      expect(cloaked.cdnUrl).not.toContain('secret');
    });

    it('leaves existing GizmoVault CDN URLs uncloaked', () => {
      const safeUrl = 'https://cdn.gizmovault.com/media/products/img_safe.webp';
      const result = service.cloakSourceUrl(safeUrl);
      expect(result.isCloaked).toBe(false);
      expect(result.cdnUrl).toBe(safeUrl);
    });
  });

  describe('Cryptographic Secure Token Signing & Verification', () => {
    it('generates HMAC signed tokens and verifies valid tokens', () => {
      const path = '/media/products/img_1234567890abcdef.webp';
      const token = service.generateSecureToken(path, 3600);
      expect(token).toBeDefined();

      const isValid = service.verifySecureToken(token, path);
      expect(isValid).toBe(true);
    });

    it('rejects tampered tokens or mismatched paths', () => {
      const path1 = '/media/products/img_alpha.webp';
      const path2 = '/media/products/img_beta.webp';
      const token = service.generateSecureToken(path1, 3600);

      // Verify with wrong path
      const isValidWrongPath = service.verifySecureToken(token, path2);
      expect(isValidWrongPath).toBe(false);

      // Verify with tampered token
      const tampered = token.slice(0, -4) + 'zzzz';
      const isValidTampered = service.verifySecureToken(tampered, path1);
      expect(isValidTampered).toBe(false);
    });
  });

  describe('Database Ingestion Persistence', () => {
    it('saves processed WhatsApp media record in whatsapp_media table', () => {
      const jpeg = createMockJpeg();
      const processed = service.saveWhatsAppMedia('msg_test_media_01', 'meta_media_9921', jpeg, 'watch.jpg');

      expect(processed.cdnUrl).toBeDefined();

      const row = db.prepare('SELECT * FROM whatsapp_media WHERE message_id = ?').get('msg_test_media_01') as any;
      expect(row).toBeDefined();
      expect(row.meta_media_id).toBe('meta_media_9921');
      expect(row.media_type).toBe('image');
      expect(row.cdn_url).toBe(processed.cdnUrl);
      expect(row.file_size_bytes).toBe(jpeg.length);
    });
  });

  describe('REST API Endpoints Integration', () => {
    it('POST /api/v1/media/process accepts base64 buffer and returns CDN artifacts', async () => {
      const jpeg = createMockJpeg();
      const res = await request(app)
        .post('/api/v1/media/process')
        .send({
          base64Data: jpeg.toString('base64'),
          filename: 'wrist_shot.jpg'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mediaType).toBe('IMAGE');
      expect(res.body.cdnUrl).toMatch(/https:\/\/cdn\.gizmovault\.com/);
      expect(res.body.thumbnailUrl).toBeDefined();
    });

    it('POST /api/v1/media/cloak-url returns cloaked CDN URL', async () => {
      const res = await request(app)
        .post('/api/v1/media/cloak-url')
        .send({
          sourceUrl: 'https://graph.facebook.com/v20.0/media_download?token=abc123secret'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isCloaked).toBe(true);
      expect(res.body.cdnUrl).toMatch(/https:\/\/cdn\.gizmovault\.com\/media\/proxied\//);
    });

    it('GET /api/v1/media/secure-token and POST /api/v1/media/verify-token cycle works', async () => {
      const tokenRes = await request(app).get('/api/v1/media/secure-token?path=/media/products/img_test.webp');
      expect(tokenRes.status).toBe(200);
      expect(tokenRes.body.success).toBe(true);
      const { token, resourcePath } = tokenRes.body;

      const verifyRes = await request(app)
        .post('/api/v1/media/verify-token')
        .send({ token, resourcePath });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
    });
  });
});
