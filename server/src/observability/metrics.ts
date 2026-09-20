import { Request, Response, NextFunction } from 'express';

export interface AppMetrics {
  totalRequests: number;
  totalErrors: number;
  totalOrders: number;
  totalIngestions: number;
  activeConnections: number;
  uptimeSeconds: number;
}

class MetricsRegistry {
  private startTime = Date.now();
  private totalRequests = 0;
  private totalErrors = 0;
  private totalOrders = 0;
  private totalIngestions = 0;

  incrementRequests(): void {
    this.totalRequests += 1;
  }

  incrementErrors(): void {
    this.totalErrors += 1;
  }

  incrementOrders(): void {
    this.totalOrders += 1;
  }

  incrementIngestions(): void {
    this.totalIngestions += 1;
  }

  getMetrics(): AppMetrics {
    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      totalOrders: this.totalOrders,
      totalIngestions: this.totalIngestions,
      activeConnections: 1,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  reset(): void {
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.totalOrders = 0;
    this.totalIngestions = 0;
    this.startTime = Date.now();
  }
}

export const metrics = new MetricsRegistry();

/**
 * Express middleware to track request counts and response errors
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  metrics.incrementRequests();

  res.on('finish', () => {
    if (res.statusCode >= 500) {
      metrics.incrementErrors();
    }
  });

  next();
}
