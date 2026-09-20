import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  Tag, 
  ArrowRight, 
  ShieldCheck, 
  Bookmark, 
  RotateCcw, 
  AlertCircle,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/Feedback';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../ui/Toast';

export const CartView: React.FC = () => {
  const { 
    cart, 
    savedForLater,
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
    navigateTo 
  } = useApp();
  const { showToast } = useToast();

  const [couponInput, setCouponInput] = useState('');
  const [pincodeInput, setPincodeInput] = useState('560001');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponInput.trim()) {
      const ok = applyCoupon(couponInput.trim());
      if (ok) setCouponInput('');
    }
  };

  const handleProceedToCheckout = async () => {
    setIsValidating(true);
    setValidationErrors([]);
    try {
      const result = await revalidateCart(pincodeInput);
      if (result.canProceed) {
        showToast('Cart verified! Proceeding to secure checkout...', 'success');
        navigateTo('checkout');
      } else {
        setValidationErrors(result.errors);
        showToast('Please resolve the items in your cart before checkout', 'error');
      }
    } catch (err: any) {
      setValidationErrors([err.message || 'Validation failed']);
    } finally {
      setIsValidating(false);
    }
  };

  if (cart.length === 0 && savedForLater.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag size={36} />}
        title="Your shopping cart is empty"
        description="Your vault cart is waiting for precision chronographs, AMOLED smartwatches, and high-performance electronics."
        actionText="Explore Vault Collection"
        onAction={() => navigateTo('home')}
      />
    );
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>Shopping Cart</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {cart.length} active item{cart.length === 1 ? '' : 's'} in your vault cart
          </p>
        </div>
        {cart.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCart}>
            Clear Cart
          </Button>
        )}
      </div>

      {/* Pre-checkout Validation Errors Banner */}
      {validationErrors.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--color-danger)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)', fontWeight: 700, marginBottom: 6 }}>
            <AlertCircle size={18} />
            <span>Server Inventory & Checkout Validation</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 28,
        alignItems: 'start'
      }}>
        {/* Left Column: Active Cart Items + Saved for Later */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Active Items Section */}
          {cart.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cart.map((item) => {
                const isWatch = item.product.category.toLowerCase().includes('watch');
                const isStockCapped = item.quantity >= item.product.stockQuantity;

                return (
                  <Card key={item.product.id} style={{ display: 'flex', gap: 16, padding: 16 }}>
                    <img
                      src={item.product.primaryImage}
                      alt={item.product.title}
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: 'var(--radius-md)',
                        objectFit: 'cover',
                        border: '1px solid var(--border-subtle)',
                        background: '#0a0e17'
                      }}
                    />

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span className={`badge ${isWatch ? 'badge-gold' : 'badge-cyan'}`} style={{ fontSize: '0.6875rem', padding: '2px 6px' }}>
                            {item.product.category}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.product.brand}</span>
                        </div>

                        <h4 style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>
                          {item.product.title}
                        </h4>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            ₹{item.product.sellingPrice.toLocaleString('en-IN')}
                          </span>
                          {item.product.originalPrice > item.product.sellingPrice && (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              ₹{item.product.originalPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                          <span className="badge badge-discount" style={{ fontSize: '0.6875rem' }}>
                            -{Math.round(item.product.discountPercent)}%
                          </span>
                        </div>
                      </div>

                      {/* Controls: Quantity Stepper, Save for Later, and Remove */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
                        {/* Stepper */}
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            style={{ padding: '4px 10px', fontWeight: 700 }}
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, minWidth: 24, textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            disabled={isStockCapped}
                            style={{ padding: '4px 10px', fontWeight: 700 }}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button 
                            onClick={() => saveForLater(item.product.id)}
                            className="btn btn-ghost btn-sm" 
                            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Save for Later"
                          >
                            <Bookmark size={14} />
                            <span>Save for Later</span>
                          </button>

                          <button 
                            onClick={() => removeFromCart(item.product.id)} 
                            className="btn btn-ghost btn-sm" 
                            style={{ color: 'var(--color-danger)', padding: '6px' }}
                            aria-label="Remove item"
                            title="Remove from Cart"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No active items in cart.</p>
            </Card>
          )}

          {/* Saved for Later Section */}
          {savedForLater.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bookmark size={16} color="var(--accent-gold)" />
                <span>Saved for Later ({savedForLater.length})</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {savedForLater.map((item) => (
                  <Card key={item.product.id} style={{ display: 'flex', gap: 14, padding: 14, opacity: 0.9 }}>
                    <img
                      src={item.product.primaryImage}
                      alt={item.product.title}
                      style={{ width: 70, height: 70, borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.product.brand}</div>
                        <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 2 }}>{item.product.title}</h4>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          ₹{item.product.sellingPrice.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          icon={<RotateCcw size={14} />}
                          onClick={() => moveToCart(item.product.id)}
                        >
                          Move to Cart
                        </Button>
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="btn btn-ghost btn-sm" 
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Order Summary, Coupon & Checkout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Promo Coupon Application Box */}
          <Card>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag size={16} color="var(--accent-cyan)" /> Apply Promo Coupon
            </h4>

            {appliedCoupon ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--color-success-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} color="var(--color-success)" />
                    <span style={{ fontWeight: 800, color: 'var(--color-success)', fontSize: '0.875rem' }}>
                      {appliedCoupon} APPLIED
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    ₹{cartDiscount.toLocaleString('en-IN')} instant discount applied to order
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={removeCoupon}>
                  Remove
                </Button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="e.g. GIZMO10, GIZMO500, WATCH50"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="form-input"
                  style={{ 
                    textTransform: 'uppercase',
                    flex: 1,
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem'
                  }}
                />
                <Button variant="secondary" type="submit">
                  Apply
                </Button>
              </form>
            )}

            {/* Quick coupon tags */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
              Available coupons: <strong>GIZMO10</strong> (10% off), <strong>GIZMO500</strong> (₹500 off on ₹3,000+), <strong>WATCH50</strong> (20% off on ₹20,000+).
            </div>
          </Card>

          {/* Pricing Calculation Summary (Server Validated Truth) */}
          <Card>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 16 }}>Order Summary</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.875rem', marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Items Subtotal</span>
                <span style={{ fontWeight: 600 }}>₹{cartSubtotal.toLocaleString('en-IN')}</span>
              </div>

              {cartDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                  <span>Promotional Coupon Discount</span>
                  <span style={{ fontWeight: 700 }}>-₹{cartDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Truck size={14} /> Express Doorstep Shipping
                </span>
                {cartShippingFee === 0 ? (
                  <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>FREE</span>
                ) : (
                  <span style={{ fontWeight: 600 }}>₹{cartShippingFee}</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>GST & Doorstep Insurance</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Inclusive</span>
              </div>

              <div style={{
                height: 1,
                background: 'var(--border-subtle)',
                margin: '4px 0'
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800 }}>
                <span>Grand Total</span>
                <span style={{ color: 'var(--accent-cyan)' }}>₹{cartTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <Button 
              variant="primary" 
              size="lg" 
              fullWidth 
              icon={<ArrowRight size={18} />}
              onClick={handleProceedToCheckout}
              disabled={cart.length === 0 || isValidating}
            >
              {isValidating ? 'Verifying Stock & Prices...' : 'Proceed to Checkout'}
            </Button>

            {/* PCI-DSS & Google Play Billing Exemption Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={16} color="var(--color-success)" />
              <span>PCI-DSS Certified 256-Bit SSL Encrypted Checkout</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
