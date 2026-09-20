import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  MapPin,
  Truck,
  Tag,
  CreditCard,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Plus,
  Smartphone,
  Building2,
  Wallet,
  Banknote,
  ShieldCheck,
  ChevronRight,
  PackageCheck,
  Globe,
  Star,
  Zap,
  Clock
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { useApp } from '../../../context/AppContext';

/* ─────────────────────────────────────── TYPES ──── */
interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  isAvailable: boolean;
  unavailableReason?: string;
}

/* ─────────────────────────────────────── STEP INDICATOR ──── */
const STEPS = [
  { id: 1, label: 'Cart Review', icon: ShoppingCart },
  { id: 2, label: 'Address', icon: MapPin },
  { id: 3, label: 'Shipping', icon: Truck },
  { id: 4, label: 'Coupon', icon: Tag },
  { id: 5, label: 'Payment', icon: CreditCard },
  { id: 6, label: 'Confirm', icon: CheckCircle2 },
];

const StepIndicator: React.FC<{ currentStep: number; maxReached: number }> = ({
  currentStep,
  maxReached
}) => (
  <div id="checkout-step-indicator" style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
    {STEPS.map((step, idx) => {
      const Icon = step.icon;
      const isActive = step.id === currentStep;
      const isDone = step.id < currentStep;
      const isReachable = step.id <= maxReached;
      return (
        <React.Fragment key={step.id}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isDone
                ? 'var(--color-success)'
                : isActive
                  ? 'var(--accent-cyan)'
                  : isReachable
                    ? 'var(--bg-surface-elevated)'
                    : 'var(--bg-surface)',
              border: isActive ? '2px solid var(--accent-cyan)' : isDone ? '2px solid var(--color-success)' : '2px solid var(--border-subtle)',
              boxShadow: isActive ? '0 0 12px rgba(0,229,255,0.4)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              {isDone
                ? <CheckCircle2 size={18} color="#fff" />
                : <Icon size={16} color={isActive ? '#0a0e1a' : isReachable ? 'var(--text-secondary)' : 'var(--text-muted)'} />}
            </div>
            <span style={{
              fontSize: '0.625rem',
              fontWeight: isActive ? 700 : 400,
              color: isActive ? 'var(--accent-cyan)' : isDone ? 'var(--color-success)' : 'var(--text-muted)',
              whiteSpace: 'nowrap'
            }}>
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div style={{
              flex: 1,
              height: 2,
              background: isDone ? 'var(--color-success)' : 'var(--border-subtle)',
              minWidth: 16,
              transition: 'background 0.3s ease'
            }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

/* ─────────────────────────────────────── PAYMENT ICON MAP ──── */
const PaymentIcon: React.FC<{ iconName: string }> = ({ iconName }) => {
  const icons: Record<string, React.ReactNode> = {
    Smartphone: <Smartphone size={22} />,
    CreditCard: <CreditCard size={22} />,
    Building2: <Building2 size={22} />,
    Wallet: <Wallet size={22} />,
    Banknote: <Banknote size={22} />,
    Globe: <Globe size={22} />,
  };
  return <span style={{ color: 'var(--accent-cyan)' }}>{icons[iconName] || <CreditCard size={22} />}</span>;
};

/* ═══════════════════════════════════════════════════════════════
   MAIN CHECKOUT VIEW — 6 STEP WIZARD
   ═══════════════════════════════════════════════════════════════ */
export const CheckoutView: React.FC = () => {
  const {
    cart,
    cartSubtotal,
    cartDiscount,
    cartTotal,
    addresses,
    addAddress,
    placeOrder,
    navigateTo,
    couponCode: appliedCoupon,
    showToast
  } = useApp() as any;

  const [currentStep, setCurrentStep] = useState(1);
  const [maxReachedStep, setMaxReachedStep] = useState(1);

  /* Step 2 – Address */
  const [selectedAddressId, setSelectedAddressId] = useState(
    (addresses?.find?.((a: any) => a.isDefault) || addresses?.[0])?.id || ''
  );
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLine1, setNewLine1] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newPin, setNewPin] = useState('');

  /* Step 3 – Shipping */
  const [shippingMethod, setShippingMethod] = useState<'STANDARD' | 'EXPRESS'>('STANDARD');
  const freeThreshold = 999;
  const shippingFeeStandard = cartSubtotal >= freeThreshold ? 0 : 99;
  const shippingFeeExpress = 199;
  const shippingFee = shippingMethod === 'EXPRESS' ? shippingFeeExpress : shippingFeeStandard;

  /* Step 4 – Coupon */
  const [couponInput, setCouponInput] = useState('');
  const [localCoupon, setLocalCoupon] = useState<{ code: string; discount: number } | null>(
    appliedCoupon ? { code: appliedCoupon, discount: cartDiscount } : null
  );
  const [couponError, setCouponError] = useState('');

  /* Step 5 – Payment */
  const [selectedPaymentId, setSelectedPaymentId] = useState('upi');
  const paymentMethods: PaymentMethod[] = [
    { id: 'upi', name: 'UPI (Google Pay, PhonePe, Paytm, BHIM)', description: 'Instant, direct 0-fee payment via any UPI application or UPI ID', category: 'upi', icon: 'Smartphone', isAvailable: true },
    { id: 'cards', name: 'Credit / Debit Card (Visa, Mastercard, RuPay)', description: 'Safe & secure PCI-DSS 256-bit tokenized card payment', category: 'card', icon: 'CreditCard', isAvailable: true },
    { id: 'netbanking', name: 'Net Banking', description: 'Direct payment from HDFC, SBI, ICICI, Axis, Kotak and 50+ major Indian banks', category: 'netbanking', icon: 'Building2', isAvailable: true },
    { id: 'wallets', name: 'Mobile Wallets (Paytm, Mobikwik, Amazon Pay)', description: 'Quick checkout using balance in leading Indian mobile wallets', category: 'wallet', icon: 'Wallet', isAvailable: true },
    { id: 'cod', name: 'Cash on Delivery (Doorstep Payment)', description: cartTotal + shippingFee <= 10000 ? 'Pay with cash or UPI QR at doorstep upon verified package inspection' : 'COD not available for orders above ₹10,000', category: 'cod', icon: 'Banknote', isAvailable: cartTotal + shippingFee <= 10000, unavailableReason: cartTotal + shippingFee > 10000 ? 'COD limit exceeded' : undefined },
  ];

  /* Step 6 – Processing */
  const [isProcessing, setIsProcessing] = useState(false);

  /* ── Navigation Guards ── */
  const goToStep = (step: number) => {
    if (step < 1 || step > 6) return;
    if (step === 2 && currentStep === 1) {
      // Cart must have items – validated
    }
    setCurrentStep(step);
    if (step > maxReachedStep) setMaxReachedStep(step);
  };

  const handleNext = () => goToStep(currentStep + 1);
  const handleBack = () => goToStep(currentStep - 1);

  /* ── Address handlers ── */
  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName || !newPhone || !newLine1 || !newCity || !newPin) return;
    const newAddr = addAddress({
      fullName: newFullName, phone: newPhone,
      addressLine1: newLine1, city: newCity,
      state: newState || 'Delhi', postalCode: newPin,
      country: 'IN', isDefault: addresses.length === 0
    });
    setSelectedAddressId(newAddr?.id || addresses[addresses.length - 1]?.id || '');
    setIsAddressModalOpen(false);
    setNewFullName(''); setNewPhone(''); setNewLine1('');
    setNewCity(''); setNewState(''); setNewPin('');
  };

  /* ── Coupon Apply ── */
  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponError('Please enter a coupon code.'); return; }
    // Client-side optimistic coupon (real validation via server on checkout summary)
    const DEMO_COUPONS: Record<string, number> = {
      'GADGET10': 0.10,
      'WELCOME20': 0.20,
      'FLAT150': 150,
    };
    if (DEMO_COUPONS[code]) {
      const disc = typeof DEMO_COUPONS[code] === 'number' && DEMO_COUPONS[code] < 1
        ? Math.round(cartSubtotal * DEMO_COUPONS[code])
        : DEMO_COUPONS[code] as number;
      setLocalCoupon({ code, discount: disc });
      setCouponError('');
      showToast?.(`Coupon ${code} applied! You save ₹${disc}`, 'success');
    } else {
      setCouponError('Invalid or expired coupon code. Try GADGET10, WELCOME20, or FLAT150.');
    }
  };

  const handleRemoveCoupon = () => {
    setLocalCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  /* ── Grand total calc ── */
  const couponDiscount = localCoupon?.discount || 0;
  const grandTotal = Math.max(0, cartSubtotal - couponDiscount + shippingFee);

  /* ── Place Order ── */
  const handlePlaceOrder = () => {
    if (!selectedAddressId) {
      showToast?.('Please select a delivery address.', 'error');
      setCurrentStep(2);
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      placeOrder?.(selectedPaymentId, selectedAddressId);
      showToast?.('🎉 Order placed successfully! You will receive a confirmation shortly.', 'success');
    }, 1600);
  };

  /* ── Guard: empty cart ── */
  if (!cart || cart.length === 0) {
    navigateTo?.('cart');
    return null;
  }

  const selectedAddress = addresses?.find?.((a: any) => a.id === selectedAddressId);

  /* ════════════════ RENDER ════════════════ */
  return (
    <div id="checkout-wizard" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />}
          onClick={() => currentStep === 1 ? navigateTo?.('cart') : handleBack()}>
          {currentStep === 1 ? 'Back to Cart' : 'Previous'}
        </Button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <span style={{ color: 'var(--accent-cyan)' }}>Secure</span> Checkout
        </h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <ShieldCheck size={14} color="var(--color-success)" />
          PCI-DSS Encrypted
        </div>
      </div>

      {/* Step Progress Bar */}
      <StepIndicator currentStep={currentStep} maxReached={maxReachedStep} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr min(360px, 38%)', gap: 24, alignItems: 'start' }}>
        {/* ═══ LEFT PANEL – ACTIVE STEP ═══ */}
        <div>
          {/* ─ STEP 1: CART REVIEW ─ */}
          {currentStep === 1 && (
            <Card id="step1-cart-review">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <ShoppingCart size={20} color="var(--accent-cyan)" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Step 1 — Cart Review</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cart.map((item: any) => (
                  <div key={item.product.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 14px', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0,
                      background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {item.product.images?.[0]
                        ? <img src={item.product.images[0]} alt={item.product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <ShoppingCart size={20} color="var(--text-muted)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.product.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Qty: {item.quantity} × ₹{item.product.sellingPrice?.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--accent-cyan)', flexShrink: 0 }}>
                      ₹{(item.product.sellingPrice * item.quantity).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <Button id="step1-next-btn" variant="primary" icon={<ArrowRight size={16} />} onClick={handleNext}>
                  Confirm Cart & Continue
                </Button>
              </div>
            </Card>
          )}

          {/* ─ STEP 2: DELIVERY ADDRESS ─ */}
          {currentStep === 2 && (
            <Card id="step2-delivery-address">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={20} color="var(--accent-cyan)" />
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Step 2 — Delivery Address</h2>
                </div>
                <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setIsAddressModalOpen(true)}>
                  Add New
                </Button>
              </div>
              {addresses && addresses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {addresses.map((addr: any) => (
                    <label key={addr.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      border: selectedAddressId === addr.id ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      background: selectedAddressId === addr.id ? 'rgba(0,229,255,0.05)' : 'var(--bg-surface-elevated)',
                      transition: 'all 0.2s ease'
                    }}>
                      <input type="radio" name="deliveryAddress" value={addr.id}
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        style={{ marginTop: 3, accentColor: 'var(--accent-cyan)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{addr.fullName}</span>
                          {addr.isDefault && (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 700, padding: '2px 6px',
                              background: 'var(--accent-gold)', color: '#000',
                              borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5
                            }}>Default</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}, {addr.city}, {addr.state} — {addr.postalCode}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>📱 {addr.phone}</div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <MapPin size={40} color="var(--border-subtle)" style={{ marginBottom: 12 }} />
                  <p>No addresses saved. Add one to continue.</p>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <Button id="step2-next-btn" variant="primary" icon={<ArrowRight size={16} />}
                  onClick={handleNext} disabled={!selectedAddressId}>
                  Confirm Address & Continue
                </Button>
              </div>
            </Card>
          )}

          {/* ─ STEP 3: SHIPPING METHOD ─ */}
          {currentStep === 3 && (
            <Card id="step3-shipping-method">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <Truck size={20} color="var(--accent-gold)" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Step 3 — Shipping Method</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Standard */}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  border: shippingMethod === 'STANDARD' ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  background: shippingMethod === 'STANDARD' ? 'rgba(0,229,255,0.05)' : 'var(--bg-surface-elevated)',
                }}>
                  <input type="radio" name="shippingMethod" checked={shippingMethod === 'STANDARD'}
                    onChange={() => setShippingMethod('STANDARD')}
                    style={{ accentColor: 'var(--accent-cyan)' }} />
                  <Clock size={20} color="var(--text-secondary)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>Standard Delivery</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      3–5 business days via Delhivery / DTDC
                      {cartSubtotal >= freeThreshold && <span style={{ color: 'var(--color-success)', marginLeft: 8 }}>✓ Free delivery unlocked!</span>}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: shippingFeeStandard === 0 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                    {shippingFeeStandard === 0 ? 'FREE' : `₹${shippingFeeStandard}`}
                  </div>
                </label>

                {/* Express */}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  border: shippingMethod === 'EXPRESS' ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                  background: shippingMethod === 'EXPRESS' ? 'rgba(255,214,0,0.04)' : 'var(--bg-surface-elevated)',
                }}>
                  <input type="radio" name="shippingMethod" checked={shippingMethod === 'EXPRESS'}
                    onChange={() => setShippingMethod('EXPRESS')}
                    style={{ accentColor: 'var(--accent-gold)' }} />
                  <Zap size={20} color="var(--accent-gold)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>
                      Express Delivery
                      <span style={{ marginLeft: 8, fontSize: '0.6875rem', background: 'var(--accent-gold)', color: '#000', padding: '2px 6px', borderRadius: 4, fontWeight: 800, textTransform: 'uppercase' }}>Fast</span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>1–2 business days via BlueDart Priority Air</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-gold)' }}>₹{shippingFeeExpress}</div>
                </label>
              </div>
              {cartSubtotal < freeThreshold && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.1)',
                  fontSize: '0.8125rem', color: 'var(--text-secondary)'
                }}>
                  💡 Add ₹{(freeThreshold - cartSubtotal).toLocaleString('en-IN')} more to unlock <strong>FREE Standard Delivery</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <Button id="step3-next-btn" variant="primary" icon={<ArrowRight size={16} />} onClick={handleNext}>
                  Confirm Shipping & Continue
                </Button>
              </div>
            </Card>
          )}

          {/* ─ STEP 4: COUPON ─ */}
          {currentStep === 4 && (
            <Card id="step4-coupon">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <Tag size={20} color="var(--color-success)" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Step 4 — Apply Coupon</h2>
              </div>
              {localCoupon ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 18px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(0,200,100,0.08)', border: '1px solid var(--color-success)'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '1rem' }}>
                      ✓ {localCoupon.code} Applied
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      You save ₹{localCoupon.discount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleRemoveCoupon}>Remove</Button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Input
                      id="coupon-code-input"
                      label=""
                      placeholder="Enter coupon code (e.g. GADGET10)"
                      value={couponInput}
                      onChange={(e: any) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={(e: any) => e.key === 'Enter' && handleApplyCoupon()}
                      style={{ flex: 1 }}
                    />
                    <div style={{ paddingTop: 0, display: 'flex', alignItems: 'flex-end' }}>
                      <Button id="apply-coupon-btn" variant="primary" onClick={handleApplyCoupon}>Apply</Button>
                    </div>
                  </div>
                  {couponError && <p style={{ color: 'var(--color-error)', fontSize: '0.8125rem', marginTop: 6 }}>{couponError}</p>}
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Available Coupons</p>
                    {[
                      { code: 'GADGET10', desc: '10% off on all gadgets' },
                      { code: 'WELCOME20', desc: '20% off on your first order' },
                      { code: 'FLAT150', desc: 'Flat ₹150 off on all orders' },
                    ].map(c => (
                      <div key={c.code} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface-elevated)', border: '1px dashed var(--border-subtle)'
                      }}>
                        <div>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-cyan)', fontSize: '0.875rem' }}>{c.code}</span>
                          <span style={{ marginLeft: 8, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{c.desc}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setCouponInput(c.code); }}>Use</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <Button id="step4-next-btn" variant="primary" icon={<ArrowRight size={16} />} onClick={handleNext}>
                  {localCoupon ? 'Continue with Coupon' : 'Skip & Continue'}
                </Button>
              </div>
            </Card>
          )}

          {/* ─ STEP 5: PAYMENT METHOD ─ */}
          {currentStep === 5 && (
            <Card id="step5-payment-method">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <CreditCard size={20} color="var(--accent-cyan)" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Step 5 — Payment Method</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {paymentMethods.map(method => (
                  <label key={method.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    cursor: method.isAvailable ? 'pointer' : 'not-allowed',
                    opacity: method.isAvailable ? 1 : 0.5,
                    border: selectedPaymentId === method.id ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    background: selectedPaymentId === method.id ? 'rgba(0,229,255,0.05)' : 'var(--bg-surface-elevated)',
                    transition: 'all 0.2s ease'
                  }}>
                    <input type="radio" name="paymentMethod" value={method.id}
                      checked={selectedPaymentId === method.id}
                      disabled={!method.isAvailable}
                      onChange={() => method.isAvailable && setSelectedPaymentId(method.id)}
                      style={{ accentColor: 'var(--accent-cyan)' }} />
                    <PaymentIcon iconName={method.icon} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{method.name}</div>
                      <div style={{ fontSize: '0.75rem', color: method.isAvailable ? 'var(--text-muted)' : 'var(--color-error)', marginTop: 2 }}>
                        {method.unavailableReason || method.description}
                      </div>
                    </div>
                    {method.id === 'upi' && <Star size={14} fill="var(--accent-gold)" color="var(--accent-gold)" />}
                  </label>
                ))}
              </div>
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)',
                fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <ShieldCheck size={14} color="var(--color-success)" />
                Google Play physical goods policy compliant. No raw card data retained. PCI-DSS Level 1 tokenization.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <Button id="step5-next-btn" variant="primary" icon={<ArrowRight size={16} />} onClick={handleNext}>
                  Continue to Order Review
                </Button>
              </div>
            </Card>
          )}

          {/* ─ STEP 6: ORDER CONFIRMATION ─ */}
          {currentStep === 6 && (
            <Card id="step6-order-confirmation">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <PackageCheck size={20} color="var(--accent-gold)" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Step 6 — Order Confirmation</h2>
              </div>
              {/* Summary sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Delivery */}
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Delivering To</div>
                  {selectedAddress ? (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <strong>{selectedAddress.fullName}</strong> · {selectedAddress.addressLine1}, {selectedAddress.city} {selectedAddress.postalCode} · {selectedAddress.phone}
                    </div>
                  ) : <span style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>No address selected!</span>}
                </div>

                {/* Shipping & Payment */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Shipping</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{shippingMethod === 'EXPRESS' ? '⚡ Express Delivery' : '📦 Standard Delivery'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{shippingMethod === 'EXPRESS' ? '1-2 days' : '3-5 days'} · {shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}</div>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Payment</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {paymentMethods.find(m => m.id === selectedPaymentId)?.name?.split('(')[0].trim()}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Items ({cart.length})</div>
                  {cart.map((item: any) => (
                    <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-secondary)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.quantity}× {item.product.title}
                      </span>
                      <span style={{ fontWeight: 600 }}>₹{(item.product.sellingPrice * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Place Order CTA */}
              <div style={{ marginTop: 20 }}>
                <Button
                  id="place-order-btn"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isProcessing}
                  onClick={handlePlaceOrder}
                >
                  {isProcessing
                    ? 'Processing Secure Payment...'
                    : `Place Order & Pay ₹${grandTotal.toLocaleString('en-IN')}`}
                </Button>
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
                  By placing this order, you agree to our Terms & Conditions and Refund Policy.
                  Payment is securely processed via Razorpay (PCI-DSS Level 1).
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* ═══ RIGHT PANEL – ORDER SUMMARY ═══ */}
        <div style={{ position: 'sticky', top: 80 }}>
          <Card id="checkout-order-summary" style={{ background: 'var(--bg-surface-elevated)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>Order Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.875rem', marginBottom: 14, maxHeight: 180, overflowY: 'auto' }}>
              {cart.map((item: any) => (
                <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.quantity}× {item.product.title}
                  </span>
                  <span>₹{(item.product.sellingPrice * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 10 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span>₹{cartSubtotal.toLocaleString('en-IN')}</span>
              </div>
              {couponDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                  <span>Coupon ({localCoupon?.code})</span>
                  <span>−₹{couponDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Shipping</span>
                <span style={{ color: shippingFee === 0 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                  {shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}
                </span>
              </div>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.0625rem' }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-cyan)' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Step-by-step CTA hint */}
            {currentStep < 6 && (
              <div style={{ marginTop: 14 }}>
                <Button variant="primary" size="sm" fullWidth onClick={handleNext}>
                  {currentStep === 5 ? 'Review & Confirm' : `Step ${currentStep + 1}: ${STEPS[currentStep]?.label}`}
                  <ChevronRight size={14} style={{ marginLeft: 4 }} />
                </Button>
              </div>
            )}

            {/* Trust signals */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {[
                ['🔒', 'PCI-DSS 256-bit Encrypted'],
                ['🛡️', 'Google Play Policy Compliant'],
                ['↩️', '7-Day Easy Returns'],
                ['📦', 'Real Courier Tracking'],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Add New Address Modal ── */}
      <Modal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} title="Add Delivery Address">
        <form onSubmit={handleSaveAddress}>
          <Input label="Recipient Full Name" placeholder="e.g. Aarav Sharma" value={newFullName} onChange={(e: any) => setNewFullName(e.target.value)} required />
          <Input label="Phone Number" placeholder="+91 98765 43210" value={newPhone} onChange={(e: any) => setNewPhone(e.target.value)} required />
          <Input label="Address Line 1" placeholder="Flat, House no., Building, Street" value={newLine1} onChange={(e: any) => setNewLine1(e.target.value)} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="City" placeholder="e.g. New Delhi" value={newCity} onChange={(e: any) => setNewCity(e.target.value)} required />
            <Input label="PIN Code" placeholder="e.g. 110001" value={newPin} onChange={(e: any) => setNewPin(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <Button variant="ghost" type="button" onClick={() => setIsAddressModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Save Address</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
