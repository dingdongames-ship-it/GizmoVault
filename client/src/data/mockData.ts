import { Product, Address, Order, WhatsAppIngestedItem } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    sku: 'GV-WTC-CHRONO-01',
    title: 'Aura Tachymeter Sapphire Chronograph Watch',
    shortDescription: 'Precision 316L stainless steel chronograph with scratch-resistant sapphire glass.',
    fullDescription: 'Crafted for connoisseurs, the Aura Tachymeter Chronograph combines imported Swiss-inspired quartz movement with surgical-grade 316L stainless steel. Features a triple sub-dial layout measuring 1/10th second, minutes, and running seconds, flanked by an engraved ceramic tachymeter bezel. Water-resistant to 100 meters with luminous hands.',
    category: 'Imported Watches',
    categorySlug: 'watches',
    brand: 'Aura Genève',
    model: 'Tachymeter 42',
    originalPrice: 8999,
    sellingPrice: 4499,
    discountPercent: 50.0,
    currency: 'INR',
    primaryImage: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1547996160-71dfa630ae01?auto=format&fit=crop&w=800&q=80'
    ],
    hasVideo: true,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    stockQuantity: 18,
    stockStatus: 'IN_STOCK',
    rating: 4.9,
    ratingCount: 142,
    warranty: '2 Years Manufacturer Warranty',
    shippingClass: 'Express Insured Air',
    tags: ['chronograph', 'watch', 'imported', 'sapphire', 'stainless steel'],
    specifications: {
      'Movement': 'Imported Precision Quartz Chrono',
      'Case Material': '316L Stainless Steel',
      'Case Diameter': '42mm',
      'Crystal': 'Anti-Reflective Sapphire Crystal',
      'Water Resistance': '10 ATM (100m / 330ft)',
      'Band Width': '22mm Quick-Release Link'
    },
    isFeatured: true,
    isTrending: true
  },
  {
    id: 'prod_2',
    sku: 'GV-WTC-AMOLED-02',
    title: 'Titanium Ultra AMOLED Smartwatch 5.3 BT Calling',
    shortDescription: '1.43" AMOLED 466x466 display, aerospace titanium bezel, continuous health monitoring.',
    fullDescription: 'The Titanium Ultra delivers aerospace durability with consumer smart connectivity. Featuring an ultra-vivid 1.43-inch Always-On AMOLED screen with 1,000 nits peak brightness. Embedded dual-mic ENC hardware allows crystal-clear hands-free Bluetooth calling directly from the wrist. Comprehensive multi-sensor suite tracks heart rate, SpO2, HRV, and sleep stages.',
    category: 'Imported Watches',
    categorySlug: 'watches',
    brand: 'Titanium Core',
    model: 'Ultra AMOLED 2',
    originalPrice: 5999,
    sellingPrice: 2899,
    discountPercent: 51.7,
    currency: 'INR',
    primaryImage: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=800&q=80'
    ],
    hasVideo: true,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    stockQuantity: 24,
    stockStatus: 'IN_STOCK',
    rating: 4.8,
    ratingCount: 98,
    warranty: '1 Year Doorstep Replacement',
    shippingClass: 'Express Standard',
    tags: ['smartwatch', 'amoled', 'calling', 'titanium', 'fitness'],
    specifications: {
      'Display': '1.43" Always-On AMOLED (466x466 px)',
      'Connectivity': 'Bluetooth 5.3 + BLE',
      'Battery Life': 'Up to 10 Days Typical / 25 Days Standby',
      'Water Rating': 'IP68 Water & Dust Resistant',
      'Sensors': 'Optical HR, PPG SpO2, Accelerometer, Gyroscope'
    },
    isFeatured: true,
    isTrending: true
  },
  {
    id: 'prod_3',
    sku: 'GV-GDG-ANC-01',
    title: 'AeroSound Pro Hybrid ANC Wireless Headphones',
    shortDescription: '-42dB active noise cancellation with 40mm titanium drivers and 65-hour battery.',
    fullDescription: 'Immerse in studio acoustics anywhere with AeroSound Pro. Four dedicated feedforward and feedback microphones eliminate ambient noise up to 42dB. Custom-tuned 40mm titanium diaphragm drivers reproduce deep sub-bass and articulate highs. Supports Hi-Res Audio wireless transmission with LDAC codec support.',
    category: 'Electronic Gadgets',
    categorySlug: 'gadgets',
    brand: 'AeroSound',
    model: 'Pro ANC Wireless',
    originalPrice: 6999,
    sellingPrice: 3499,
    discountPercent: 50.0,
    currency: 'INR',
    primaryImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80'
    ],
    hasVideo: false,
    stockQuantity: 4,
    stockStatus: 'LOW_STOCK',
    rating: 4.7,
    ratingCount: 310,
    warranty: '1 Year Warranty',
    shippingClass: 'Express Standard',
    tags: ['headphones', 'anc', 'audio', 'bluetooth', 'hi-res'],
    specifications: {
      'Noise Cancellation': 'Hybrid Active Noise Cancellation (-42dB)',
      'Driver Size': '40mm Titanium Dynamic Drivers',
      'Battery': '65 Hours (ANC Off) / 45 Hours (ANC On)',
      'Charging': 'USB-C Fast Charge (10 mins = 5 hrs playback)',
      'Weight': '248g Ergonomic Foldable Frame'
    },
    isFeatured: true,
    isTrending: true
  },
  {
    id: 'prod_4',
    sku: 'GV-GDG-CHG-02',
    title: 'VoltStream 100W 4-Port GaN Fast Charger Dock',
    shortDescription: 'Gallium Nitride high-efficiency charging hub powering laptops, tablets, and phones simultaneously.',
    fullDescription: 'Consolidate bulky power bricks with VoltStream 100W GaN III technology. Features 3x USB-C Power Delivery 3.0 ports and 1x USB-A QuickCharge 4+ port with intelligent dynamic power allocation. Operates 30% cooler than silicon chargers while delivering full speed 100W charging for MacBook Pro, Dell XPS, iPhone 16, Samsung Galaxy, and iPads.',
    category: 'Electronic Gadgets',
    categorySlug: 'gadgets',
    brand: 'VoltStream',
    model: 'GaN III 100W',
    originalPrice: 3499,
    sellingPrice: 1999,
    discountPercent: 42.9,
    currency: 'INR',
    primaryImage: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80'
    ],
    hasVideo: false,
    stockQuantity: 32,
    stockStatus: 'IN_STOCK',
    rating: 4.9,
    ratingCount: 76,
    warranty: '18 Months Warranty',
    shippingClass: 'Express Standard',
    tags: ['gan', 'charger', 'type-c', 'fast-charging', 'power'],
    specifications: {
      'Total Output': '100W Max',
      'Ports': '3x USB-C (PD 3.0 / PPS), 1x USB-A (QC 4.0)',
      'Technology': 'GaN III (Gallium Nitride Semiconductor)',
      'Safety': 'MultiProtect Over-current, Over-voltage, Thermal Guard'
    },
    isFeatured: false,
    isTrending: false
  },
  {
    id: 'prod_5',
    sku: 'GV-WTC-AUTO-03',
    title: 'Heritage Royal Skeleton Automatic Watch',
    shortDescription: 'Self-winding mechanical movement with exhibition transparent sapphire caseback.',
    fullDescription: 'Celebrate mechanical horology with the Heritage Royal Skeleton. Requires no battery—powered automatically by the kinetic movement of your wrist. The open-heart dial reveals intricate oscillating gears and blued screws, shielded by scratch-resistant domed crystal with a genuine Italian leather strap.',
    category: 'Imported Watches',
    categorySlug: 'watches',
    brand: 'Aura Genève',
    model: 'Heritage Skeleton 41',
    originalPrice: 12999,
    sellingPrice: 6499,
    discountPercent: 50.0,
    currency: 'INR',
    primaryImage: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=800&q=80'
    ],
    hasVideo: true,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    stockQuantity: 9,
    stockStatus: 'IN_STOCK',
    rating: 4.95,
    ratingCount: 54,
    warranty: '2 Years Mechanical Warranty',
    shippingClass: 'Express Insured Air',
    tags: ['automatic', 'skeleton', 'mechanical', 'luxury', 'leather'],
    specifications: {
      'Movement': '21-Jewel Automatic Mechanical (42h Power Reserve)',
      'Case Diameter': '41mm',
      'Case Thickness': '12.5mm',
      'Strap': 'Genuine Full-Grain Italian Leather (20mm)'
    },
    isFeatured: false,
    isTrending: true
  }
];

