import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

export function seedDatabase(db: DatabaseSync): { seeded: boolean; counts: Record<string, number> } {
  // Check if already seeded
  const existingProducts = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (existingProducts && existingProducts.count > 0) {
    return {
      seeded: false,
      counts: { products: existingProducts.count }
    };
  }

  // 1. Roles
  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO admin_roles (id, name, permissions) 
    VALUES (?, ?, ?)
  `);
  insertRole.run('role_super_admin', 'SUPER_ADMIN', JSON.stringify(['*']));
  insertRole.run('role_catalog_mgr', 'CATALOG_MANAGER', JSON.stringify(['catalog:*', 'whatsapp:*', 'inventory:*']));
  insertRole.run('role_support', 'CUSTOMER_SUPPORT', JSON.stringify(['orders:*', 'users:read', 'reviews:*']));

  // 2. Admin User (Password: Admin@GizmoVault2026)
  const adminHash = bcrypt.hashSync('Admin@GizmoVault2026', 10);
  const insertAdmin = db.prepare(`
    INSERT OR IGNORE INTO admin_users (id, full_name, email, password_hash, role_id, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertAdmin.run('admin_001', 'GizmoVault Lead Admin', 'admin@gizmovault.com', adminHash, 'role_super_admin', 'ACTIVE');

  // 3. Demo Customer User (Password: Customer@2026)
  const userHash = bcrypt.hashSync('Customer@2026', 10);
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, full_name, email, phone, password_hash, is_phone_verified, is_email_verified, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run('user_demo_01', 'Rahul Sharma', 'rahul.sharma@example.com', '+919876543210', userHash, 1, 1, 'ACTIVE');

  // 4. Addresses
  const insertAddr = db.prepare(`
    INSERT OR IGNORE INTO addresses (id, user_id, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAddr.run(
    'addr_01', 'user_demo_01', 'Rahul Sharma', '+919876543210',
    'Villa 42, Palm Meadows, Whitefield', 'Near ITPL Gate 3',
    'Bengaluru', 'Karnataka', '560066', 'IN', 1
  );
  insertAddr.run(
    'addr_02', 'user_demo_01', 'Rahul Sharma', '+919876543210',
    'Tower B, 4th Floor, Cyber Park', 'Electronic City Phase 1',
    'Bengaluru', 'Karnataka', '560100', 'IN', 0
  );

  // 5. Categories
  const categories = [
    { id: 'cat_phones', name: 'Smartphones & Foldables', slug: 'smartphones-foldables', sort_order: 1, icon_url: 'Smartphone' },
    { id: 'cat_watches', name: 'Imported Luxury Watches', slug: 'imported-luxury-watches', sort_order: 2, icon_url: 'Watch' },
    { id: 'cat_audio', name: 'Audio & Sound', slug: 'audio-sound', sort_order: 3, icon_url: 'Headphones' },
    { id: 'cat_wearables', name: 'Smart Wearables', slug: 'smart-wearables', sort_order: 4, icon_url: 'Activity' },
    { id: 'cat_gaming', name: 'Gaming Gear', slug: 'gaming-gear', sort_order: 5, icon_url: 'Gamepad2' },
    { id: 'cat_drones', name: 'Photography & Drones', slug: 'photography-drones', sort_order: 6, icon_url: 'Camera' }
  ];
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, slug, description, icon_url, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  for (const c of categories) {
    insertCat.run(c.id, c.name, c.slug, `Premium ${c.name} curated globally with warranty and verified origin.`, c.icon_url, c.sort_order);
  }

  // 6. Brands
  const brands = [
    { id: 'brand_chrono', name: 'ChronoMaster', slug: 'chronomaster', country: 'Switzerland' },
    { id: 'brand_auracraft', name: 'AuraCraft', slug: 'auracraft', country: 'Japan' },
    { id: 'brand_vortex', name: 'VortexTech', slug: 'vortextech', country: 'USA' },
    { id: 'brand_soundcore', name: 'SoundCore Labs', slug: 'soundcore-labs', country: 'Germany' },
    { id: 'brand_nebulagear', name: 'NebulaGear', slug: 'nebulagear', country: 'Taiwan' },
    { id: 'brand_zenaura', name: 'ZenAura', slug: 'zenaura', country: 'UK' },
    { id: 'brand_titanimports', name: 'TitanImports', slug: 'titanimports', country: 'India' },
    { id: 'brand_gizmovault', name: 'GizmoVault Editions', slug: 'gizmovault-editions', country: 'Global' }
  ];
  const insertBrand = db.prepare(`
    INSERT OR IGNORE INTO brands (id, name, slug, origin_country)
    VALUES (?, ?, ?, ?)
  `);
  for (const b of brands) {
    insertBrand.run(b.id, b.name, b.slug, b.country);
  }

  // 7. 20 Realistic Products
  const products = [
    // Watches
    {
      id: 'prod_watch_01',
      sku: 'GV-WATCH-CHRONO-01',
      title: 'ChronoMaster Royal Tourbillon Automatic',
      short_description: 'Swiss-crafted luxury skeleton tourbillon with double sapphire crystal.',
      full_description: 'Handcrafted in Geneva, the ChronoMaster Royal Tourbillon features a 42mm 316L aerospace stainless steel case, open-worked skeleton dial, 28,800 vph high-beat automatic movement with 72-hour power reserve, and alligator-grain Italian leather strap with folding butterfly clasp.',
      category_id: 'cat_watches',
      brand_id: 'brand_chrono',
      model: 'RT-Geneva-900',
      original_price: 45000,
      selling_price: 38999,
      stock_quantity: 8,
      is_featured: 1,
      is_trending: 1,
      rating_avg: 4.9,
      rating_count: 38,
      tags: 'watch,luxury,swiss,automatic,tourbillon,skeleton',
      warranty_info: '2 Years International Manufacturer Warranty',
      images: [
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80'
      ],
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      specs: [
        { key: 'Movement', val: 'Automatic Tourbillon Caliber CM-72' },
        { key: 'Case Diameter', val: '42mm' },
        { key: 'Crystal', val: 'Dual Anti-Reflective Sapphire' },
        { key: 'Water Resistance', val: '10 ATM (100m)' },
        { key: 'Strap', val: 'Genuine Handcrafted Italian Leather' }
      ]
    },
    {
      id: 'prod_watch_02',
      sku: 'GV-WATCH-AURA-02',
      title: 'AuraCraft Celestial GMT Automatic',
      short_description: 'Japanese dual-timezone mechanical diver with bidirectional ceramic bezel.',
      full_description: 'Engineered for international voyagers, the AuraCraft Celestial GMT pairs an automatic GMT caliber with an ultra-tough black and blue ceramic bezel. Fitted with SuperLuminova BGW9 luminescence and 200m water resistance.',
      category_id: 'cat_watches',
      brand_id: 'brand_auracraft',
      model: 'AC-GMT-200',
      original_price: 32000,
      selling_price: 26500,
      stock_quantity: 14,
      is_featured: 1,
      is_trending: 0,
      rating_avg: 4.8,
      rating_count: 52,
      tags: 'watch,gmt,diver,ceramic,japan,automatic',
      warranty_info: '2 Years Comprehensive Warranty',
      images: [
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Movement', val: 'Caliber AC-GMT80 Automatic' },
        { key: 'Case Diameter', val: '41mm' },
        { key: 'Bezel', val: 'Scratch-proof Ceramic 24-hour' },
        { key: 'Water Resistance', val: '20 ATM (200m Diver)' }
      ]
    },
    {
      id: 'prod_watch_03',
      sku: 'GV-WATCH-ZEN-03',
      title: 'ZenAura Vintage Monopusher Chronograph',
      short_description: 'Classic British heritage hand-wound mechanical chronograph.',
      full_description: 'A homage to mid-century racing timing instruments. The ZenAura Monopusher starts, stops, and resets with a single integrated crown button. Features a cream enamel dial and blued steel hands.',
      category_id: 'cat_watches',
      brand_id: 'brand_zenaura',
      model: 'ZA-CHRONO-1950',
      original_price: 28000,
      selling_price: 22999,
      stock_quantity: 6,
      is_featured: 0,
      is_trending: 1,
      rating_avg: 4.7,
      rating_count: 19,
      tags: 'watch,chronograph,vintage,vintage-racing,mechanical',
      warranty_info: '1 Year Mechanical Guarantee',
      images: [
        'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Movement', val: 'Manual Wind Column Wheel' },
        { key: 'Case Diameter', val: '39mm' },
        { key: 'Power Reserve', val: '48 Hours' }
      ]
    },
    {
      id: 'prod_watch_04',
      sku: 'GV-WATCH-CHRONO-04',
      title: 'ChronoMaster DeepSea Diver 300M',
      short_description: 'Professional grade saturation diver with automatic helium escape valve.',
      full_description: 'Certified ISO 6425 diving instrument built with brushed 904L grade steel, unidirectional 120-click ceramic bezel, and expandable wet-suit bracelet link.',
      category_id: 'cat_watches',
      brand_id: 'brand_chrono',
      model: 'DS-DIVER-300',
      original_price: 36000,
      selling_price: 29999,
      stock_quantity: 11,
      is_featured: 0,
      is_trending: 0,
      rating_avg: 4.9,
      rating_count: 27,
      tags: 'watch,diver,deepsea,waterproof,professional',
      warranty_info: '3 Years Diving Performance Warranty',
      images: [
        'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Water Resistance', val: '30 ATM (300m)' },
        { key: 'Helium Valve', val: 'Automatic' },
        { key: 'Crystal', val: '4.5mm Domed Sapphire' }
      ]
    },

    // Smartphones & Foldables
    {
      id: 'prod_phone_01',
      sku: 'GV-PHONE-VORTEX-01',
      title: 'Vortex Fold Pro 5G (16GB/512GB)',
      short_description: 'Flagship foldable with zero-crease titanium hinge and Snapdragon 8 Gen 3.',
      full_description: 'Transform your mobile productivity with the Vortex Fold Pro 5G. Featuring an ultra-thin 8.03-inch 2K 120Hz LTPO AMOLED interior screen, aerospace carbon fiber support plates, triple 50MP Zeiss calibrated optical sensors, and 5000mAh dual-cell silicon-anode battery.',
      category_id: 'cat_phones',
      brand_id: 'brand_vortex',
      model: 'VF-PRO-5G',
      original_price: 149999,
      selling_price: 129999,
      stock_quantity: 12,
      is_featured: 1,
      is_trending: 1,
      rating_avg: 4.9,
      rating_count: 114,
      tags: 'phone,foldable,flagship,snapdragon,5g,titanium',
      warranty_info: '1 Year Full Unit + 1 Free Screen Replacement',
      images: [
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'
      ],
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      specs: [
        { key: 'Processor', val: 'Snapdragon 8 Gen 3 (4nm)' },
        { key: 'Main Display', val: '8.03-inch 2K 120Hz LTPO AMOLED' },
        { key: 'Cover Display', val: '6.53-inch FHD+ 120Hz AMOLED' },
        { key: 'RAM & Storage', val: '16GB LPDDR5X + 512GB UFS 4.0' },
        { key: 'Charging', val: '100W Wired + 50W Wireless Flash' }
      ]
    },
    {
      id: 'prod_phone_02',
      sku: 'GV-PHONE-VORTEX-02',
      title: 'Vortex CyberPhone Ultra 5G (Titanium Gray)',
      short_description: '200MP periscope zoom camera phone with 100x Space Zoom.',
      full_description: 'Crafted from forged Grade 5 titanium, the CyberPhone Ultra 5G sets the benchmark in mobile astrophotography with custom periscope glass optics and AI sensor processing.',
      category_id: 'cat_phones',
      brand_id: 'brand_vortex',
      model: 'CPU-ULTRA-200',
      original_price: 89999,
      selling_price: 76999,
      stock_quantity: 18,
      is_featured: 1,
      is_trending: 1,
      rating_avg: 4.8,
      rating_count: 89,
      tags: 'phone,camera,200mp,5g,ultra,titanium',
      warranty_info: '1 Year Brand Warranty',
      images: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Camera', val: '200MP Main + 50MP Periscope 5x' },
        { key: 'Battery', val: '5400mAh High-Density' },
        { key: 'Build', val: 'Grade 5 Titanium + Ceramic Shield' }
      ]
    },
    {
      id: 'prod_phone_03',
      sku: 'GV-PHONE-NEBULA-03',
      title: 'Nebula Flip Cyber 5G (8GB/256GB)',
      short_description: 'Pocket-sized clamshell foldable with interactive full outer display.',
      full_description: 'Fun, ultra-portable, and versatile. Prop it up at any angle between 45° and 135° for hands-free video calls, vlogs, and hyperlapse photography.',
      category_id: 'cat_phones',
      brand_id: 'brand_nebulagear',
      model: 'NF-CYBER-CLAM',
      original_price: 79999,
      selling_price: 64999,
      stock_quantity: 9,
      is_featured: 0,
      is_trending: 1,
      rating_avg: 4.6,
      rating_count: 45,
      tags: 'phone,foldable,flip,vlog,clamshell',
      warranty_info: '1 Year Hinge & Display Warranty',
      images: [
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Outer Screen', val: '3.6-inch 144Hz Full Cover Screen' },
        { key: 'Weight', val: '184g' }
      ]
    },

    // Audio & Sound
    {
      id: 'prod_audio_01',
      sku: 'GV-AUDIO-SOUND-01',
      title: 'SoundCore Horizon ANC Wireless Headphones',
      short_description: 'Audiophile over-ear headphones with custom 40mm bio-cellulose drivers and 60hr battery.',
      full_description: 'Experience studio clarity anywhere. SoundCore Horizon ANC provides up to -48dB adaptive hybrid noise cancellation, dual Hi-Res audio certified wired/wireless playback with LDAC codec support, and ultra-plush memory foam earcups.',
      category_id: 'cat_audio',
      brand_id: 'brand_soundcore',
      model: 'SH-ANC-PRO',
      original_price: 24999,
      selling_price: 18999,
      stock_quantity: 25,
      is_featured: 1,
      is_trending: 1,
      rating_avg: 4.8,
      rating_count: 142,
      tags: 'audio,headphones,anc,bluetooth,ldac,hi-res',
      warranty_info: '18 Months Replacement Warranty',
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Driver', val: '40mm Custom Bio-Cellulose Dome' },
        { key: 'ANC Depth', val: '-48dB Adaptive Hybrid' },
        { key: 'Battery Life', val: '60 Hours (ANC Off) / 45 Hours (ANC On)' },
        { key: 'Codecs', val: 'LDAC, AAC, SBC' }
      ]
    },
    {
      id: 'prod_audio_02',
      sku: 'GV-AUDIO-SOUND-02',
      title: 'SoundCore AeroBuds Pro 3 (Spatial Audio)',
      short_description: 'True wireless earbuds with real-time head tracking and 6-mic clear calls.',
      full_description: 'Dynamic 11mm coaxial acoustic drivers paired with planar tweeters deliver crisp highs and resonant sub-bass. Features IPX5 sweat resistance and Qi wireless charging case.',
      category_id: 'cat_audio',
      brand_id: 'brand_soundcore',
      model: 'SAB-PRO-3',
      original_price: 14999,
      selling_price: 11499,
      stock_quantity: 32,
      is_featured: 0,
      is_trending: 1,
      rating_avg: 4.7,
      rating_count: 98,
      tags: 'audio,earbuds,tws,spatial,wireless,anc',
      warranty_info: '1 Year Warranty',
      images: [
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Drivers', val: '11mm Dynamic + Micro Planar' },
        { key: 'Microphones', val: '6-Mic AI Beamforming' }
      ]
    },
    {
      id: 'prod_audio_03',
      sku: 'GV-AUDIO-NEBULA-03',
      title: 'Nebula SonicBlast Portable Hi-Fi Speaker (80W)',
      short_description: 'Rugged IP67 waterproof outdoor speaker with synchronized 360° light show.',
      full_description: 'Dual racetrack woofers and twin silk tweeters produce 80W RMS room-filling audio. Connect up to 100 speakers together with PartyCast 2.0.',
      category_id: 'cat_audio',
      brand_id: 'brand_nebulagear',
      model: 'NSB-80W-IP67',
      original_price: 12999,
      selling_price: 8999,
      stock_quantity: 20,
      is_featured: 0,
      is_trending: 0,
      rating_avg: 4.6,
      rating_count: 67,
      tags: 'audio,speaker,bluetooth,waterproof,party,portable',
      warranty_info: '1 Year Warranty',
      images: [
        'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Output Power', val: '80W RMS' },
        { key: 'Water Resistance', val: 'IP67 Dust & Waterproof' },
        { key: 'Playtime', val: '24 Hours at 50% Volume' }
      ]
    },

    // Smart Wearables
    {
      id: 'prod_wear_01',
      sku: 'GV-WEAR-VORTEX-01',
      title: 'Vortex Watch Ultra Apex (49mm Titanium)',
      short_description: 'Rugged multi-sport smartwatch with dual-frequency GPS, ECG, and cellular eSIM.',
      full_description: 'Built for extreme expeditions. Encased in Grade 5 titanium with a flat sapphire front crystal and raised protective bezel. Features 100m water resistance, EN13319 dive computer certification, and emergency siren.',
      category_id: 'cat_wearables',
      brand_id: 'brand_vortex',
      model: 'VWU-49MM-TITAN',
      original_price: 42999,
      selling_price: 34999,
      stock_quantity: 15,
      is_featured: 1,
      is_trending: 1,
      rating_avg: 4.9,
      rating_count: 73,
      tags: 'wearable,smartwatch,gps,titanium,ecg,sports',
      warranty_info: '2 Years Comprehensive Coverage',
      images: [
        'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Case', val: '49mm Aerospace Titanium' },
        { key: 'Display', val: '2000 nits Always-On Sapphire OLED' },
        { key: 'Sensors', val: 'ECG, SpO2, Optical Heart Rate, Depth Gauge' }
      ]
    },
    {
      id: 'prod_wear_02',
      sku: 'GV-WEAR-AURA-02',
      title: 'AuraCraft SmartRing Gen 3 (Titanium Stealth)',
      short_description: 'Featherlight 4g titanium smart ring with medical-grade sleep & recovery tracking.',
      full_description: 'Track sleep staging, skin temperature variations, heart rate variability (HRV), and workout strain without wearing an intrusive watch screen to bed. 7-day battery on a single 45-minute induction charge.',
      category_id: 'cat_wearables',
      brand_id: 'brand_auracraft',
      model: 'AC-RING-GEN3',
      original_price: 19999,
      selling_price: 15499,
      stock_quantity: 18,
      is_featured: 1,
      is_trending: 1,
      rating_avg: 4.8,
      rating_count: 61,
      tags: 'wearable,smartring,health,sleep,fitness,titanium',
      warranty_info: '1 Year Warranty',
      images: [
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Weight', val: '4 to 6 grams (depending on size)' },
        { key: 'Water Resistance', val: '100m / IP68' },
        { key: 'Battery', val: 'Up to 7 Days' }
      ]
    },
    {
      id: 'prod_wear_03',
      sku: 'GV-WEAR-ZEN-03',
      title: 'ZenAura Vision AR Smart Glasses',
      short_description: 'Stylish daily-wear prescription-ready frames with Micro-OLED heads-up display.',
      full_description: 'Seamless teleprompter, turn-by-turn navigation arrows, and instant voice translations discreetly projected into your right eye field. Built-in open-ear whisper speakers for calls and music.',
      category_id: 'cat_wearables',
      brand_id: 'brand_zenaura',
      model: 'ZA-VISION-AR1',
      original_price: 39999,
      selling_price: 31999,
      stock_quantity: 7,
      is_featured: 0,
      is_trending: 1,
      rating_avg: 4.6,
      rating_count: 24,
      tags: 'wearable,ar,glasses,smart-glasses,hud,ai',
      warranty_info: '1 Year Tech & Frame Warranty',
      images: [
        'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Display Type', val: 'Micro-OLED Waveguide' },
        { key: 'Weight', val: '43g Lightweight Frame' }
      ]
    },

    // Gaming Gear
    {
      id: 'prod_game_01',
      sku: 'GV-GAME-NEBULA-01',
      title: 'Nebula CyberDeck RGB Handheld Console (1TB)',
      short_description: 'AMD Ryzen Z1 Extreme powered gaming handheld with 8.4" 144Hz screen.',
      full_description: 'Play AAA PC titles anywhere with native desktop-class graphics. Hall-effect anti-drift analog sticks, dual haptic trackpads, 16GB LPDDR5X memory, and fast USB4 eGPU expansion support.',
      category_id: 'cat_gaming',
      brand_id: 'brand_nebulagear',
      model: 'NC-DECK-Z1',
      original_price: 74999,
      selling_price: 64999,
      stock_quantity: 10,
      is_featured: 1,
      is_trending: 1,
      rating_avg: 4.8,
      rating_count: 56,
      tags: 'gaming,handheld,console,pc-gaming,ryzen,rgb',
      warranty_info: '1 Year Comprehensive Console Warranty',
      images: [
        'https://images.unsplash.com/photo-1612287233207-68b2512803b9?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Processor', val: 'AMD Ryzen Z1 Extreme (8C/16T, up to 5.1GHz)' },
        { key: 'Display', val: '8.4-inch 2560x1600 144Hz IPS Touch' },
        { key: 'Storage', val: '1TB M.2 NVMe PCIe 4.0' }
      ]
    },
    {
      id: 'prod_game_02',
      sku: 'GV-GAME-VORTEX-02',
      title: 'Vortex Tactile Pro Rapid-Trigger Keyboard',
      short_description: 'Magnetic Hall effect switch keyboard with 0.1mm adjustable actuation.',
      full_description: 'CNC machined anodized aluminum body, gasket mounted sound dampening, custom RGB per-key illumination, and 8,000Hz polling rate for instant esports responsiveness.',
      category_id: 'cat_gaming',
      brand_id: 'brand_vortex',
      model: 'VT-PRO-RAPID',
      original_price: 16999,
      selling_price: 13499,
      stock_quantity: 22,
      is_featured: 0,
      is_trending: 0,
      rating_avg: 4.9,
      rating_count: 81,
      tags: 'gaming,keyboard,hall-effect,rapid-trigger,esports',
      warranty_info: '2 Years Switch & PCB Warranty',
      images: [
        'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Switches', val: 'Magnetic Hall Effect with 0.1-4.0mm Actuation' },
        { key: 'Polling Rate', val: '8000Hz Ultra-Low Latency' }
      ]
    },
    {
      id: 'prod_game_03',
      sku: 'GV-GAME-NEBULA-03',
      title: 'Nebula Precision Ultralight Wireless Mouse (42g)',
      short_description: 'Magnesium alloy skeleton gaming mouse with PAW3395 26,000 DPI sensor.',
      full_description: 'Engineered for competitive shooters. At only 42 grams, this magnesium exoskeleton mouse glides effortlessly on pure PTFE skates with up to 80 hours of lag-free wireless battery.',
      category_id: 'cat_gaming',
      brand_id: 'brand_nebulagear',
      model: 'NP-ULTRA-42G',
      original_price: 9999,
      selling_price: 7499,
      stock_quantity: 30,
      is_featured: 0,
      is_trending: 1,
      rating_avg: 4.7,
      rating_count: 64,
      tags: 'gaming,mouse,ultralight,wireless,magnesium,fps',
      warranty_info: '1 Year Warranty',
      images: [
        'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Weight', val: '42 grams' },
        { key: 'Sensor', val: 'PixArt PAW3395 (26,000 DPI, 650 IPS)' }
      ]
    },

    // Photography & Drones
    {
      id: 'prod_drone_01',
      sku: 'GV-DRONE-VORTEX-01',
      title: 'Vortex SkyPhantom 4K HDR Drone',
      short_description: 'Sub-249g ultra-compact drone with 3-axis mechanical gimbal and 45min flight time.',
      full_description: 'No FAA registration required for recreation. Features 1/1.3-inch dual-native ISO camera sensor, omnidirectional APAS 5.0 obstacle sensing, 12km FHD video transmission, and vertical shooting mode for social media creators.',
      category_id: 'cat_drones',
      brand_id: 'brand_vortex',
      model: 'VSP-4K-249G',
      original_price: 68999,
      selling_price: 56999,
      stock_quantity: 8,
      is_featured: 1,
      is_trending: 1,
      rating_avg: 4.9,
      rating_count: 42,
      tags: 'drone,4k,aerial,photography,gimbal,sub249g',
      warranty_info: '1 Year Drone Care Package Included',
      images: [
        'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Takeoff Weight', val: '249 grams' },
        { key: 'Max Flight Time', val: '45 Minutes' },
        { key: 'Video Resolution', val: '4K/60fps HDR & 4K/100fps Slow-Mo' }
      ]
    },
    {
      id: 'prod_drone_02',
      sku: 'GV-CAM-AURA-02',
      title: 'AuraCraft Pocket Cinema Gimbal Camera',
      short_description: 'Palm-sized 1-inch sensor 4K120fps creator camera with 3-axis motorized stabilization.',
      full_description: 'Rotate the vibrant 2-inch OLED touchscreen to instantly start filming. Features 3 built-in directional microphones, face-tracking ActiveTrack 6.0, and 10-bit D-Log M color profile for cinematic grading.',
      category_id: 'cat_drones',
      brand_id: 'brand_auracraft',
      model: 'AC-POCKET-CAM',
      original_price: 44999,
      selling_price: 36999,
      stock_quantity: 14,
      is_featured: 0,
      is_trending: 1,
      rating_avg: 4.8,
      rating_count: 53,
      tags: 'camera,vlog,gimbal,4k,creator,pocket-camera',
      warranty_info: '1 Year Hardware Guarantee',
      images: [
        'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Sensor', val: '1-inch CMOS 4K/120fps' },
        { key: 'Battery Life', val: '166 Minutes continuous recording' }
      ]
    },
    {
      id: 'prod_drone_03',
      sku: 'GV-MIC-SOUND-03',
      title: 'SoundCore WavePod Dual Wireless Lavalier Kit',
      short_description: '32-bit float onboard recording dual microphone with 250m transmission range.',
      full_description: 'Never ruin audio with clipping again. 32-bit float internal backup recording saves every whisper and shout flawlessly. Includes magnetic clip mounts, lightning/USB-C adapters, and charging dock case.',
      category_id: 'cat_drones',
      brand_id: 'brand_soundcore',
      model: 'SWP-MIC-2TX',
      original_price: 18999,
      selling_price: 14999,
      stock_quantity: 28,
      is_featured: 0,
      is_trending: 0,
      rating_avg: 4.7,
      rating_count: 36,
      tags: 'audio,microphone,wireless,lavalier,recording,creator',
      warranty_info: '1 Year Warranty',
      images: [
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Recording Format', val: '32-bit Float Internal Storage (14hr)' },
        { key: 'Transmission', val: '2.4GHz FHSS up to 250m Line-of-sight' }
      ]
    },
    {
      id: 'prod_gizmo_01',
      sku: 'GV-EDITION-CORE-01',
      title: 'GizmoVault Founder Edition Carbon PowerStation (140W)',
      short_description: 'Aviation-certified 27,600mAh power bank with color TFT power telemetry display.',
      full_description: 'Exclusive commemorative Founder Edition. Ultra-fast dual USB-C PD 3.1 140W output capable of charging a 16-inch MacBook Pro to 50% in 28 minutes. Features real-time per-port watt, volt, amp, and thermal telemetry.',
      category_id: 'cat_gaming',
      brand_id: 'brand_gizmovault',
      model: 'GV-FOUNDER-140W',
      original_price: 15999,
      selling_price: 11999,
      stock_quantity: 40,
      is_featured: 1,
      is_trending: 1,
      rating_avg: 5.0,
      rating_count: 168,
      tags: 'powerbank,140w,usb-c,telemetry,carbon-fiber,gizmovault',
      warranty_info: '2 Years No-Questions Replacement',
      images: [
        'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80'
      ],
      specs: [
        { key: 'Capacity', val: '27,600mAh / 99.54Wh (Airline Safe)' },
        { key: 'Max Output', val: '140W PD 3.1 Fast Charging' }
      ]
    }
  ];

  const insertProd = db.prepare(`
    INSERT OR IGNORE INTO products (
      id, sku, title, short_description, full_description,
      category_id, brand_id, model, currency,
      original_price, selling_price, discount_amount, discount_percent,
      stock_quantity, stock_status, low_stock_threshold,
      is_published, is_featured, is_trending,
      warranty_info, shipping_class, origin_source, tags,
      rating_avg, rating_count
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, 'INR',
      ?, ?, ?, ?,
      ?, ?, 5,
      1, ?, ?,
      ?, 'STANDARD', 'SEED', ?,
      ?, ?
    )
  `);

  const insertImg = db.prepare(`
    INSERT OR IGNORE INTO product_images (id, product_id, image_url, is_primary, display_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertVid = db.prepare(`
    INSERT OR IGNORE INTO product_videos (id, product_id, video_url, format)
    VALUES (?, ?, ?, 'mp4')
  `);

  const insertSpecVal = db.prepare(`
    INSERT OR IGNORE INTO product_specifications (id, product_id, spec_key, spec_value, display_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertInventory = db.prepare(`
    INSERT OR IGNORE INTO inventory (id, product_id, quantity_available, quantity_reserved, low_stock_threshold)
    VALUES (?, ?, ?, 0, 5)
  `);

  const insertPrice = db.prepare(`
    INSERT OR IGNORE INTO prices (id, product_id, currency, amount, is_active)
    VALUES (?, ?, 'INR', ?, 1)
  `);

  for (const p of products) {
    const discountAmt = Math.max(0, p.original_price - p.selling_price);
    const discountPct = Math.round((discountAmt / p.original_price) * 100);
    const stockStatus = p.stock_quantity > 5 ? 'IN_STOCK' : (p.stock_quantity > 0 ? 'LOW_STOCK' : 'OUT_OF_STOCK');

    insertProd.run(
      p.id, p.sku, p.title, p.short_description, p.full_description,
      p.category_id, p.brand_id, p.model,
      p.original_price, p.selling_price, discountAmt, discountPct,
      p.stock_quantity, stockStatus,
      p.is_featured, p.is_trending,
      p.warranty_info, p.tags,
      p.rating_avg, p.rating_count
    );

    // Images
    p.images.forEach((imgUrl, idx) => {
      insertImg.run(`img_${p.id}_${idx}`, p.id, imgUrl, idx === 0 ? 1 : 0, idx);
    });

    // Video if present
    if (p.video) {
      insertVid.run(`vid_${p.id}`, p.id, p.video);
    }

    // Specs
    if (p.specs) {
      p.specs.forEach((s, idx) => {
        insertSpecVal.run(`spec_${p.id}_${idx}`, p.id, s.key, s.val, idx);
      });
    }

    // Inventory & Price records
    insertInventory.run(`inv_${p.id}`, p.id, p.stock_quantity);
    insertPrice.run(`price_${p.id}`, p.id, p.selling_price);
  }

  // 8. Coupons
  const coupons = [
    { id: 'cpn_gizmo10', code: 'GIZMO10', type: 'PERCENT', value: 10, min_order: 2000, max_disc: 1000 },
    { id: 'cpn_gizmo500', code: 'GIZMO500', type: 'FLAT', value: 500, min_order: 3000, max_disc: 500 },
    { id: 'cpn_watch50', code: 'WATCH50', type: 'PERCENT', value: 20, min_order: 20000, max_disc: 5000 },
    { id: 'cpn_welcome100', code: 'WELCOME100', type: 'FLAT', value: 100, min_order: 500, max_disc: 100 }
  ];
  const insertCpn = db.prepare(`
    INSERT OR IGNORE INTO coupons (id, code, discount_type, discount_value, min_order_amount, max_discount_amount, valid_from, valid_until, usage_limit, per_user_limit, is_active)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, datetime('now', '+365 days'), 1000, 2, 1)
  `);
  for (const c of coupons) {
    insertCpn.run(c.id, c.code, c.type, c.value, c.min_order, c.max_disc);
  }

  // 9. WhatsApp Sources
  const insertSource = db.prepare(`
    INSERT OR IGNORE INTO whatsapp_sources (id, phone_number_id, display_name, business_account_id, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);
  insertSource.run('src_wa_meta', '109283746501928', 'GizmoVault Official Meta Cloud API', 'WABA_CORP_99182');
  insertSource.run('src_wa_sim', '999888777666', 'GizmoVault Webhook Simulator Channel', 'WABA_SIM_001');

  // 10. Sample WhatsApp Message & Extracted Ingestion Product
  const insertWaMsg = db.prepare(`
    INSERT OR IGNORE INTO whatsapp_messages (id, source_id, meta_message_id, sender_phone, message_type, caption, processing_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertWaMsg.run(
    'msg_seed_01', 'src_wa_meta', 'wamid.HBgLMjAyNjA5MTk=', '+919811122233',
    'image', 'Fresh arrival from Japan! Seiko Mod Royal Oak Rose Gold Custom Automatic with Japanese NH35 movement. MRP 24,000, selling for 17,999 with box and papers. DM to reserve!',
    'PROCESSED'
  );

  const insertExtracted = db.prepare(`
    INSERT OR IGNORE INTO extracted_products (
      id, message_id, extracted_title, extracted_category, suggested_category_id,
      extracted_brand, extracted_model, extracted_original_price, extracted_selling_price,
      extracted_discount, extracted_specs, extracted_description, confidence_score, approval_status
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);
  insertExtracted.run(
    'ext_prod_seed_01', 'msg_seed_01', 'Seiko Mod Royal Oak Rose Gold Custom Automatic',
    'Imported Luxury Watches', 'cat_watches', 'AuraCraft', 'Royal Oak Custom NH35',
    24000, 17999, 6001,
    JSON.stringify({ Movement: 'Japanese NH35 Automatic', Case: 'Rose Gold PVD Steel', Dial: 'Tapisserie Textured' }),
    'Fresh arrival imported watch with box, warranty card, and verified NH35 movement.',
    0.94, 'NEEDS_REVIEW'
  );

  // 11. Sample Completed Order
  const insertOrder = db.prepare(`
    INSERT OR IGNORE INTO orders (
      id, order_number, user_id, address_id, subtotal, discount_total, coupon_id,
      shipping_fee, tax_amount, grand_total, order_status, payment_status, shipping_address_snapshot
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      0.0, 0.0, ?, 'DELIVERED', 'COMPLETED', ?
    )
  `);
  insertOrder.run(
    'ord_demo_01', 'GV-2026-889102', 'user_demo_01', 'addr_01',
    38999, 1000, 'cpn_gizmo10', 37999,
    JSON.stringify({
      recipient: 'Rahul Sharma',
      phone: '+919876543210',
      address: 'Villa 42, Palm Meadows, Whitefield, Bengaluru, KA 560066'
    })
  );

  const insertOrderItem = db.prepare(`
    INSERT OR IGNORE INTO order_items (id, order_id, product_id, title_snapshot, sku_snapshot, unit_price, quantity, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertOrderItem.run(
    'oi_demo_01', 'ord_demo_01', 'prod_watch_01',
    'ChronoMaster Royal Tourbillon Automatic', 'GV-WATCH-CHRONO-01',
    38999, 1, 38999
  );

  const insertPayment = db.prepare(`
    INSERT OR IGNORE INTO payments (id, order_id, provider, provider_payment_id, provider_order_id, amount, status, payment_method)
    VALUES (?, ?, 'RAZORPAY', 'pay_sim_998127391', 'order_sim_8819283', 37999, 'CAPTURED', 'UPI')
  `);
  insertPayment.run('pay_demo_01', 'ord_demo_01');

  // Shipment record
  const insertShipment = db.prepare(`
    INSERT OR IGNORE INTO shipments (id, order_id, carrier, tracking_number, shipment_status, shipped_at, delivered_at)
    VALUES (?, ?, 'Bluedart Express', 'GV-TRK-881928', 'DELIVERED', datetime('now', '-2 days'), datetime('now', '-1 day'))
  `);
  insertShipment.run('shp_demo_01', 'ord_demo_01');

  return {
    seeded: true,
    counts: {
      categories: categories.length,
      brands: brands.length,
      products: products.length,
      coupons: coupons.length
    }
  };
}
