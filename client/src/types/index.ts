export type ViewType = 
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'categories'
  | 'search'
  | 'product-details'
  | 'cart'
  | 'checkout'
  | 'orders'
  | 'order-details'
  | 'order-tracking'
  | 'wishlist'
  | 'profile'
  | 'addresses'
  | 'notifications'
  | 'help'
  | 'privacy'
  | 'terms'
  | 'refund-policy'
  | 'admin-dashboard'
  | 'admin-approval'
  | 'admin-whatsapp'
  | 'admin-inventory'
  | 'admin-orders'
  | 'admin-analytics'
  | 'admin-health'
  | 'admin-settings';

export interface Product {
  id: string;
  sku: string;
  title: string;
  shortDescription?: string;
  fullDescription: string;
  category: string;
  categorySlug: string;
  brand: string;
  model?: string;
  originalPrice: number;
  sellingPrice: number;
  discountPercent: number;
  currency: string;
  primaryImage: string;
  images: string[];
  hasVideo: boolean;
  videoUrl?: string;
  stockQuantity: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  rating: number;
  ratingCount: number;
  warranty: string;
  shippingClass: string;
  tags: string[];
  specifications: Record<string, string>;
  isFeatured?: boolean;
  isTrending?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. GV-2026-000102
  createdAt: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  shippingFee: number;
  grandTotal: number;
  orderStatus: 'PAYMENT_PENDING' | 'PAID' | 'PROCESSING' | 'PACKED' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED';
  paymentMethod: string;
  shippingAddress: Address;
  trackingNumber: string;
  estimatedDelivery: string;
}

export interface WhatsAppIngestedItem {
  id: string;
  sourcePhoneNumber: string;
  metaMessageId: string;
  receivedAt: string;
  rawText: string;
  extractedTitle: string;
  extractedCategory: string;
  extractedBrand: string;
  originalPrice: number;
  sellingPrice: number;
  discount: number;
  confidenceScore: number;
  mediaUrls: string[];
  status: 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  specs: Record<string, string>;
  isDuplicate?: boolean;
  duplicateOfId?: string;
}

export interface FilterOptions {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  hasVideoOnly?: boolean;
  inStockOnly?: boolean;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'popular' | 'newest';
}