export const INITIAL_ADDRESSES: Address[] = [
  {
    id: 'addr_1',
    fullName: 'Aarav Sharma',
    phone: '+91 98765 43210',
    addressLine1: 'Flat 402, Cyber Heights, Sector 62',
    addressLine2: 'Near Infotech Tower',
    city: 'Noida',
    state: 'Uttar Pradesh',
    postalCode: '201301',
    country: 'IN',
    isDefault: true
  },
  {
    id: 'addr_2',
    fullName: 'Aarav Sharma (Office)',
    phone: '+91 98765 43210',
    addressLine1: 'Tech Park One, Tower B, 5th Floor',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'IN',
    isDefault: false
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord_1',
    orderNumber: 'GV-2026-000102',
    createdAt: '2026-09-18T14:30:00.000Z',
    items: [
      {
        product: INITIAL_PRODUCTS[0],
        quantity: 1
      }
    ],
    subtotal: 4499,
    discount: 500,
    couponCode: 'GIZMO500',
    shippingFee: 0,
    grandTotal: 3999,
    orderStatus: 'SHIPPED',
    paymentStatus: 'PAID',
    paymentMethod: 'UPI (Google Pay)',
    shippingAddress: INITIAL_ADDRESSES[0],
    trackingNumber: 'DELHIVERY-GV-9842109',
    estimatedDelivery: '2026-09-22'
  }
];

