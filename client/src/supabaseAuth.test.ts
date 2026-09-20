import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  supabase,
  signInWithOtp,
  verifyOtp,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured
} from './services/supabase';
import { getAuthHeaders } from './services/api';

describe('Supabase Client & Auth Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes Supabase client with live project URL and publishable key', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.auth.signInWithOtp).toBe('function');
    expect(typeof supabase.auth.getSession).toBe('function');
    expect(SUPABASE_URL).toBe('https://mfdcxaogtjbcdpmjljsd.supabase.co');
    expect(SUPABASE_ANON_KEY.length).toBeGreaterThan(20);
    expect(isSupabaseConfigured).toBe(true);
  });

  it('handles Phone OTP dispatch via Supabase Auth API', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOtp').mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null
    } as any);

    const res = await signInWithOtp('+919876543210');
    expect(res).toBeDefined();
    expect(res.error).toBeNull();
    expect(spy).toHaveBeenCalledWith({
      phone: '+919876543210',
      options: { channel: 'sms' }
    });
  });

  it('verifies Phone OTP and returns authenticated Supabase session', async () => {
    const mockUser = { id: 'supabase-user-1', phone: '+919876543210' };
    const mockSession = { access_token: 'valid-jwt-token', user: mockUser };

    vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
      data: { user: mockUser as any, session: mockSession as any },
      error: null
    });

    const res = await verifyOtp('+919876543210', '123456');
    expect(res).toBeDefined();
    expect(res.error).toBeNull();
    expect(res.data?.user?.phone).toBe('+919876543210');
  });

  it('supports Email password authentication', async () => {
    const mockUser = { id: 'supabase-user-2', email: 'buyer@example.com' };
    const mockSession = { access_token: 'valid-email-jwt', user: mockUser };

    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
      data: { user: mockUser as any, session: mockSession as any },
      error: null
    });

    const res = await signInWithEmail('buyer@example.com', 'securepass123');
    expect(res).toBeDefined();
    expect(res.error).toBeNull();
    expect(res.data?.user?.email).toBe('buyer@example.com');
  });

  it('supports Email user registration with metadata', async () => {
    const mockUser = { id: 'supabase-user-3', email: 'newbuyer@example.com' };
    const mockSession = { access_token: 'valid-signup-jwt', user: mockUser };

    const spy = vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
      data: { user: mockUser as any, session: mockSession as any },
      error: null
    });

    const res = await signUpWithEmail('newbuyer@example.com', 'pass456', 'Priya Patel', '+919876500000');
    expect(res).toBeDefined();
    expect(res.error).toBeNull();
    expect(res.data?.user?.email).toBe('newbuyer@example.com');
    expect(spy).toHaveBeenCalledWith({
      email: 'newbuyer@example.com',
      password: 'pass456',
      options: {
        data: {
          full_name: 'Priya Patel',
          phone: '+919876500000'
        }
      }
    });
  });

  it('handles signOut cleanly', async () => {
    const spy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({ error: null });
    const res = await signOut();
    expect(res).toBeDefined();
    expect(res.error).toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  it('generates standard auth headers with JSON accept header', async () => {
    const headers = await getAuthHeaders();
    expect(headers['Accept']).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
  });
});
