import { createClient, SupabaseClient, User, Session, AuthChangeEvent } from '@supabase/supabase-js';

// Read Vite environment variables
const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL;
const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_URL = envUrl || 'https://gizmovault-demo.supabase.co';
export const SUPABASE_ANON_KEY = envKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const isSupabaseConfigured = Boolean(
  envUrl &&
  envKey &&
  !envUrl.includes('placeholder') &&
  !envUrl.includes('gizmovault-demo') &&
  !envKey.includes('placeholder') &&
  envKey.length >= 20
);

/**
 * Singleton Supabase Client for client-side authentication & storage
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Authentication helper methods
 */
export async function signInWithOtp(phone: string) {
  if (!isSupabaseConfigured) {
    // Sandbox / Demo mode fallback
    return {
      data: { user: null, session: null },
      error: null,
      demoMode: true,
    };
  }
  return await supabase.auth.signInWithOtp({
    phone,
    options: {
      channel: 'sms',
    },
  });
}

export async function verifyOtp(phone: string, token: string) {
  if (!isSupabaseConfigured) {
    // Sandbox fallback
    const mockUser: User = {
      id: 'demo-user-101',
      app_metadata: { role: 'CUSTOMER' },
      user_metadata: { full_name: 'Vault Member', phone },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      phone,
    } as User;
    return {
      data: { user: mockUser, session: { access_token: 'mock-supabase-token', user: mockUser } as any },
      error: null,
      demoMode: true,
    };
  }
  return await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
}

export async function signInWithEmail(email: string, password?: string) {
  if (!isSupabaseConfigured) {
    const mockUser: User = {
      id: 'demo-user-email-101',
      app_metadata: { role: 'CUSTOMER' },
      user_metadata: { full_name: 'Verified Customer', email },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email,
    } as User;
    return {
      data: { user: mockUser, session: { access_token: 'mock-supabase-email-token', user: mockUser } as any },
      error: null,
      demoMode: true,
    };
  }

  if (password) {
    return await supabase.auth.signInWithPassword({ email, password });
  }

  // Magic link fallback
  return await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
}

export async function signUpWithEmail(email: string, password: string, fullName?: string, phone?: string) {
  if (!isSupabaseConfigured) {
    const mockUser: User = {
      id: 'demo-user-new-101',
      app_metadata: { role: 'CUSTOMER' },
      user_metadata: { full_name: fullName || 'Vault Customer', phone },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email,
      phone,
    } as User;
    return {
      data: { user: mockUser, session: { access_token: 'mock-supabase-signup-token', user: mockUser } as any },
      error: null,
      demoMode: true,
    };
  }

  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
      },
    },
  });
}

export async function signOut() {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
  return { error: null };
}

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

export interface SupabaseProductRow {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  category?: string | null;
  media_url: string;
  media_type?: string | null;
  status?: string;
  created_at?: string;
}

/**
 * Maps Supabase products table row into GizmoVault customer Product format
 */
export function mapSupabaseRowToProduct(row: SupabaseProductRow) {
  const isWatch = (row.category || '').toLowerCase().includes('watch');
  const price = Number(row.price) || 0;
  return {
    id: row.id,
    sku: `GV-SUPA-${row.id.substring(0, 6).toUpperCase()}`,
    title: row.title,
    shortDescription: row.description || '',
    fullDescription: row.description || row.title,
    category: row.category || (isWatch ? 'Imported Watches' : 'Electronic Gadgets'),
    categorySlug: isWatch ? 'imported-luxury-watches' : 'electronic-gadgets',
    brand: isWatch ? 'Horology Vault' : 'GizmoVault Curated',
    model: 'Global Edition',
    originalPrice: Math.round(price * 1.25) || price,
    sellingPrice: price,
    discountPercent: price > 0 ? 20 : 0,
    currency: 'INR',
    primaryImage: row.media_url,
    images: [row.media_url],
    hasVideo: row.media_type === 'video',
    videoUrl: row.media_type === 'video' ? row.media_url : undefined,
    stockQuantity: 20,
    stockStatus: 'IN_STOCK' as const,
    rating: 4.9,
    ratingCount: 24,
    warranty: '1 Year Comprehensive Warranty',
    shippingClass: 'Express Insured Air',
    tags: ['Verified Import', 'Supabase Synced'],
    specifications: {
      'Cloud Source': 'Supabase Realtime Cloud',
      'Media Storage': 'Cloudflare R2 Public CDN',
      'Media Type': row.media_type || 'image',
    },
    isFeatured: true,
    isTrending: true,
  };
}

/**
 * Fetch active products directly from Supabase products table
 */
export async function fetchSupabaseProducts(): Promise<SupabaseProductRow[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Products query error:', error.message);
      return [];
    }
    return (data as SupabaseProductRow[]) || [];
  } catch (err) {
    console.warn('[Supabase] Failed to fetch products:', err);
    return [];
  }
}

/**
 * Subscribes to Realtime broadcast changes on the 'products' table
 * Matches Step 3 of the Checklist:
 * supabase.channel("products-feed").postgresChangeFlow { table = "products" }
 */
export function subscribeToProductsRealtime(onChange: (payload: any) => void) {
  try {
    const channel = supabase
      .channel('products-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('[Supabase Realtime] Product event received:', payload);
          onChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('[Supabase Realtime] Channel subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[Supabase Realtime] Could not subscribe:', err);
    return () => {};
  }
}

/**
 * Insert a product into Supabase products table
 */
export async function insertSupabaseProduct(product: Omit<SupabaseProductRow, 'id' | 'created_at'>) {
  return await supabase
    .from('products')
    .insert([product])
    .select()
    .single();
}

/**
 * Update an existing product in Supabase products table
 */
export async function updateSupabaseProduct(id: string, updates: Partial<SupabaseProductRow>) {
  return await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
}

/**
 * Delete a product from Supabase products table
 */
export async function deleteSupabaseProduct(id: string) {
  return await supabase
    .from('products')
    .delete()
    .eq('id', id);
}

