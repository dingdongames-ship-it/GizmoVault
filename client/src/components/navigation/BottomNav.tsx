import React from 'react';
import { Home, Layers, Search, ShoppingBag, User } from 'lucide-react';

export interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  cartCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  cartCount
}) => {
  return (
    <nav className="bottom-nav">
      <button 
        className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onTabChange('home')}
        aria-label="Home"
      >
        <Home size={22} />
        <span>Home</span>
      </button>

      <button 
        className={`bottom-nav-item ${activeTab === 'categories' ? 'active' : ''}`}
        onClick={() => onTabChange('categories')}
        aria-label="Categories"
      >
        <Layers size={22} />
        <span>Catalog</span>
      </button>

      <button 
        className={`bottom-nav-item ${activeTab === 'search' ? 'active' : ''}`}
        onClick={() => onTabChange('search')}
        aria-label="Search"
      >
        <Search size={22} />
        <span>Search</span>
      </button>

      <button 
        className={`bottom-nav-item ${activeTab === 'cart' ? 'active' : ''}`}
        onClick={() => onTabChange('cart')}
        style={{ position: 'relative' }}
        aria-label="Cart"
      >
        <div style={{ position: 'relative' }}>
          <ShoppingBag size={22} />
          {cartCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -8,
              background: 'var(--accent-cyan)',
              color: '#041017',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.625rem',
              fontWeight: 800,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 2px'
            }}>
              {cartCount}
            </span>
          )}
        </div>
        <span>Cart</span>
      </button>

      <button 
        className={`bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onTabChange('profile')}
        aria-label="Profile"
      >
        <User size={22} />
        <span>Account</span>
      </button>
    </nav>
  );
};
