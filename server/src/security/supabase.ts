import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

export const isServerSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes('placeholder') &&
  !SUPABASE_URL.includes('gizmovault-demo') &&
  !SUPABASE_KEY.includes('placeholder') &&
  SUPABASE_KEY.length >= 20
);

export const serverSupabase: SupabaseClient | null = isServerSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export interface VerifiedUser {
  id: string;
  role: 'ADMIN' | 'CUSTOMER' | 'SUPPORT';
  email?: string;
  phone?: string;
}

/**
 * Validates a Supabase JWT access token via Supabase Auth API or JWT secret
 */
export async function verifySupabaseToken(token: string): Promise<VerifiedUser | null> {
  // 1. If JWT secret is configured, attempt fast local verification first
  if (SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as any;
      if (decoded && decoded.sub) {
        return {
          id: decoded.sub,
          // CRITICAL: Always use app_metadata for authorization role checks, never user_metadata
          role: (decoded.app_metadata?.role as 'ADMIN' | 'CUSTOMER' | 'SUPPORT') || 'CUSTOMER',
          email: decoded.email,
          phone: decoded.phone,
        };
      }
    } catch {
      // Fall through to API verification if secret verification fails
    }
  }

  // 2. Verify via Supabase Auth API if client is configured
  if (serverSupabase) {
    try {
      const { data: { user }, error } = await serverSupabase.auth.getUser(token);
      if (!error && user) {
        return {
          id: user.id,
          // Authorization check: use app_metadata
          role: (user.app_metadata?.role as 'ADMIN' | 'CUSTOMER' | 'SUPPORT') || 'CUSTOMER',
          email: user.email,
          phone: user.phone || user.user_metadata?.phone,
        };
      }
    } catch {
      return null;
    }
  }

  // 3. For development mock/demo tokens
  if (token.startsWith('mock-supabase-') || token === 'mock-supabase-token') {
    return {
      id: 'demo-supabase-user',
      role: 'CUSTOMER',
      phone: '+919876543210',
      email: 'member@gizmovault.in',
    };
  }

  return null;
}
