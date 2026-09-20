import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  ShoppingBag, 
  Zap, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  Star, 
  Play, 
  Video,
  MapPin,
  CheckCircle2,
  Lock,
  Tag
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ProductCard } from '../../ui/ProductCard';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../ui/Toast';

export const ProductDetailsView: React.FC = () => {
  const { 
    selectedProduct, 
    products, 
    navigateTo, 
    addToCart, 
    toggleWishlist, 
    wishlist, 
    openProductDetails 
  } = useApp();
  const { showToast } = useToast();

  if (!selectedProduct) return null;

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [pincodeInput, setPincodeInput] = useState('');
  const [deliveryEstimate, setDeliveryEstimate] = useState<string | null>(null);

  const isWishlisted = wishlist.includes(selectedProduct.id);
  const isWatch = selectedProduct.category.toLowerCase().includes('watch');
  const isOutOfStock = selectedProduct.stockStatus === 'OUT_OF_STOCK' || selectedProduct.stockQuantity <= 0;

  // Related products: same category, excluding current product
  const relatedProducts = products
    .filter(p => p.category === selectedProduct.category && p.id !== selectedProduct.id)
    .slice(0, 3);

  // Recommended products: trending or featured from other categories
  const recommendedProducts = products
    .filter(p => p.id !== selectedProduct.id && p.category !== selectedProduct.category)
    .slice(0, 3);

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    addToCart(selectedProduct, quantity);
    navigateTo('checkout');
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(selectedProduct, quantity);
    showToast(`Added ${quantity} ${selectedProduct.title} to cart`, 'success');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: selectedProduct.title,
        text: `Check out ${selectedProduct.title} on GizmoVault`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Product link copied to clipboard!', 'info');
    }
  };

  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(pincodeInput.trim())) {
      // Calculate delivery date 2-4 days out
      const date = new Date();
      date.setDate(date.getDate() + 3);
      const formattedDate = date.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      setDeliveryEstimate(`Fast Delivery by ${formattedDate} to ${pincodeInput.trim()} (FREE Express Delivery)`);
    } else {
      showToast('Please enter a valid 6-digit Indian PIN code', 'warning');
    }
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Top Back Navigation & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('home')}>
          Back to Catalog
        </Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={handleShare}
            aria-label="Share product"
            title="Share Product"
          >
            <Share2 size={18} />
          </button>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => toggleWishlist(selectedProduct.id)}
            style={{ color: isWishlisted ? 'var(--color-danger)' : 'var(--text-secondary)' }}
            aria-label="Toggle wishlist"
            title={isWishlisted ? "In Wishlist" : "Add to Wishlist"}
          >
            <Heart size={18} fill={isWishlisted ? "var(--color-danger)" : "none"} />
          </button>
        </div>
      </div>

      {/* Main Grid: Gallery on Left, Details on Right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 32,
        marginBottom: 40
      }}>
        {/* Left Column: Media Gallery */}
        <div>
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            background: '#0d121c',
            border: '1px solid var(--border-medium)',
            marginBottom: 12
          }}>
            {showVideo && selectedProduct.hasVideo && selectedProduct.videoUrl ? (
              <video 
                src={selectedProduct.videoUrl} 
                controls 
                autoPlay 
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <img 
                src={selectedProduct.images[activeMediaIndex] || selectedProduct.primaryImage} 
                alt={selectedProduct.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}

            {/* Prominent Video Demo Toggle Badge — only displayed if video exists */}
            {selectedProduct.hasVideo && selectedProduct.videoUrl && (
              <button
                onClick={() => setShowVideo(!showVideo)}
                className="btn btn-sm"
                style={{
                  position: 'absolute',
                  bottom: 14,
                  right: 14,
                  background: showVideo ? 'var(--accent-cyan)' : 'rgba(10, 14, 23, 0.88)',
                  color: showVideo ? '#041017' : '#fff',
                  backdropFilter: 'blur(8px)',
                  fontWeight: 700,
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {showVideo ? <Play size={14} fill="currentColor" /> : <Video size={14} />}
                <span>{showVideo ? 'View Photos' : 'Watch Live Video Demo'}</span>
              </button>
            )}
          </div>

          {/* Thumbnail Strip */}
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
            {selectedProduct.images.map((img, idx) => (
              <div
                key={idx}
                onClick={() => { setShowVideo(false); setActiveMediaIndex(idx); }}
                style={{
                  width: 68,
                  height: 68,
                  flexShrink: 0,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: !showVideo && activeMediaIndex === idx 
                    ? '2px solid var(--accent-cyan)' 
                    : '1px solid var(--border-subtle)',
                  opacity: !showVideo && activeMediaIndex === idx ? 1 : 0.6,
                  transition: 'all var(--transition-fast)'
                }}
              >
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Product Information & Purchase */}
        <div>
          {/* Taxonomy Badge, Brand & Model */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className={`badge ${isWatch ? 'badge-gold' : 'badge-cyan'}`}>
              {selectedProduct.category}
            </span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Brand: <strong style={{ color: 'var(--text-primary)' }}>{selectedProduct.brand}</strong>
            </span>
            {selectedProduct.model && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                • Model: <strong style={{ color: 'var(--text-primary)' }}>{selectedProduct.model}</strong>
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, lineHeight: 1.25, marginBottom: 12 }}>
            {selectedProduct.title}
          </h1>

          {/* Ratings, Review Count & SKU */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#fbbf24', fontWeight: 700 }}>
              <Star size={16} fill="#fbbf24" />
              <span>{selectedProduct.rating.toFixed(1)}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                ({selectedProduct.ratingCount} verified reviews)
              </span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>SKU: {selectedProduct.sku}</span>
          </div>

          {/* Pricing Box */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 22px',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ₹{selectedProduct.sellingPrice.toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                ₹{selectedProduct.originalPrice.toLocaleString('en-IN')}
              </span>
              <span className="badge badge-discount" style={{ fontSize: '0.875rem', padding: '4px 10px' }}>
                Save ₹{(selectedProduct.originalPrice - selectedProduct.sellingPrice).toLocaleString('en-IN')} (-{Math.round(selectedProduct.discountPercent)}%)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--color-success)', fontWeight: 600 }}>
              <CheckCircle2 size={14} />
              Inclusive of all taxes & doorstep delivery insurance
            </div>
          </div>

          {/* Short Description */}
          {selectedProduct.shortDescription && (
            <div style={{
              background: 'rgba(0, 229, 255, 0.04)',
              borderLeft: '3px solid var(--accent-cyan)',
              padding: '10px 14px',
              borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              marginBottom: 18,
              fontSize: '0.9375rem',
              color: 'var(--text-primary)',
              fontWeight: 500
            }}>
              {selectedProduct.shortDescription}
            </div>
          )}

          {/* Full Description */}
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 22 }}>
            {selectedProduct.fullDescription}
          </p>

          {/* Quantity Selector & Stock Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Quantity:</span>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: 'var(--bg-surface-elevated)', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-subtle)' 
              }}>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={isOutOfStock || quantity <= 1}
                  style={{ padding: '6px 14px', fontWeight: 700 }}
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span style={{ fontWeight: 700, minWidth: 28, textAlign: 'center', fontSize: '0.9375rem' }}>{quantity}</span>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setQuantity(Math.min(selectedProduct.stockQuantity || 10, quantity + 1))}
                  disabled={isOutOfStock || quantity >= selectedProduct.stockQuantity}
                  style={{ padding: '6px 14px', fontWeight: 700 }}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem' }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isOutOfStock 
                  ? 'var(--color-danger)' 
                  : selectedProduct.stockStatus === 'LOW_STOCK' 
                  ? 'var(--color-warning)' 
                  : 'var(--color-success)'
              }} />
              <span style={{ 
                fontWeight: 600,
                color: isOutOfStock 
                  ? 'var(--color-danger)' 
                  : selectedProduct.stockStatus === 'LOW_STOCK' 
                  ? 'var(--color-warning)' 
                  : 'var(--color-success)' 
              }}>
                {isOutOfStock ? 'Currently Out of Stock' : `${selectedProduct.stockQuantity} units in stock`}
              </span>
            </div>
          </div>

          {/* Action CTAs: ADD TO CART and BUY NOW */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            <Button 
              variant={isWatch ? "gold" : "primary"} 
              size="lg" 
              icon={<ShoppingBag size={18} />}
              onClick={handleAddToCart}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </Button>
            <Button 
              variant="secondary" 
              size="lg" 
              icon={<Zap size={18} />}
              onClick={handleBuyNow}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? 'Unavailable' : 'Buy Now'}
            </Button>
          </div>

          {/* Delivery Pincode Checker */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', fontWeight: 600, marginBottom: 10 }}>
              <MapPin size={16} color="var(--accent-cyan)" />
              <span>Check Delivery Speed & Cash on Delivery Availability</span>
            </div>
            <form onSubmit={handleCheckPincode} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Enter 6-digit PIN code"
                value={pincodeInput}
                onChange={(e) => setPincodeInput(e.target.value)}
                maxLength={6}
                style={{
                  flex: 1,
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
              <Button type="submit" variant="secondary" size="sm">
                Check
              </Button>
            </form>
            {deliveryEstimate && (
              <div style={{ marginTop: 10, fontSize: '0.8125rem', color: 'var(--color-success)', fontWeight: 600 }}>
                ✓ {deliveryEstimate}
              </div>
            )}
          </div>

          {/* 4 Core Trust & Assurance Signals: Warranty, Shipping, Returns, Safe Checkout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            padding: 16,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
            fontSize: '0.75rem'
          }}>
            <div>
              <ShieldCheck size={20} color="var(--accent-cyan)" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Warranty</div>
              <div style={{ color: 'var(--text-muted)' }}>{selectedProduct.warranty}</div>
            </div>
            <div>
              <Truck size={20} color="var(--accent-gold)" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Express Shipping</div>
              <div style={{ color: 'var(--text-muted)' }}>{selectedProduct.shippingClass || '2-4 Days Doorstep'}</div>
            </div>
            <div>
              <RotateCcw size={20} color="var(--color-success)" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>7-Day Returns</div>
              <div style={{ color: 'var(--text-muted)' }}>Hassle-Free Replacement</div>
            </div>
            <div>
              <Lock size={20} color="#38bdf8" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Safe Checkout</div>
              <div style={{ color: 'var(--text-muted)' }}>256-Bit SSL Encrypted</div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Specifications Section */}
      <Card style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <Tag size={18} color="var(--accent-cyan)" />
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Technical Specifications</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px 28px' }}>
          {Object.entries(selectedProduct.specifications).map(([key, val]) => (
            <div key={key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.875rem'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>{key}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>{val}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Related in {selectedProduct.category}</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Similar category models</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {relatedProducts.map(p => (
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
      )}

      {/* Recommended Products Section */}
      {recommendedProducts.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>You May Also Like</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--accent-cyan)' }}>Vault Curated Recommendations</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {recommendedProducts.map(p => (
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
      )}
    </div>
  );
};
