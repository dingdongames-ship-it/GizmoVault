import React from 'react';
import { Search, ShoppingBag, Heart, ShieldCheck, User } from 'lucide-react';
import { Logo } from '../ui/Logo';

export interface HeaderProps {
  cartItemCount: number;
  wishlistCount: number;
  onOpenSearch?: () => void;
  onOpenCart?: () => void;
  onOpenProfile?: () => void;
  activeNav: string;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartItemCount,
  wishlistCount,
  onOpenSearch,
  onOpenCart,
  onOpenProfile,
  activeNav,
  onNavigate
}) => {
  return (
    <header className="top-header">
      <div className="header-inner">
        {/* Brand Logo */}
        <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('home')}>
          <Logo size="sm" showTagline={false} />
        </div>

        {/* Desktop Navigation Links */}
        <nav style={{ display: 'none', gap: '24px', alignItems: 'center' }} className="desktop-nav">
          <button 
            className={`btn btn-ghost ${activeNav === 'home' ? 'active' : ''}`}
            onClick={() => onNavigate('home')}
            style={{ color: activeNav === 'home' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
          >
            Explore
          </button>
          <button 
            className={`btn btn-ghost ${activeNav === 'gadgets' ? 'active' : ''}`}
            onClick={() => onNavigate('gadgets')}
            style={{ color: activeNav === 'gadgets' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
          >
            Electronic Gadgets
          </button>
          <button 
            className={`btn btn-ghost ${activeNav === 'watches' ? 'active' : ''}`}
            onClick={() => onNavigate('watches')}
            style={{ color: activeNav === 'watches' ? 'var(--accent-gold)' : 'var(--text-secondary)' }}
          >
            Imported Watches
          </button>
          <button 
            className={`btn btn-ghost ${activeNav === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
            style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}
          >
            <ShieldCheck size={16} /> Admin Portal
          </button>
        </nav>

        {/* Header Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search Trigger */}
          <button 
            onClick={onOpenSearch} 
            className="btn btn-ghost btn-icon"
            aria-label="Search catalog"
          >
            <Search size={20} />
          </button>

          {/* Wishlist */}
          <button 
            onClick={() => onNavigate('wishlist')} 
            className="btn btn-ghost btn-icon"
            style={{ position: 'relative' }}
            aria-label="Wishlist"
          >
            <Heart size={20} />
            {wishlistCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: 'var(--color-danger)',
                color: '#fff',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.625rem',
                fontWeight: 700,
                minWidth: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 2px'
              }}>
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Shopping Cart Button */}
          <button 
            onClick={onOpenCart} 
            className="btn btn-ghost btn-icon" 
            style={{ position: 'relative' }}
            aria-label="Shopping Cart"
          >
            <ShoppingBag size={20} />
            {cartItemCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
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
                padding: '0 2px',
                boxShadow: 'var(--cyan-glow)'
              }}>
                {cartItemCount}
              </span>
            )}
          </button>

          {/* User Profile */}
          <button 
            onClick={onOpenProfile} 
            className="btn btn-ghost btn-icon"
            aria-label="User Account"
          >
            <User size={20} />
          </button>
        </div>
      </div>
      <style>{`
        @media (min-width: 840px) {
          .desktop-nav {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
};
