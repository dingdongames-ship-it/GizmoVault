import React from 'react';
import { Heart } from 'lucide-react';
import { ProductCard } from '../../ui/ProductCard';
import { EmptyState } from '../../ui/Feedback';
import { useApp } from '../../../context/AppContext';

export const WishlistView: React.FC = () => {
  const { 
    products, 
    wishlist, 
    addToCart, 
    toggleWishlist, 
    openProductDetails, 
    navigateTo 
  } = useApp();

  const wishlistedProducts = products.filter(p => wishlist.includes(p.id));

  if (wishlistedProducts.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={36} color="var(--color-danger)" />}
        title="Your Wishlist is Empty"
        description="Save your favorite imported timepieces and electronic hardware to track price drops and availability."
        actionText="Explore Vault Collection"
        onAction={() => navigateTo('home')}
      />
    );
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Saved Wishlist</h1>
        <p style={{ fontSize: '0.875rem' }}>{wishlistedProducts.length} items saved for later</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16
      }}>
        {wishlistedProducts.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onAddToCart={addToCart}
            onToggleWishlist={toggleWishlist}
            isWishlisted={true}
            onClick={openProductDetails}
          />
        ))}
      </div>
    </div>
  );
};
