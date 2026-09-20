import React, { useState, useMemo } from 'react';
import { SlidersHorizontal, Search as SearchIcon, X } from 'lucide-react';
import { ProductCard } from '../../ui/ProductCard';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/Feedback';
import { useApp } from '../../../context/AppContext';

export const SearchResultsView: React.FC = () => {
  const { 
    products, 
    searchQuery, 
    setSearchQuery, 
    filters, 
    setFilters, 
    addToCart, 
    toggleWishlist, 
    wishlist, 
    openProductDetails 
  } = useApp();

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Computed filtered & sorted products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search text match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesBrand = p.brand.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        const matchesTags = p.tags.some(t => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesBrand && !matchesCategory && !matchesTags) {
          return false;
        }
      }

      // Category filter
      if (filters.category && filters.category !== 'All') {
        if (!p.category.toLowerCase().includes(filters.category.toLowerCase())) {
          return false;
        }
      }

      // Max price filter
      if (filters.maxPrice && p.sellingPrice > filters.maxPrice) {
        return false;
      }

      // Video only filter
      if (filters.hasVideoOnly && !p.hasVideo) {
        return false;
      }

      // In stock only filter
      if (filters.inStockOnly && p.stockStatus === 'OUT_OF_STOCK') {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'price_asc') return a.sellingPrice - b.sellingPrice;
      if (filters.sortBy === 'price_desc') return b.sellingPrice - a.sellingPrice;
      if (filters.sortBy === 'popular') return b.rating - a.rating;
      return 0;
    });
  }, [products, searchQuery, filters]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilters({ sortBy: 'relevance' });
  };

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Search Bar & Filter Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <Input
            placeholder="Search watches, headphones, GaN chargers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<SearchIcon size={18} />}
          />
        </div>
        <Button 
          variant={filters.category || filters.hasVideoOnly || filters.maxPrice ? "primary" : "secondary"} 
          icon={<SlidersHorizontal size={16} />}
          onClick={() => setIsFilterOpen(!isFilterOpen)}
        >
          Filters
        </Button>
      </div>

      {/* Filter Chips Bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {filteredProducts.length} items found
        </span>

        {filters.category && (
          <span className="badge badge-cyan" style={{ cursor: 'pointer' }} onClick={() => setFilters(prev => ({ ...prev, category: undefined }))}>
            {filters.category} <X size={12} />
          </span>
        )}

        {filters.hasVideoOnly && (
          <span className="badge badge-gold" style={{ cursor: 'pointer' }} onClick={() => setFilters(prev => ({ ...prev, hasVideoOnly: false }))}>
            With Video Demo <X size={12} />
          </span>
        )}

        {filters.maxPrice && (
          <span className="badge badge-discount" style={{ cursor: 'pointer' }} onClick={() => setFilters(prev => ({ ...prev, maxPrice: undefined }))}>
            Under ₹{filters.maxPrice.toLocaleString('en-IN')} <X size={12} />
          </span>
        )}

        {(filters.category || filters.hasVideoOnly || filters.maxPrice || searchQuery) && (
          <button 
            onClick={clearAllFilters} 
            style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Filter Drawer / Accordion Panel */}
      {isFilterOpen && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <div>
            <label className="form-label" style={{ marginBottom: 8 }}>Category</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['All', 'Imported Watches', 'Electronic Gadgets'].map((cat) => (
                <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="category" 
                    checked={(filters.category || 'All') === cat} 
                    onChange={() => setFilters(prev => ({ ...prev, category: cat === 'All' ? undefined : cat }))}
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 8 }}>Sort Order</label>
            <select 
              className="form-input" 
              value={filters.sortBy || 'relevance'} 
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
            >
              <option value="relevance">Relevance / Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="popular">Customer Rating</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 8 }}>Media & Stock</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={!!filters.hasVideoOnly} 
                  onChange={(e) => setFilters(prev => ({ ...prev, hasVideoOnly: e.target.checked }))}
                />
                <span>Has Video Preview</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={!!filters.inStockOnly} 
                  onChange={(e) => setFilters(prev => ({ ...prev, inStockOnly: e.target.checked }))}
                />
                <span>In Stock Only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={32} />}
          title="No products match your search"
          description="Try broadening your keywords or removing some filters to discover available gadgets and watches."
          actionText="Clear All Filters"
          onAction={clearAllFilters}
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16
        }}>
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
