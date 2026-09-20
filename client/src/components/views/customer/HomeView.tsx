import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Watch, 
  Headphones, 
  Zap, 
  ShoppingBag, 
  ArrowRight, 
  Flame, 
  Clock, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  Lock, 
  Copy, 
  Check, 
  Smartphone, 
  Activity, 
  Gamepad2, 
  Camera, 
  Search, 
  Eye, 
  MessageCircle, 
  Layers,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ProductCard } from '../../ui/ProductCard';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../ui/Toast';

export const ProductCardSkeleton: React.FC = () => (
  <div
    className="product-card"
    style={{
      pointerEvents: 'none',
      opacity: 0.85,
      animation: 'pulse 1.8s infinite ease-in-out'
    }}
  >
    <div
      style={{
        width: '100%',
        aspectRatio: '1',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 'var(--radius-md)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          width: 50,
          height: 18,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 4
        }}
      />
    </div>
    <div className="product-card-content" style={{ gap: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: '35%', height: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 4 }} />
        <div style={{ width: '20%', height: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 4 }} />
      </div>
      <div style={{ width: '90%', height: 16, backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: 4 }} />
      <div style={{ width: '60%', height: 14, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 4 }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginTop: 'auto', paddingTop: 6 }}>
        <div style={{ width: '45%', height: 20, backgroundColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 4 }} />
        <div style={{ width: '30%', height: 14, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 4 }} />
      </div>
      <div style={{ width: '100%', height: 34, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-md)', marginTop: 8 }} />
    </div>
  </div>
);