export const INITIAL_INGESTED_ITEMS: WhatsAppIngestedItem[] = [
  {
    id: 'ing_1',
    sourcePhoneNumber: '+91 98110 54321',
    metaMessageId: 'wamid.HBgLMOTE5ODExMDU0MzIxFQIAERgSRjQ1OTA0ODUzMkEzQjcxM0QxAA==',
    receivedAt: '2026-09-19T10:15:00.000Z',
    rawText: "Original imported smartwatch\nAMOLED display 1.43\nBluetooth calling\nHeart-rate monitoring\n7-day battery\nPrice ₹2,999\nDiscount ₹2,499",
    extractedTitle: 'Imported Smartwatch AMOLED Bluetooth Calling',
    extractedCategory: 'Imported Watches',
    extractedBrand: 'Imported',
    originalPrice: 2999,
    sellingPrice: 2499,
    discount: 500,
    confidenceScore: 0.94,
    mediaUrls: [
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=600&q=80'
    ],
    status: 'NEEDS_REVIEW',
    specs: {
      'Display': '1.43 AMOLED',
      'Calling': 'Bluetooth Voice Calling',
      'Battery': '7 Days',
      'Heart Rate': 'Continuous Monitoring'
    }
  },
  {
    id: 'ing_2',
    sourcePhoneNumber: '+91 98110 54321',
    metaMessageId: 'wamid.HBgLMOTE5ODExMDU0MzIxFQIAERgSRjU1OTA0ODUzMkEzQjcxM0QyAA==',
    receivedAt: '2026-09-19T09:40:00.000Z',
    rawText: "New Chronograph Stainless Steel Watch\nQuartz movement\nWater resistant\nPrice ₹3,499\nDiscount ₹2,799",
    extractedTitle: 'Imported Tachymeter Quartz Chronograph Watch',
    extractedCategory: 'Imported Watches',
    extractedBrand: 'Aura',
    originalPrice: 3499,
    sellingPrice: 2799,
    discount: 700,
    confidenceScore: 0.96,
    mediaUrls: [
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80'
    ],
    status: 'APPROVED',
    specs: {
      'Movement': 'Quartz Chronograph',
      'Material': 'Solid Stainless Steel',
      'Water Resistance': '100m'
    }
  }
];
