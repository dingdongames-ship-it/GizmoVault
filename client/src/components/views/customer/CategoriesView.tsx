import React, { useState, useMemo } from 'react';
import { 
  Headphones, 
  Watch, 
  Smartphone, 
  Activity, 
  Gamepad2, 
  Camera, 
  Sparkles, 
  ArrowUpDown, 
  Filter, 
  Check, 
  X, 
  ChevronRight, 
  Search, 
  Zap, 
  Flame, 
  RefreshCw 
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ProductCard } from '../../ui/ProductCard';
import { EmptyState } from '../../ui/Feedback';
import { useApp } from '../../../context/AppContext';

export interface SubCategoryItem {
  name: string;
  query: string;
  description: string;
}

export interface MasterCategoryDef {
  id: string;
  name: string;
  slug: string;
  icon: React.ReactNode;
  accentColor: string;
  bannerImage: string;
  description: string;
  subcategories: SubCategoryItem[];
}

export const CategoriesView: React.FC = () => {
  const { 
    products, 
    addToCart, 
    toggleWishlist, 
    wishlist, 
    openProductDetails, 
    navigateTo 
  } = useApp();

  // 6 Master Taxonomy Categories
  const masterCategories: MasterCategoryDef[] = [
    {
      id: 'cat_all',
      name: 'All Catalog',
      slug: 'all',
      icon: <Sparkles size={18} />,
      accentColor: 'var(--text-primary)',
      bannerImage: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80',
      description: 'Explore our entire verified catalog of electronics, hardware, and imported timepieces.',
      subcategories: [
        { name: 'All Products', query: '', description: 'Everything in the vault' },
        { name: 'Featured Items', query: 'featured', description: 'Top rated highlights' },
        { name: 'With Video Demos', query: 'video', description: 'Real physical recordings' }
      ]
    },
    {
      id: 'cat_phones',
      name: 'Smartphones & Foldables',
      slug: 'smartphones-foldables',
      icon: <Smartphone size={18} />,
      accentColor: 'var(--accent-cyan)',
      bannerImage: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
      description: 'Zero-crease foldables, titanium flagships, and compact 5G powerhouse devices.',
      subcategories: [
        { name: 'All Phones', query: '', description: 'Full mobile portfolio' },
        { name: 'Foldable & Flip', query: 'fold', description: 'Dual AMOLED screens & titanium hinges' },
        { name: 'Flagship 5G', query: 'flagship', description: 'Snapdragon 8 Gen 3 & 2K LTPO' },
        { name: 'Compact Edition', query: 'compact', description: 'Pocket-sized ergonomics' }
      ]
    },
    {
      id: 'cat_watches',
      name: 'Imported Luxury Watches',
      slug: 'imported-luxury-watches',
      icon: <Watch size={18} />,
      accentColor: 'var(--accent-gold)',
      bannerImage: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1200&q=80',
      description: 'Authentic imported timepieces featuring automatic movements, sapphire crystals, and 316L steel.',
      subcategories: [
        { name: 'All Watches', query: '', description: 'Full timepiece vault' },
        { name: 'Mechanical & Automatic', query: 'automatic', description: 'Exhibition casebacks & kinetic rotors' },
        { name: 'Tachymeter Chronographs', query: 'chronograph', description: 'Triple sub-dial precision timers' },
        { name: 'Skeleton Exhibition', query: 'skeleton', description: 'Exposed escapement & gear trains' },
        { name: 'Ultra AMOLED Smartwatches', query: 'amoled', description: 'Titanium bezel BT calling' }
      ]
    },
    {
      id: 'cat_audio',
      name: 'Audio & Sound',
      slug: 'audio-sound',
      icon: <Headphones size={18} />,
      accentColor: '#38bdf8',
      bannerImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80',
      description: 'Studio monitors, active noise cancelling headphones, and dual-driver audiophile earbuds.',
      subcategories: [
        { name: 'All Audio', query: '', description: 'Complete sound hardware' },
        { name: 'Over-Ear ANC', query: 'anc', description: 'Hybrid active noise cancelling' },
        { name: 'True Wireless (TWS)', query: 'tws', description: 'Low latency spatial Bluetooth 5.4' },
        { name: 'Studio Reference', query: 'studio', description: 'Hi-Res certified dual drivers' }
      ]
    },
    {
      id: 'cat_wearables',
      name: 'Smart Wearables',
      slug: 'smart-wearables',
      icon: <Activity size={18} />,
      accentColor: '#a855f7',
      bannerImage: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1200&q=80',
      description: 'Health trackers, titanium smart rings, and continuous SpO2/HRV biometric monitoring.',
      subcategories: [
        { name: 'All Wearables', query: '', description: 'Full bio-tracking gear' },
        { name: 'Titanium Trackers', query: 'titanium', description: 'Aerospace rugged chassis' },
        { name: 'Smart Health Rings', query: 'ring', description: 'Finger-worn sleep & recovery trackers' }
      ]
    },
    {
      id: 'cat_gaming',
      name: 'Gaming Gear',
      slug: 'gaming-gear',
      icon: <Gamepad2 size={18} />,
      accentColor: '#ef4444',
      bannerImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
      description: 'Hot-swappable mechanical keyboards, ultra-low latency sensors, and ergonomic peripherals.',
      subcategories: [
        { name: 'All Gaming', query: '', description: 'Competitive gear' },
        { name: 'Mechanical Keyboards', query: 'keyboard', description: 'Linear yellow switches & RGB' },
        { name: 'Precision Wireless Mice', query: 'mouse', description: '8000Hz polling optical sensors' }
      ]
    },
    {
      id: 'cat_drones',
      name: 'Photography & Drones',
      slug: 'photography-drones',
      icon: <Camera size={18} />,
      accentColor: '#10b981',
      bannerImage: 'https://images.unsplash.com/photo-1507582020434-9e063fea0c56?auto=format&fit=crop&w=1200&q=80',
      description: '4K GPS stabilized camera drones, motorized 3-axis handheld gimbals, and optics.',
      subcategories: [
        { name: 'All Photography', query: '', description: 'Air & ground capture' },
        { name: '4K GPS Drones', query: 'drone', description: 'Brushless motors & obstacle avoidance' },
        { name: 'Handheld Gimbals', query: 'gimbal', description: '3-axis active stabilization' }
      ]
    }
  ];

  // Active category & subcategory state
  const [selectedCatSlug, setSelectedCatSlug] = useState<string>('all');
  const [selectedSubQuery, setSelectedSubQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<'popular' | 'price_asc' | 'price_desc' | 'newest'>('popular');
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [hasVideoOnly, setHasVideoOnly] = useState<boolean>(false);
  const [pricePreset, setPricePreset] = useState<'ALL' | 'UNDER_5K' | '5K_TO_20K' | 'ABOVE_20K'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const activeCategory = masterCategories.find(c => c.slug === selectedCatSlug) || masterCategories[0];

  const handleSelectCategory = (slug: string) => {
    setIsLoading(true);
    setSelectedCatSlug(slug);
    setSelectedSubQuery('');
    setSelectedBrand('ALL');
    setPricePreset('ALL');
    setTimeout(() => setIsLoading(false), 120);
  };

  const handleSelectSubcategory = (query: string) => {
    setIsLoading(true);
    setSelectedSubQuery(query);
    setTimeout(() => setIsLoading(false), 80);
  };

  // Filtered & sorted products computation
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Category check
      if (selectedCatSlug !== 'all') {
        const catNameLower = activeCategory.name.toLowerCase();
        const prodCatLower = p.category.toLowerCase();
        const matchesCategory = 
          prodCatLower.includes(catNameLower) ||
          (selectedCatSlug === 'imported-luxury-watches' && prodCatLower.includes('watch')) ||
          (selectedCatSlug === 'smartphones-foldables' && (prodCatLower.includes('phone') || prodCatLower.includes('gadget'))) ||
          (selectedCatSlug === 'audio-sound' && (prodCatLower.includes('audio') || prodCatLower.includes('gadget'))) ||
          (selectedCatSlug === 'smart-wearables' && (prodCatLower.includes('wearable') || prodCatLower.includes('watch'))) ||
          (selectedCatSlug === 'gaming-gear' && prodCatLower.includes('gadget')) ||
          (selectedCatSlug === 'photography-drones' && prodCatLower.includes('gadget'));

        if (!matchesCategory) return false;
      }

      // 2. Subcategory query check
      if (selectedSubQuery) {
        if (selectedSubQuery === 'featured' && !p.isFeatured) return false;
        if (selectedSubQuery === 'video' && !p.hasVideo) return false;
        if (selectedSubQuery !== 'featured' && selectedSubQuery !== 'video') {
          const q = selectedSubQuery.toLowerCase();
          const matchesTitle = p.title.toLowerCase().includes(q);
          const matchesDesc = p.fullDescription.toLowerCase().includes(q);
          const matchesTags = p.tags.some(t => t.toLowerCase().includes(q));
          if (!matchesTitle && !matchesDesc && !matchesTags) return false;
        }
      }

      // 3. Brand filter
      if (selectedBrand !== 'ALL') {
        if (p.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
      }

      // 4. Availability
      if (inStockOnly && p.stockStatus === 'OUT_OF_STOCK') return false;

      // 5. Video demo
      if (hasVideoOnly && !p.hasVideo) return false;

      // 6. Price presets
      if (pricePreset === 'UNDER_5K' && p.sellingPrice >= 5000) return false;
      if (pricePreset === '5K_TO_20K' && (p.sellingPrice < 5000 || p.sellingPrice > 20000)) return false;
      if (pricePreset === 'ABOVE_20K' && p.sellingPrice <= 20000) return false;

      return true;
    }).sort((a, b) => {
      if (sortOption === 'price_asc') return a.sellingPrice - b.sellingPrice;
      if (sortOption === 'price_desc') return b.sellingPrice - a.sellingPrice;
      if (sortOption === 'newest') return b.id.localeCompare(a.id);
      // Default: popular
      return b.rating - a.rating;
    });
  }, [products, selectedCatSlug, selectedSubQuery, selectedBrand, inStockOnly, hasVideoOnly, pricePreset, sortOption, activeCategory]);

  // Extract unique brands for active category
  const categoryBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    products.forEach(p => {
      if (selectedCatSlug === 'all' || p.category.toLowerCase().includes(activeCategory.name.toLowerCase().split(' ')[0])) {
        if (p.brand) brandsSet.add(p.brand);
      }
    });
    return Array.from(brandsSet);
  }, [products, selectedCatSlug, activeCategory]);

  const resetAllFilters = () => {
    setSelectedBrand('ALL');
    setPricePreset('ALL');
    setInStockOnly(false);
    setHasVideoOnly(false);
    setSelectedSubQuery('');
    setSortOption('popular');
  };

  const hasActiveFilters = selectedBrand !== 'ALL' || pricePreset !== 'ALL' || inStockOnly || hasVideoOnly || selectedSubQuery !== '';

  return (
    <div style={{ paddingBottom: 64 }}>
      {/* 1. VIEW HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Category Explorer
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
          Browse authenticated imports across 6 master hardware and horological taxonomies
        </p>
      </div>

      {/* 2. MASTER CATEGORY PILLS / TABS */}
      <div style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 12,
        marginBottom: 24,
        borderBottom: '1px solid var(--border-light)'
      }}>
        {masterCategories.map(cat => {
          const isSelected = cat.slug === selectedCatSlug;
          return (
            <button
              key={cat.id}
              onClick={() => handleSelectCategory(cat.slug)}
              className="btn btn-sm"
              style={{
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
                borderColor: isSelected ? cat.accentColor : 'var(--border-medium)',
                color: isSelected ? cat.accentColor : 'var(--text-secondary)',
                fontWeight: isSelected ? 700 : 500,
                boxShadow: isSelected ? `0 0 12px ${cat.accentColor}22` : 'none',
                flexShrink: 0
              }}
            >
              {cat.icon}
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* 3. CATEGORY HERO BANNER */}
      <div style={{
        background: `radial-gradient(ellipse at top right, ${activeCategory.accentColor}22, transparent 65%), var(--bg-surface)`,
        border: `1px solid var(--border-medium)`,
        borderRadius: 'var(--radius-xl)',
        padding: '28px 24px',
        marginBottom: 28,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ maxWidth: 620 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, color: activeCategory.accentColor, fontWeight: 700, fontSize: '0.8125rem' }}>
            {activeCategory.icon}
            <span>{activeCategory.slug.toUpperCase()} TAXONOMY</span>
          </div>
          <h2 style={{ fontSize: '1.625rem', fontWeight: 800, marginBottom: 8 }}>
            {activeCategory.name}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {activeCategory.description}
          </p>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: activeCategory.accentColor }}>
            {filteredProducts.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Verified Listings
          </div>
        </div>
      </div>

      {/* 4. SUBCATEGORIES BROWSER */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Subcategories
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
          {activeCategory.subcategories.map((sub, idx) => {
            const isSubSelected = selectedSubQuery === sub.query;
            return (
              <button
                key={idx}
                onClick={() => handleSelectSubcategory(sub.query)}
                className="btn btn-sm"
                style={{
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSubSelected ? 'var(--bg-surface)' : 'var(--bg-card)',
                  borderColor: isSubSelected ? activeCategory.accentColor : 'var(--border-light)',
                  color: isSubSelected ? activeCategory.accentColor : 'var(--text-primary)',
                  fontWeight: isSubSelected ? 700 : 500,
                  flexShrink: 0,
                  fontSize: '0.8125rem'
                }}
              >
                {sub.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. TOOLBAR: SORT, FILTERS & COUNTERS */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        {/* Left: Counters */}
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredProducts.length}</strong> of{' '}
          <strong>{products.length}</strong> verified products
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                marginLeft: 10,
                textDecoration: 'underline'
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Right: Sort dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpDown size={14} /> Sort By:
          </span>
          <select
            className="input"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            style={{ width: 'auto', padding: '6px 12px', height: 36, fontSize: '0.8125rem' }}
          >
            <option value="popular">Most Popular & Highest Rated</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="newest">Newest Ingested Arrivals</option>
          </select>
        </div>
      </div>

      {/* 6. FACETED IN-CATEGORY FILTERS ROW */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 28,
        padding: '0 4px'
      }}>
        {/* Brand Dropdown */}
        {categoryBrands.length > 0 && (
          <select
            className="input"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', height: 34, fontSize: '0.8125rem' }}
          >
            <option value="ALL">All Brands</option>
            {categoryBrands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}

        {/* Price Presets */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setPricePreset(prev => prev === 'UNDER_5K' ? 'ALL' : 'UNDER_5K')}
            className={`btn btn-sm ${pricePreset === 'UNDER_5K' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', height: 32, padding: '0 10px', borderRadius: 'var(--radius-full)' }}
          >
            Under ₹5,000
          </button>
          <button
            onClick={() => setPricePreset(prev => prev === '5K_TO_20K' ? 'ALL' : '5K_TO_20K')}
            className={`btn btn-sm ${pricePreset === '5K_TO_20K' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', height: 32, padding: '0 10px', borderRadius: 'var(--radius-full)' }}
          >
            ₹5K – ₹20K
          </button>
          <button
            onClick={() => setPricePreset(prev => prev === 'ABOVE_20K' ? 'ALL' : 'ABOVE_20K')}
            className={`btn btn-sm ${pricePreset === 'ABOVE_20K' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', height: 32, padding: '0 10px', borderRadius: 'var(--radius-full)' }}
          >
            Above ₹20,000
          </button>
        </div>

        {/* In Stock Toggle */}
        <button
          onClick={() => setInStockOnly(prev => !prev)}
          className={`btn btn-sm ${inStockOnly ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.75rem', height: 32, padding: '0 10px', borderRadius: 'var(--radius-full)' }}
        >
          {inStockOnly && <Check size={12} style={{ marginRight: 4 }} />} In Stock Only
        </button>

        {/* Video Demo Toggle */}
        <button
          onClick={() => setHasVideoOnly(prev => !prev)}
          className={`btn btn-sm ${hasVideoOnly ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.75rem', height: 32, padding: '0 10px', borderRadius: 'var(--radius-full)' }}
        >
          {hasVideoOnly && <Check size={12} style={{ marginRight: 4 }} />} Has Video Demo
        </button>
      </div>

      {/* 7. PRODUCT GRID OR EMPTY / LOADING STATES */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={i}
              style={{
                height: 360,
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
                opacity: 0.6,
                animation: 'pulse 1.5s infinite'
              }}
            />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No Products Found in this Filter"
          description="We couldn't find any products matching your specific criteria in this category. Try loosening your price filters or brand selection."
          actionText="Reset All Filters"
          onAction={resetAllFilters}
          icon={<Filter size={32} color="var(--accent-cyan)" />}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={addToCart}
              onToggleWishlist={toggleWishlist}
              isWishlisted={wishlist.includes(product.id)}
              onClick={openProductDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
};
