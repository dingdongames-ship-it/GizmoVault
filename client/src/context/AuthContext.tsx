import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  signInWithOtp as supabaseSignInWithOtp,
  verifyOtp as supabaseVerifyOtp,
  signInWithEmail as supabaseSignInWithEmail,
  signUpWithEmail as supabaseSignUpWithEmail,
  signOut as supabaseSignOut,
} from '../services/supabase';

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
  role: 'CUSTOMER' | 'ADMIN' | 'SUPPORT';
}

interface AuthContextType {
  user: User | null;
  authUser: AuthUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  isConfigured: boolean;
  loginWithPhoneOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyPhoneOtp: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, fullName?: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Map Supabase User to internal AuthUser
  const authUser: AuthUser | null = useMemo(() => {
    if (!user) return null;
    const meta = user.user_metadata || {};
    const appMeta = user.app_metadata || {};
    return {
      id: user.id,
      email: user.email || undefined,
      phone: user.phone || meta.phone || undefined,
      fullName: meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Vault Member'),
      role: (appMeta.role as 'CUSTOMER' | 'ADMIN' | 'SUPPORT') || 'CUSTOMER',
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (isMounted) {
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    // 2. Real-time auth state subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginWithPhoneOtp = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await supabaseSignInWithOtp(phone);
      if (res.error) {
        return { success: false, error: res.error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send OTP' };
    }
  };

  const verifyPhoneOtp = async (phone: string, otp: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await supabaseVerifyOtp(phone, otp);
      if (res.error) {
        return { success: false, error: res.error.message };
      }
      if (res.data?.user) {
        setUser(res.data.user);
        setSession(res.data.session);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'OTP verification failed' };
    }
  };

  const loginWithEmail = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await supabaseSignInWithEmail(email, password);
      if (res.error) {
        return { success: false, error: res.error.message };
      }
      if (res.data?.user) {
        setUser(res.data.user);
        setSession(res.data.session);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Email authentication failed' };
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName?: string,
    phone?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await supabaseSignUpWithEmail(email, password, fullName, phone);
      if (res.error) {
        return { success: false, error: res.error.message };
      }
      if (res.data?.user) {
        setUser(res.data.user);
        setSession(res.data.session);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  const logout = async (): Promise<void> => {
    await supabaseSignOut();
    setUser(null);
    setSession(null);
  };

  const value = {
    user,
    authUser,
    session,
    isAuthenticated: Boolean(user),
    loading,
    isConfigured: isSupabaseConfigured,
    loginWithPhoneOtp,
    verifyPhoneOtp,
    loginWithEmail,
    signUpWithEmail,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
