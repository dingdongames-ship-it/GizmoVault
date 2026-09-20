import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mfdcxaogtjbcdpmjljsd.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_0f0rN18eNI7cXXjhWFpggQ_d-hlFVs8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SEED_PRODUCTS = [
  {
    title: 'Aura Tachymeter Sapphire Chronograph Watch',
    description: 'Precision 316L stainless steel chronograph with scratch-resistant sapphire glass, Swiss-inspired quartz movement, and 100m water resistance.',
    price: 4499,
    category: 'Imported Watches',
    media_url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
    media_type: 'image',
    status: 'ACTIVE'
  },
  {
    title: 'Titanium Ultra AMOLED Smartwatch 5.3 BT Calling',
    description: '1.43" Always-On AMOLED 466x466 display, aerospace titanium bezel, dual-mic ENC Bluetooth calling, and continuous multi-sensor biometric tracking.',
    price: 2899,
    category: 'Imported Watches',
    media_url: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80',
    media_type: 'image',
    status: 'ACTIVE'
  },
  {
    title: 'HyperCharge 140W GaN 5-Port Travel Desktop Hub',
    description: 'Next-gen Gallium Nitride (GaN III) fast desktop charger with 3x USB-C PD 3.1 ports, 2x USB-A ports, real-time OLED wattage readout, and active thermal protection.',
    price: 3499,
    category: 'Electronic Gadgets',
    media_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
    media_type: 'image',
    status: 'ACTIVE'
  },
  {
    title: 'Vortex Sonic ANC Wireless Earbuds with LDAC Hi-Res',
    description: 'Hybrid Active Noise Cancellation (-48dB), 11mm bio-cellulose dynamic drivers, LDAC 990kbps codec, 38-hour battery with Qi wireless charging case.',
    price: 1999,
    category: 'Electronic Gadgets',
    media_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
    media_type: 'image',
    status: 'ACTIVE'
  },
  {
    title: 'Nighthawk Tactical Skeleton Automatic Mechanical Watch',
    description: 'Open-heart skeletonized dial showing intricate 21-jewel automatic movement, DLC black coating, sapphire crystal, and luminescent indices.',
    price: 6999,
    category: 'Imported Watches',
    media_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
    media_type: 'image',
    status: 'ACTIVE'
  },
  {
    title: 'CyberMag 15W Qi2 Foldable 3-in-1 Travel Stand',
    description: 'Aerospace aluminum folding wireless station powering iPhone with Qi2 fast charging, Apple Watch magnetic fast puck, and AirPods simultaneously.',
    price: 2499,
    category: 'Electronic Gadgets',
    media_url: 'https://images.unsplash.com/photo-1622445262464-84b1456045b6?auto=format&fit=crop&w=800&q=80',
    media_type: 'image',
    status: 'ACTIVE'
  }
];

async function seedSupabaseCatalog() {
  console.log('Seeding Supabase `products` catalog...');

  // 1. Check existing count
  const { data: existing, error: countError } = await supabase
    .from('products')
    .select('id, title');

  if (countError) {
    console.error('Failed to query products table:', countError);
    process.exit(1);
  }

  console.log(`Current items in Supabase: ${existing?.length ?? 0}`);

  // Only seed if empty or less than 3 items
  if (existing && existing.length >= 4) {
    console.log('Catalog already populated with live products. Skipping seed.');
    return;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('products')
    .insert(SEED_PRODUCTS)
    .select();

  if (insertError) {
    console.error('Failed to seed products:', insertError);
    process.exit(1);
  }

  console.log(`Successfully seeded ${inserted?.length} products into Supabase!`);
  inserted?.forEach(p => console.log(` - [${p.id}] ${p.title} (₹${p.price})`));
}

seedSupabaseCatalog().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
