import React from 'react';
import { Heart, ShoppingBag, Video, Star } from 'lucide-react';
import { Button } from './Button';
import { Product } from '../../types';

export interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (productId: string) => void;
  isWishlisted?: boolean;
  onClick?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  onClick
}) => {
  const isWatch = product.category.toLowerCase().includes('watch');

  return (
    <div className="product-card" onClick={() => onClick && onClick(product)}>
      {/* Product Image Wrap */}
      <div className="product-card-image-wrap">
        <img
          src={product.primaryImage}
          alt={product.title}
          className="product-card-image"
          loading="lazy"
        />

        {/* Top Floating Badges */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 2
        }}>
          {product.discountPercent > 0 && (
            <span className="badge badge-discount">
              -{Math.round(product.discountPercent)}%
            </span>
          )}
          {product.hasVideo && (
            <span className="badge badge-cyan" style={{ fontSize: '0.6875rem' }}>
              <Video size={12} /> Video
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist && onToggleWishlist(product.id);
          }}
          className="btn btn-ghost btn-icon"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(16, 22, 36, 0.75)',
            backdropFilter: 'blur(8px)',
            width: 34,
            height: 34,
            zIndex: 2,
            color: isWishlisted ? 'var(--color-danger)' : 'var(--text-secondary)'
          }}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={16} fill={isWishlisted ? "var(--color-danger)" : "none"} />
        </button>

        {/* Stock Status Dot */}
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(10, 14, 23, 0.8)',
          backdropFilter: 'blur(6px)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: product.stockStatus === 'IN_STOCK' ? 'var(--color-success)' : 'var(--color-warning)'
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: product.stockStatus === 'IN_STOCK' ? 'var(--color-success)' : 'var(--color-warning)'
          }} />
          {product.stockStatus === 'IN_STOCK' ? 'In Stock' : 'Low Stock'}
        </div>
      </div>

      {/* Product Content Details */}
      <div className="product-card-content">
        {/* Category & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
          <span style={{ color: isWatch ? 'var(--accent-gold)' : 'var(--accent-cyan)', fontWeight: 600 }}>
            {product.category}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#fbbf24', fontWeight: 600 }}>
            <Star size={12} fill="#fbbf24" />
            <span>{product.rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Title */}
        <h4 style={{
          fontSize: '0.9375rem',
          fontWeight: 600,
          lineHeight: 1.35,
          height: '2.7em',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          color: 'var(--text-primary)'
        }}>
          {product.title}
        </h4>

        {/* Pricing Hierarchy */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
          <span style={{
            fontSize: '1.1875rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em'
          }}>
            ₹{product.sellingPrice.toLocaleString('en-IN')}
          </span>
          {product.originalPrice > product.sellingPrice && (
            <span style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              textDecoration: 'line-through'
            }}>
              ₹{product.originalPrice.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Add to Cart CTA */}
        <Button
          variant={isWatch ? "gold" : "primary"}
          size="sm"
          fullWidth
          icon={<ShoppingBag size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart && onAddToCart(product);
          }}
          style={{ marginTop: 8 }}
        >
          Add to Cart
        </Button>
      </div>
    </div>
  );
};
