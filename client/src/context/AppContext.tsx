import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  ViewType, 
  Product, 
  CartItem, 
  Address, 
  Order, 
  WhatsAppIngestedItem,
  FilterOptions 
} from '../types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_ADDRESSES, 
  INITIAL_ORDERS, 
  INITIAL_INGESTED_ITEMS 
} from '../data/mockData';
import { useToast } from '../components/ui/Toast';
import { fetchPublishedCatalog } from '../services/api';
import { 
  fetchSupabaseProducts, 
  mapSupabaseRowToProduct, 
  subscribeToProductsRealtime 
} from '../services/supabase';

interface AppContextType {
  currentView: ViewType;
  navigateTo: (view: ViewType) => void;
  products: Product[];
  catalog: Product[];
  setCatalog: React.Dispatch<React.SetStateAction<Product[]>>;
  catalogLoading: boolean;
  catalogError: string | null;
  refreshCatalog: () => Promise<void>;
  selectedProduct: Product | null;
  openProductDetails: (product: Product) => void;
  recentlyViewed: Product[];
  selectedOrder: Order | null;
  openOrderDetails: (order: Order) => void;
  openOrderTracking: (order: Order) => void;
  cart: CartItem[];
  savedForLater: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  saveForLater: (productId: string) => void;
  moveToCart: (productId: string) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartDiscount: number;
  cartShippingFee: number;
  cartTotal: number;
  appliedCoupon: string | null;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  revalidateCart: (shippingPincode?: string) => Promise<{ canProceed: boolean; errors: string[] }>;
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  addresses: Address[];
  addAddress: (address: Omit<Address, 'id'>) => void;
  setDefaultAddress: (id: string) => void;
  orders: Order[];
  placeOrder: (paymentMethod: string, addressId: string) => Order;
  cancelOrder: (orderId: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  ingestedItems: WhatsAppIngestedItem[];
  approveIngestedProduct: (id: string) => void;
  rejectIngestedProduct: (id: string) => void;
  deleteAccount: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(INITIAL_PRODUCTS[0]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(INITIAL_ORDERS[0]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>(INITIAL_ADDRESSES);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<FilterOptions>({ sortBy: 'relevance' });
  const [ingestedItems, setIngestedItems] = useState<WhatsAppIngestedItem[]>(INITIAL_INGESTED_ITEMS);
  const { showToast } = useToast();

  const refreshCatalog = async () => {
    setCatalogLoading(true);
    try {
      // 1. Fetch published products from API/local cache
      const items = await fetchPublishedCatalog();

      // 2. Fetch live products directly from Supabase 'products' table
      const supabaseRows = await fetchSupabaseProducts();
      const supabaseProducts = supabaseRows.map(mapSupabaseRowToProduct);

      // 3. Merge products (Supabase live products take precedence, deduped by ID)
      const mergedMap = new Map<string, Product>();
      supabaseProducts.forEach((p) => mergedMap.set(p.id, p as Product));
      items.forEach((p) => {
        if (!mergedMap.has(p.id)) mergedMap.set(p.id, p);
      });

      const combined = Array.from(mergedMap.values());
      const finalItems = combined.length > 0 ? combined : items;

      setCatalog(finalItems);
      if (finalItems.length > 0) {
        setProducts(finalItems);
        if (!selectedProduct) {
          setSelectedProduct(finalItems[0]);
        }
      }
      setCatalogError(null);
    } catch (err: any) {
      setCatalogError(err?.message || 'Failed to fetch catalog');
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    refreshCatalog();

    // Realtime Sync: Subscribes to Supabase 'products-feed' channel
    const unsubscribe = subscribeToProductsRealtime(() => {
      refreshCatalog();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const navigateTo = (view: ViewType) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentView(view);
  };

  const openProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setRecentlyViewedIds((prev) => [product.id, ...prev.filter((id) => id !== product.id)].slice(0, 10));
    navigateTo('product-details');
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    navigateTo('order-details');
  };

  const openOrderTracking = (order: Order) => {
    setSelectedOrder(order);
    navigateTo('order-tracking');
  };

  const addToCart = (product: Product, quantity = 1) => {
    if (product.stockQuantity <= 0 || product.stockStatus === 'OUT_OF_STOCK') {
      showToast(`"${product.title}" is out of stock`, 'error');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(product.stockQuantity, existing.quantity + quantity);
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prev, { product, quantity: Math.min(product.stockQuantity, quantity) }];
    });
    showToast(`Added ${product.title.substring(0, 24)}... to cart`, 'success');
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const clamped = Math.min(item.product.stockQuantity, quantity);
          if (quantity > item.product.stockQuantity) {
            showToast(`Only ${item.product.stockQuantity} units available`, 'warning');
          }
          return { ...item, quantity: clamped };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    showToast('Item removed from cart', 'info');
  };

  const saveForLater = (productId: string) => {
    const item = cart.find((i) => i.product.id === productId);
    if (item) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      setSavedForLater((prev) => [...prev.filter((i) => i.product.id !== productId), item]);
      showToast(`Saved "${item.product.title.substring(0, 20)}..." for later`, 'info');
    }
  };

  const moveToCart = (productId: string) => {
    const item = savedForLater.find((i) => i.product.id === productId);
    if (item) {
      if (item.product.stockQuantity <= 0 || item.product.stockStatus === 'OUT_OF_STOCK') {
        showToast(`"${item.product.title}" is out of stock and cannot be moved to cart`, 'error');
        return;
      }
      setSavedForLater((prev) => prev.filter((i) => i.product.id !== productId));
      setCart((prev) => [...prev.filter((i) => i.product.id !== productId), item]);
      showToast(`Moved "${item.product.title.substring(0, 20)}..." to active cart`, 'success');
    }
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.product.sellingPrice * item.quantity,
    0
  );

  const cartDiscount = (() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon === 'GIZMO10' && cartSubtotal >= 2000) {
      return Math.min(1000, Math.round(cartSubtotal * 0.10));
    }
    if (appliedCoupon === 'GIZMO500' && cartSubtotal >= 3000) {
      return 500;
    }
    if (appliedCoupon === 'WATCH50' && cartSubtotal >= 20000) {
      return Math.min(5000, Math.round(cartSubtotal * 0.20));
    }
    if (appliedCoupon === 'WELCOME100' && cartSubtotal >= 500) {
      return Math.min(100, cartSubtotal);
    }
    return 0;
  })();