export const HomeView: React.FC = () => {
  const { 
    products, 
    catalog,
    catalogLoading,
    addToCart, 
    toggleWishlist, 
    wishlist, 
    openProductDetails, 
    navigateTo, 
    setFilters,
    recentlyViewed
  } = useApp();

  const { showToast } = useToast();

  // Flash deal countdown timer state (hours:mins:secs)
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 18, seconds: 32 });
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [homeSearch, setHomeSearch] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 24, minutes: 0, seconds: 0 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    showToast(`Coupon code ${code} copied to clipboard!`, 'success');
    setTimeout(() => setCopiedCoupon(null), 2500);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (homeSearch.trim()) {
      navigateTo('search');
    }
  };

  // Active catalog from WhatsApp ingestion (with products fallback)
  const displayCatalog = catalog && catalog.length > 0 ? catalog : products;

  // Filter catalog to find newly ingested, high-margin items (Imported Watches with high MRP vs selling price delta)
  const highMarginDeals = displayCatalog
    .filter(p => {
      const marginDelta = p.originalPrice - p.sellingPrice;
      const isWatch = p.category.toLowerCase().includes('watch');
      return p.isFeatured || (isWatch && marginDelta >= 5000) || marginDelta >= 8000;
    })
    .sort((a, b) => (b.originalPrice - b.sellingPrice) - (a.originalPrice - a.sellingPrice));

  const heroDeals = highMarginDeals.length > 0 ? highMarginDeals.slice(0, 5) : displayCatalog.slice(0, 4);

  const [activeSlide, setActiveSlide] = useState(0);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);

  useEffect(() => {
    if (heroDeals.length <= 1 || isCarouselHovered) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % heroDeals.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [heroDeals.length, isCarouselHovered]);

  // Filtered segments
  const watches = displayCatalog.filter(p => p.category.toLowerCase().includes('watch'));
  const gadgets = displayCatalog.filter(p => !p.category.toLowerCase().includes('watch'));
  const trending = displayCatalog.filter(p => p.isTrending);
  const featured = displayCatalog.filter(p => p.isFeatured);
  const newArrivals = displayCatalog.slice(-6).reverse();

  // 6 Master Taxonomy Categories
  const categoriesList = [
    { id: 'cat_phones', name: 'Smartphones & Foldables', icon: <Smartphone size={20} />, slug: 'smartphones-foldables', color: 'var(--accent-cyan)' },
    { id: 'cat_watches', name: 'Imported Luxury Watches', icon: <Watch size={20} />, slug: 'imported-luxury-watches', color: 'var(--accent-gold)' },
    { id: 'cat_audio', name: 'Audio & Sound', icon: <Headphones size={20} />, slug: 'audio-sound', color: '#38bdf8' },
    { id: 'cat_wearables', name: 'Smart Wearables', icon: <Activity size={20} />, slug: 'smart-wearables', color: '#a855f7' },
    { id: 'cat_gaming', name: 'Gaming Gear', icon: <Gamepad2 size={20} />, slug: 'gaming-gear', color: '#ef4444' },
    { id: 'cat_drones', name: 'Photography & Drones', icon: <Camera size={20} />, slug: 'photography-drones', color: '#10b981' }
  ];

  // 4 Curated Collections
  const collections = [
    {
      title: 'Swiss Masterpieces',
      tagline: 'Mechanical & Automatic Tourbillons',
      category: 'Imported Watches',
      image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80',
      badge: 'Luxury Import'
    },
    {
      title: 'Next-Gen Audio',
      tagline: 'Spatial Audio & Dual-Driver Monitors',
      category: 'Electronic Gadgets',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
      badge: 'Hi-Res Certified'
    },
    {
      title: 'Titanium Foldables',
      tagline: 'Zero-Crease 120Hz LTPO AMOLED',
      category: 'Electronic Gadgets',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
      badge: 'Flagship Edition'
    },
    {
      title: 'Creator & Flight Studio',
      tagline: '4K GPS Aerial Drones & Gimbals',
      category: 'Electronic Gadgets',
      image: 'https://images.unsplash.com/photo-1507582020434-9e063fea0c56?auto=format&fit=crop&w=600&q=80',
      badge: 'Aerial Precision'
    }
  ];

  return (
    <div style={{ paddingBottom: 64 }}>
      {/* 1. QUICK SEARCH & DISCOVERY BAR */}
      <div style={{ marginBottom: 24 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, position: 'relative' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input"
              placeholder="Search gadgets, Swiss watches, foldables, drones..."
              value={homeSearch}
              onChange={(e) => setHomeSearch(e.target.value)}
              style={{ paddingLeft: 42, height: 46, borderRadius: 'var(--radius-full)' }}
            />
          </div>
          <Button variant="primary" type="submit" style={{ borderRadius: 'var(--radius-full)', padding: '0 20px' }}>
            Search
          </Button>
        </form>

        {/* Quick Filter Chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 10, paddingBottom: 4 }}>
          <button 
            className="badge badge-cyan" 
            style={{ cursor: 'pointer', border: '1px solid rgba(0, 229, 255, 0.3)', background: 'transparent' }}
            onClick={() => { setFilters({ category: 'Imported Watches' }); navigateTo('search'); }}
          >
            Imported Watches
          </button>
          <button 
            className="badge badge-gold" 
            style={{ cursor: 'pointer', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'transparent' }}
            onClick={() => { setFilters({ hasVideoOnly: true }); navigateTo('search'); }}
          >
            <Sparkles size={11} style={{ marginRight: 4 }} /> Video Demos
          </button>
          <button 
            className="badge" 
            style={{ cursor: 'pointer', border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-secondary)' }}
            onClick={() => { setFilters({ inStockOnly: true }); navigateTo('search'); }}
          >
            In Stock Only
          </button>
          <button 
            className="badge" 
            style={{ cursor: 'pointer', border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-secondary)' }}
            onClick={() => { setFilters({ sortBy: 'popular' }); navigateTo('search'); }}
          >
            <Flame size={11} style={{ marginRight: 4, color: 'var(--color-danger)' }} /> Most Popular
          </button>
        </div>
      </div>

      {/* 2. PROMINENT AUTO-SCROLLING HERO AD CAROUSEL (WhatsApp Ingested High-Margin Deals) */}
      {heroDeals.length > 0 ? (
        <div 
          onMouseEnter={() => setIsCarouselHovered(true)}
          onMouseLeave={() => setIsCarouselHovered(false)}
          style={{
            position: 'relative',
            marginBottom: 28,
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            border: '1px solid var(--border-medium)',
            background: 'radial-gradient(ellipse at top right, rgba(0, 229, 255, 0.16), transparent 70%), radial-gradient(ellipse at bottom left, rgba(245, 158, 11, 0.18), transparent 70%), var(--bg-surface)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {(() => {
            const currentItem = heroDeals[activeSlide % heroDeals.length] || heroDeals[0];
            const marginDelta = currentItem.originalPrice - currentItem.sellingPrice;
            const isWatch = currentItem.category.toLowerCase().includes('watch');

            return (
              <div style={{
                padding: '36px 28px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 28,
                alignItems: 'center',
                position: 'relative',
                zIndex: 1
              }}>
                {/* Left Side: Product Information */}
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span className="badge badge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Sparkles size={12} /> High-Margin Spotlight
                    </span>
                    <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <MessageCircle size={12} /> WhatsApp Ingestion
                    </span>
                    {marginDelta > 0 && (
                      <span className="badge badge-discount">
                        Save ₹{marginDelta.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: isWatch ? 'var(--accent-gold)' : 'var(--accent-cyan)', marginBottom: 6 }}>
                    {currentItem.brand} • {currentItem.category}
                  </div>

                  <h1 style={{
                    fontSize: '2.125rem',
                    fontWeight: 900,
                    lineHeight: 1.2,
                    marginBottom: 12,
                    letterSpacing: '-0.02em',
                    color: 'var(--text-primary)'
                  }}>
                    {currentItem.title}
                  </h1>

                  <p style={{
                    fontSize: '0.9375rem',
                    color: 'var(--text-secondary)',
                    marginBottom: 20,
                    lineHeight: 1.5,
                    maxHeight: '3em',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {currentItem.shortDescription || currentItem.fullDescription || 'Imported broadcast item with verified authenticity.'}
                  </p>

                  {/* Pricing Display */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                      ₹{currentItem.sellingPrice.toLocaleString('en-IN')}
                    </span>
                    {currentItem.originalPrice > currentItem.sellingPrice && (
                      <span style={{ fontSize: '1.125rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        ₹{currentItem.originalPrice.toLocaleString('en-IN')}
                      </span>
                    )}
                    {currentItem.discountPercent > 0 && (
                      <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '0.9375rem' }}>
                        ({Math.round(currentItem.discountPercent)}% OFF)
                      </span>
                    )}
                  </div>

                  {/* Quick CTAs */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                    <Button 
                      variant={isWatch ? "gold" : "primary"}
                      size="lg"
                      icon={<ShoppingBag size={18} />}
                      onClick={() => addToCart(currentItem)}
                    >
                      Instant Add to Cart
                    </Button>
                    <Button 
                      variant="secondary"
                      size="lg"
                      onClick={() => openProductDetails(currentItem)}
                    >
                      Inspect Details <ArrowRight size={16} />
                    </Button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-muted)', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                    <span>✓ 20+ Curated Imports</span>
                    <span>•</span>
                    <span>✓ 48-Hour Dispatch</span>
                    <span>•</span>
                    <span>✓ 100% Authentic</span>
                  </div>
                </div>

                {/* Right Side: Media Thumbnail from WhatsApp */}
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <div 
                    onClick={() => openProductDetails(currentItem)}
                    style={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: 340,
                      aspectRatio: '1',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      border: '2px solid rgba(255, 255, 255, 0.12)',
                      boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      background: 'var(--bg-card)'
                    }}
                  >
                    <img 
                      src={currentItem.primaryImage}
                      alt={currentItem.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.4s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 12,
                      right: 12,
                      background: 'rgba(10, 14, 23, 0.85)',
                      backdropFilter: 'blur(8px)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Sparkles size={12} color="var(--accent-gold)" /> WhatsApp Media
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Carousel Bottom Indicator & Controls Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderTop: '1px solid var(--border-light)',
            background: 'rgba(10, 14, 23, 0.65)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {heroDeals.map((item, idx) => (
                <button
                  key={`slide-${item.id}-${idx}`}
                  onClick={() => setActiveSlide(idx)}
                  style={{
                    width: idx === activeSlide ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: idx === activeSlide ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    padding: 0
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                {activeSlide + 1} of {heroDeals.length} • Auto-scrolling Featured Deal
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setActiveSlide((prev) => (prev - 1 + heroDeals.length) % heroDeals.length)}
                style={{ width: 32, height: 32 }}
                aria-label="Previous slide"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setActiveSlide((prev) => (prev + 1) % heroDeals.length)}
                style={{ width: 32, height: 32 }}
                aria-label="Next slide"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Fallback Hero Banner when loading */
        <div style={{
          background: 'radial-gradient(ellipse at top right, rgba(0, 229, 255, 0.18), transparent 65%), radial-gradient(ellipse at bottom left, rgba(245, 158, 11, 0.16), transparent 65%), var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-xl)',
          padding: '40px 28px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{ maxWidth: 660, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-cyan)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                Google Play Verified
              </span>
              <span className="badge badge-gold">WhatsApp Cloud Ingestion</span>
            </div>

            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.15, marginBottom: 14, letterSpacing: '-0.02em' }}>
              Discover. Compare. <span style={{ color: 'var(--accent-gold)' }}>Shop.</span>
            </h1>

            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 26, lineHeight: 1.6 }}>
              The authorized social commerce platform for premium electronics and authentic imported watches. Every WhatsApp broadcast verified, inspected, and delivered with 100% buyer protection.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
              <Button 
                variant="gold" 
                size="lg" 
                icon={<Watch size={18} />} 
                onClick={() => { setFilters({ category: 'Imported Watches' }); navigateTo('search'); }}
              >
                Explore Watches
              </Button>
              <Button 
                variant="primary" 
                size="lg" 
                icon={<ShoppingBag size={18} />} 
                onClick={() => { setFilters({ category: 'Electronic Gadgets' }); navigateTo('search'); }}
              >
                Shop Gadgets
              </Button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              <span>✓ 20+ Curated Imports</span>
              <span>•</span>
              <span>✓ 48-Hour Dispatch</span>
              <span>•</span>
              <span>✓ 100% Authentic</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. SPECIAL PROMOTIONS & FLASH DEALS TICKER */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.12))',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        marginBottom: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} color="var(--color-danger)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Flash Deals Ending Soon</span>
              <span style={{ 
                fontFamily: 'monospace', 
                backgroundColor: 'var(--bg-card)', 
                padding: '2px 8px', 
                borderRadius: 'var(--radius-sm)', 
                color: 'var(--color-danger)', 
                fontWeight: 800 
              }}>
                {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
              </span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Extra discounts applied across watches and audio hardware
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => copyCouponCode('GIZMO10')}
            className="btn btn-sm btn-secondary"
            style={{ borderColor: 'rgba(0, 229, 255, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {copiedCoupon === 'GIZMO10' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
            <span>GIZMO10 (10% OFF)</span>
          </button>
          <button
            onClick={() => copyCouponCode('GIZMO500')}
            className="btn btn-sm btn-secondary"
            style={{ borderColor: 'rgba(245, 158, 11, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {copiedCoupon === 'GIZMO500' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
            <span>GIZMO500 (₹500 OFF)</span>
          </button>
        </div>
      </div>

      {/* 4. MASTER TAXONOMY CATEGORIES */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800 }}>Explore by Category</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Master electronic and timepiece categories</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigateTo('categories')}>
            All Categories <ChevronRight size={16} />
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
          {categoriesList.map(cat => (
            <div
              key={cat.id}
              onClick={() => { setFilters({ category: cat.name.includes('Watch') ? 'Imported Watches' : 'Electronic Gadgets' }); navigateTo('search'); }}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
                gap: 10
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.borderColor = cat.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: cat.color
              }}>
                {cat.icon}
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {cat.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. CURATED COLLECTIONS */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800 }}>Curated Collections</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Handpicked themes and signature lines</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {collections.map((col, idx) => (
            <div
              key={idx}
              onClick={() => { setFilters({ category: col.category }); navigateTo('search'); }}
              style={{
                position: 'relative',
                height: 180,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <img
                src={col.image}
                alt={col.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(10, 14, 23, 0.92) 0%, rgba(10, 14, 23, 0.4) 60%, transparent 100%)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end'
              }}>
                <span className="badge badge-gold" style={{ alignSelf: 'flex-start', marginBottom: 6, fontSize: '0.6875rem' }}>
                  {col.badge}
                </span>
                <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff' }}>{col.title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{col.tagline}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. WHATSAPP-INGESTED LIVE CATALOG */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageCircle size={22} color="#25D366" />
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800 }}>WhatsApp-Ingested Live Catalog</h2>
              {(catalog.length > 0 || displayCatalog.length > 0) && (
                <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>
                  {(catalog.length > 0 ? catalog : displayCatalog).length} Items Available
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Live inventory verified directly from Meta WhatsApp Cloud API vendor broadcasts
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setFilters({}); navigateTo('search'); }}>
            View Full Vault <ArrowRight size={14} />
          </Button>
        </div>

        {catalogLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <ProductCardSkeleton key={`live-cat-skeleton-${idx}`} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
            {(catalog.length > 0 ? catalog : displayCatalog).map((p) => (
              <ProductCard
                key={`live-p-${p.id}`}
                product={p}
                onAddToCart={addToCart}
                onToggleWishlist={toggleWishlist}
                isWishlisted={wishlist.includes(p.id)}
                onClick={openProductDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* 7. FEATURED GADGETS */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={22} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800 }}>Featured Gadgets & Hardware</h2>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>High performance gear, audio, and foldable tech</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setFilters({ category: 'Electronic Gadgets' }); navigateTo('search'); }}>
            View All <ArrowRight size={14} />
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
          {gadgets.slice(0, 4).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={addToCart}
              onToggleWishlist={toggleWishlist}
              isWishlisted={wishlist.includes(p.id)}
              onClick={openProductDetails}
            />
          ))}
        </div>
      </div>

      {/* 7. IMPORTED WATCHES SPOTLIGHT */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Watch size={22} color="var(--accent-gold)" />
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800 }}>Imported Luxury Watches Collection</h2>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Precision Swiss & Japanese automatic movements with sapphire crystals</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setFilters({ category: 'Imported Watches' }); navigateTo('search'); }}>
            View All <ArrowRight size={14} />
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
          {watches.slice(0, 4).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={addToCart}
              onToggleWishlist={toggleWishlist}
              isWishlisted={wishlist.includes(p.id)}
              onClick={openProductDetails}
            />
          ))}
        </div>
      </div>

      {/* 8. TRENDING NOW */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={22} color="var(--color-danger)" />
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800 }}>Trending in Vault</h2>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Most active listings from verified WhatsApp broadcasts</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setFilters({ sortBy: 'popular' }); navigateTo('search'); }}>
            View All <ArrowRight size={14} />
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
          {trending.slice(0, 4).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={addToCart}
              onToggleWishlist={toggleWishlist}
              isWishlisted={wishlist.includes(p.id)}
              onClick={openProductDetails}
            />
          ))}
        </div>
      </div>

      {/* 9. NEW ARRIVALS */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={22} color="var(--accent-gold)" />
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800 }}>Fresh Ingested Arrivals</h2>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Just reviewed and published to the live catalog</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setFilters({ sortBy: 'newest' }); navigateTo('search'); }}>
            View All <ArrowRight size={14} />
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
          {newArrivals.slice(0, 4).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={addToCart}
              onToggleWishlist={toggleWishlist}
              isWishlisted={wishlist.includes(p.id)}
              onClick={openProductDetails}
            />
          ))}
        </div>
      </div>

      {/* 10. RECENTLY VIEWED (SESSION BASED) */}
      {recentlyViewed && recentlyViewed.length > 0 && (
        <div style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <Eye size={20} color="var(--accent-cyan)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Recently Viewed by You</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {recentlyViewed.slice(0, 4).map((p) => (
              <ProductCard
                key={`recent-${p.id}`}
                product={p}
                onAddToCart={addToCart}
                onToggleWishlist={toggleWishlist}
                isWishlisted={wishlist.includes(p.id)}
                onClick={openProductDetails}
              />
            ))}
          </div>
        </div>
      )}

      {/* 11. TRUST BADGES GRID */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xl)',
        padding: '32px 24px',
        marginBottom: 48
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 6 }}>The GizmoVault Buyer Protection</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Every item verified, secured, and backed by our quality promise</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 24 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(0, 229, 255, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={22} color="var(--accent-cyan)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>100% Authenticity Verified</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Multi-point physical inspection for genuine movements and authentic parts.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Truck size={22} color="var(--accent-gold)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>Express Doorstep Delivery</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Insured transit with live Delhivery and BlueDart carrier tracking numbers.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <RotateCcw size={22} color="var(--color-success)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>7-Day Easy Replacement</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Hassle-free replacement guarantee on any transit or functional discrepancies.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(168, 85, 247, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Lock size={22} color="#a855f7" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>Google Play Certified</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Encrypted checkout with in-app data safety and guaranteed account deletion.</div>
            </div>
          </div>
        </div>
      </div>

      {/* 12. FOOTER */}
      <footer style={{
        borderTop: '1px solid var(--border-medium)',
        paddingTop: 36,
        color: 'var(--text-secondary)',
        fontSize: '0.875rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 28, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: 13 }}>GV</div>
              <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)' }}>GizmoVault</span>
            </div>
            <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, marginBottom: 14 }}>
              Discover. Compare. Shop. The premier destination for imported watches and cutting-edge electronic hardware.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontSize: '0.75rem', fontWeight: 600 }}>
              <MessageCircle size={14} /> Official Meta Cloud API Partner Channel
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Catalog Taxonomy</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><a href="#watches" onClick={(e) => { e.preventDefault(); setFilters({ category: 'Imported Watches' }); navigateTo('search'); }} style={{ color: 'inherit' }}>Imported Luxury Watches</a></li>
              <li><a href="#phones" onClick={(e) => { e.preventDefault(); setFilters({ category: 'Electronic Gadgets' }); navigateTo('search'); }} style={{ color: 'inherit' }}>Smartphones & Foldables</a></li>
              <li><a href="#audio" onClick={(e) => { e.preventDefault(); setFilters({ category: 'Electronic Gadgets' }); navigateTo('search'); }} style={{ color: 'inherit' }}>Spatial Audio & ANC</a></li>
              <li><a href="#drones" onClick={(e) => { e.preventDefault(); setFilters({ category: 'Electronic Gadgets' }); navigateTo('search'); }} style={{ color: 'inherit' }}>Photography Drones</a></li>
            </ul>
          </div>

          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Customer Hub</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><a href="#orders" onClick={(e) => { e.preventDefault(); navigateTo('orders'); }} style={{ color: 'inherit' }}>My Orders & Tracking</a></li>
              <li><a href="#wishlist" onClick={(e) => { e.preventDefault(); navigateTo('wishlist'); }} style={{ color: 'inherit' }}>Saved Wishlist</a></li>
              <li><a href="#help" onClick={(e) => { e.preventDefault(); navigateTo('help'); }} style={{ color: 'inherit' }}>Help & Support</a></li>
              <li><a href="#admin" onClick={(e) => { e.preventDefault(); navigateTo('admin-dashboard'); }} style={{ color: 'inherit' }}>Vendor Portal</a></li>
            </ul>
          </div>

          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Legal & Compliance</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><a href="#privacy" onClick={(e) => { e.preventDefault(); navigateTo('privacy'); }} style={{ color: 'inherit' }}>Privacy Policy</a></li>
              <li><a href="#terms" onClick={(e) => { e.preventDefault(); navigateTo('terms'); }} style={{ color: 'inherit' }}>Terms of Service</a></li>
              <li><a href="#refund" onClick={(e) => { e.preventDefault(); navigateTo('refund-policy'); }} style={{ color: 'inherit' }}>Refund & Cancellation</a></li>
              <li><a href="#delete" onClick={(e) => { e.preventDefault(); navigateTo('profile'); }} style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>Google Play Account Deletion</a></li>
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--border-light)',
          paddingTop: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: '0.75rem'
        }}>
          <div>© 2026 GizmoVault Inc. All rights reserved. Target SDK 34 Compliant.</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>Razorpay / UPI Physical Goods Exemption</span>
            <span>256-Bit SSL Encrypted</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
