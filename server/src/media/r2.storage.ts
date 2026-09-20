import fs from 'fs';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

export interface R2Config {
  bucketName: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicCdnUrl: string;
}

export class R2StorageService {
  private static instance: R2StorageService;
  private s3: S3Client | null = null;
  private config: R2Config;

  private constructor() {
    this.config = {
      bucketName: process.env.R2_BUCKET_NAME || 'gizmovault-media',
      endpoint: process.env.R2_ENDPOINT || 'https://c344ba2425e341f1a76f091868fe5ee7.r2.cloudflarestorage.com',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      publicCdnUrl: process.env.CDN_BASE_URL || 'https://pub-016d509dc82548c484331db82640e77b.r2.dev'
    };

    if (this.config.accessKeyId && this.config.secretAccessKey) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: this.config.endpoint,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey
        }
      });
    }
  }

  public static getInstance(): R2StorageService {
    if (!R2StorageService.instance) {
      R2StorageService.instance = new R2StorageService();
    }
    return R2StorageService.instance;
  }

  public isConfigured(): boolean {
    return this.s3 !== null;
  }

  public async uploadFile(localFilePath: string, key: string, contentType: string): Promise<string> {
    if (!this.s3) {
      throw new Error('Cloudflare R2 is not configured with valid access credentials.');
    }

    const fileStream = fs.createReadStream(localFilePath);
    const cleanKey = key.replace(/^\/+/, '');

    await this.s3.send(new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: cleanKey,
      Body: fileStream,
      ContentType: contentType
    }));

    const baseUrl = this.config.publicCdnUrl.replace(/\/+$/, '');
    return `${baseUrl}/${cleanKey}`;
  }

  public async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<string> {
    if (!this.s3) {
      throw new Error('Cloudflare R2 is not configured with valid access credentials.');
    }

    const cleanKey = key.replace(/^\/+/, '');

    await this.s3.send(new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: cleanKey,
      Body: buffer,
      ContentType: contentType
    }));

    const baseUrl = this.config.publicCdnUrl.replace(/\/+$/, '');
    return `${baseUrl}/${cleanKey}`;
  }

  public async deleteFile(key: string): Promise<void> {
    if (!this.s3) return;
    const cleanKey = key.replace(/^\/+/, '');
    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.config.bucketName,
      Key: cleanKey
    }));
  }

  public getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    const baseUrl = this.config.publicCdnUrl.replace(/\/+$/, '');
    return `${baseUrl}/${cleanKey}`;
  }
}

export const r2Storage = R2StorageService.getInstance();