  const cartShippingFee = cart.length > 0 && cartSubtotal >= 999 ? 0 : cart.length > 0 ? 99 : 0;
  const cartTotal = Math.max(0, cartSubtotal - cartDiscount + cartShippingFee);

  const applyCoupon = (code: string): boolean => {
    const clean = code.trim().toUpperCase();
    if (clean === 'GIZMO10') {
      if (cartSubtotal < 2000) {
        showToast('GIZMO10 requires minimum order of ₹2,000', 'error');
        return false;
      }
      setAppliedCoupon('GIZMO10');
      showToast('Coupon GIZMO10 applied: 10% discount!', 'success');
      return true;
    } else if (clean === 'GIZMO500') {
      if (cartSubtotal < 3000) {
        showToast('GIZMO500 requires minimum order of ₹3,000', 'error');
        return false;
      }
      setAppliedCoupon('GIZMO500');
      showToast('Coupon GIZMO500 applied: ₹500 off!', 'success');
      return true;
    } else if (clean === 'WATCH50') {
      if (cartSubtotal < 20000) {
        showToast('WATCH50 requires minimum order of ₹20,000', 'error');
        return false;
      }
      setAppliedCoupon('WATCH50');
      showToast('Coupon WATCH50 applied: 20% discount!', 'success');
      return true;
    } else if (clean === 'WELCOME100') {
      if (cartSubtotal < 500) {
        showToast('WELCOME100 requires minimum order of ₹500', 'error');
        return false;
      }
      setAppliedCoupon('WELCOME100');
      showToast('Coupon WELCOME100 applied: ₹100 off!', 'success');
      return true;
    }
    showToast('Invalid coupon code.', 'error');
    return false;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    showToast('Coupon removed', 'info');
  };

  const revalidateCart = async (shippingPincode?: string): Promise<{ canProceed: boolean; errors: string[] }> => {
    const errors: string[] = [];
    if (cart.length === 0) {
      errors.push('Cart is empty.');
      return { canProceed: false, errors };
    }

    for (const item of cart) {
      const liveProduct = products.find((p) => p.id === item.product.id);
      if (!liveProduct) {
        errors.push(`"${item.product.title}" is no longer available.`);
      } else if (liveProduct.stockQuantity <= 0 || liveProduct.stockStatus === 'OUT_OF_STOCK') {
        errors.push(`"${liveProduct.title}" is currently out of stock.`);
      } else if (item.quantity > liveProduct.stockQuantity) {
        errors.push(`Only ${liveProduct.stockQuantity} units available for "${liveProduct.title}".`);
      }
    }

    if (shippingPincode && !/^\d{6}$/.test(shippingPincode.trim())) {
      errors.push('Invalid delivery PIN code. Please enter a 6-digit PIN code.');
    }

    return {
      canProceed: errors.length === 0,
      errors
    };
  };

