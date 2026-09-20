import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gizmovault_super_secret_dev_key_2026';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'ADMIN' | 'CUSTOMER' | 'SUPPORT';
    phone?: string;
  };
}

/**
 * In-memory rate limiting middleware
 */
export function createRateLimiter(windowMs: number = 60 * 1000, maxRequests: number = 100) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = requests.get(ip);
    if (!record || now > record.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfterMs: record.resetTime - now,
      });
      return;
    }

    record.count += 1;
    next();
  };
}

/**
 * Authentication verification middleware
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id || decoded.userId,
      role: decoded.role || 'CUSTOMER',
      phone: decoded.phone,
    };
    next();
  } catch (err: any) {
    res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }
}

/**
 * Role-Based Access Control (RBAC) middleware
 */
export function requireRole(...allowedRoles: Array<'ADMIN' | 'CUSTOMER' | 'SUPPORT'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden: You do not have sufficient permissions to access this resource',
        requiredRoles: allowedRoles,
        currentRole: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * XSS & HTML input sanitization utility
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Generates signed JWT token
 */
export function generateToken(payload: { id: string; role: 'ADMIN' | 'CUSTOMER' | 'SUPPORT'; phone?: string }, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}
