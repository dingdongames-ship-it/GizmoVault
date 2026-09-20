import React, { useState } from 'react';
import { Header } from './components/navigation/Header';
import { BottomNav } from './components/navigation/BottomNav';
import { HomeView } from './components/views/customer/HomeView';
import { CategoriesView } from './components/views/customer/CategoriesView';
import { SearchResultsView } from './components/views/customer/SearchResultsView';
import { ProductDetailsView } from './components/views/customer/ProductDetailsView';
import { CartView } from './components/views/customer/CartView';
import { CheckoutView } from './components/views/customer/CheckoutView';
import { OrdersView } from './components/views/customer/OrdersView';
import { WishlistView } from './components/views/customer/WishlistView';
import { ProfileView } from './components/views/customer/ProfileView';
import { AddressesView } from './components/views/customer/AddressesView';
import { PolicyViews } from './components/views/customer/PolicyViews';
import { AdminPortalView } from './components/views/admin/AdminPortalView';
import { SplashScreen } from './components/views/customer/SplashScreen';
import { AuthModal } from './components/views/customer/AuthModal';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';

const MainAppContent: React.FC = () => {
  const { 
    currentView, 
    navigateTo, 
    cart, 
    wishlist 
  } = useApp();

  const { isAuthenticated } = useAuth();
  const [showSplash, setShowSplash] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="app-container">
      {/* Optional Splash Screen triggerable for testing */}
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}

      {/* Auth Modal (Login / Register / OTP) */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* Top App Header (Hidden in Admin Portal for focused dashboard UI) */}
      {!currentView.startsWith('admin') && (
        <Header
          cartItemCount={cart.reduce((s, i) => s + i.quantity, 0)}
          wishlistCount={wishlist.length}
          activeNav={currentView}
          onNavigate={(view) => {
            if (view === 'gadgets') {
              navigateTo('search');
            } else if (view === 'watches') {
              navigateTo('search');
            } else if (view === 'admin') {
              navigateTo('admin-dashboard');
            } else {
              navigateTo(view as any);
            }
          }}
          onOpenCart={() => navigateTo('cart')}
          onOpenSearch={() => navigateTo('search')}
          onOpenProfile={() => {
            if (isAuthenticated) {
              navigateTo('profile');
            } else {
              setIsAuthOpen(true);
            }
          }}
        />
      )}

      {/* Main Viewport */}
      <main style={{
        maxWidth: 'var(--max-content-width)',
        margin: '0 auto',
        padding: currentView.startsWith('admin') ? '16px' : '20px 16px',
        width: '100%',
        flex: 1
      }}>
        {/* Dynamic View Router */}
        {currentView === 'home' && <HomeView />}
        {currentView === 'categories' && <CategoriesView />}
        {currentView === 'search' && <SearchResultsView />}
        {currentView === 'product-details' && <ProductDetailsView />}
        {currentView === 'cart' && <CartView />}
        {currentView === 'checkout' && <CheckoutView />}
        {(currentView === 'orders' || currentView === 'order-details' || currentView === 'order-tracking') && <OrdersView />}
        {currentView === 'wishlist' && <WishlistView />}
        {currentView === 'profile' && <ProfileView />}
        {currentView === 'addresses' && <AddressesView />}

        {/* Legal & Policy Pages */}
        {currentView === 'privacy' && <PolicyViews type="privacy" />}
        {currentView === 'terms' && <PolicyViews type="terms" />}
        {currentView === 'refund-policy' && <PolicyViews type="refund-policy" />}
        {currentView === 'help' && <PolicyViews type="help" />}

        {/* Admin Portal */}
        {currentView.startsWith('admin') && <AdminPortalView />}
      </main>

      {/* Mobile Bottom Navigation (Visible on Customer App screens) */}
      {!currentView.startsWith('admin') && (
        <BottomNav
          activeTab={currentView}
          onTabChange={(tab) => {
            if (tab === 'home') navigateTo('home');
            else if (tab === 'categories') navigateTo('categories');
            else if (tab === 'search') navigateTo('search');
            else if (tab === 'cart') navigateTo('cart');
            else if (tab === 'profile') navigateTo('profile');
          }}
          cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppProvider>
        <MainAppContent />
      </AppProvider>
    </AuthProvider>
  );
};

export default App;