  const toggleWishlist = (productId: string) => {
    if (wishlist.includes(productId)) {
      setWishlist((prev) => prev.filter((id) => id !== productId));
      showToast('Removed from wishlist', 'info');
    } else {
      setWishlist((prev) => [...prev, productId]);
      showToast('Added to wishlist', 'success');
    }
  };

  const addAddress = (addressData: Omit<Address, 'id'>) => {
    const newAddr: Address = {
      ...addressData,
      id: `addr_${Date.now()}`
    };
    setAddresses((prev) => [newAddr, ...prev]);
    showToast('Address saved to address book', 'success');
  };

  const setDefaultAddress = (id: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, isDefault: a.id === id }))
    );
    showToast('Default delivery address updated', 'info');
  };

  const placeOrder = (paymentMethod: string, addressId: string): Order => {
    const deliveryAddress = addresses.find((a) => a.id === addressId) || addresses[0];
    const orderNum = `GV-2026-${String(Math.floor(100000 + Math.random() * 900000))}`;
    
    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      orderNumber: orderNum,
      createdAt: new Date().toISOString(),
      items: [...cart],
      subtotal: cartSubtotal,
      discount: cartDiscount,
      couponCode: appliedCoupon || undefined,
      shippingFee: 0,
      grandTotal: cartTotal,
      orderStatus: 'PROCESSING',
      paymentStatus: 'PAID',
      paymentMethod,
      shippingAddress: deliveryAddress,
      trackingNumber: `DELHIVERY-${orderNum}`,
      estimatedDelivery: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]
    };

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();
    setSelectedOrder(newOrder);
    navigateTo('order-details');
    showToast(`Order ${orderNum} confirmed!`, 'success');
    return newOrder;
  };

  const cancelOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, orderStatus: 'CANCELLED' } : o
      )
    );
    showToast('Order cancelled. Refund initiated to source.', 'info');
  };

  const approveIngestedProduct = (id: string) => {
    setIngestedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newProd: Product = {
            id: `prod_${Date.now()}`,
            sku: `GV-WA-${Math.floor(1000 + Math.random() * 9000)}`,
            title: item.extractedTitle,
            fullDescription: item.rawText,
            category: item.extractedCategory,
            categorySlug: item.extractedCategory.toLowerCase().includes('watch') ? 'watches' : 'gadgets',
            brand: item.extractedBrand,
            originalPrice: item.originalPrice,
            sellingPrice: item.sellingPrice,
            discountPercent: Math.round(((item.originalPrice - item.sellingPrice) / item.originalPrice) * 100),
            currency: 'INR',
            primaryImage: item.mediaUrls[0] || 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80',
            images: item.mediaUrls,
            hasVideo: false,
            stockQuantity: 15,
            stockStatus: 'IN_STOCK',
            rating: 4.8,
            ratingCount: 1,
            warranty: '1 Year Warranty',
            shippingClass: 'Express Standard',
            tags: ['whatsapp-import', item.extractedCategory.toLowerCase()],
            specifications: item.specs,
            isFeatured: false,
            isTrending: true
          };
          setProducts((current) => [newProd, ...current]);
          return { ...item, status: 'PUBLISHED' };
        }
        return item;
      })
    );
    showToast('Product approved and published to live catalog!', 'success');
  };

  const rejectIngestedProduct = (id: string) => {
    setIngestedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'REJECTED' } : item))
    );
    showToast('Product rejected and archived', 'info');
  };

  const deleteAccount = () => {
    setCart([]);
    setWishlist([]);
    setOrders([]);
    navigateTo('home');
    showToast('Account data permanently deleted per Google Play Store policy.', 'info');
  };

  const recentlyViewed = recentlyViewedIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

  return (
    <AppContext.Provider
      value={{
        currentView,
        navigateTo,
        products,
        catalog,
        setCatalog,
        catalogLoading,
        catalogError,
        refreshCatalog,
        selectedProduct,
        openProductDetails,
        recentlyViewed,
        selectedOrder,
        openOrderDetails,
        openOrderTracking,
        cart,
        savedForLater,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        saveForLater,
        moveToCart,
        clearCart,
        cartSubtotal,
        cartDiscount,
        cartShippingFee,
        cartTotal,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        revalidateCart,
        wishlist,
        toggleWishlist,
        addresses,
        addAddress,
        setDefaultAddress,
        orders,
        placeOrder,
        cancelOrder,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        ingestedItems,
        approveIngestedProduct,
        rejectIngestedProduct,
        deleteAccount
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
