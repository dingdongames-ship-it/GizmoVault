import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  correlationId?: string;
  message: string;
  context?: Record<string, any>;
  error?: string;
}

export class Logger {
  constructor(private serviceName: string = 'GizmoVault') {}

  private format(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): StructuredLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      message: `[${this.serviceName}] ${message}`,
      context,
      error: error?.stack || error?.message,
    };
  }

  info(message: string, context?: Record<string, any>): void {
    const log = this.format('INFO', message, context);
    console.log(JSON.stringify(log));
  }

  warn(message: string, context?: Record<string, any>): void {
    const log = this.format('WARN', message, context);
    console.warn(JSON.stringify(log));
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    const log = this.format('ERROR', message, context, error);
    console.error(JSON.stringify(log));
  }
}

export const logger = new Logger('GizmoVault-API');

/**
 * Express middleware to attach a correlation ID to each incoming request
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || `req_${crypto.randomBytes(6).toString('hex')}`;
  (req as any).correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
