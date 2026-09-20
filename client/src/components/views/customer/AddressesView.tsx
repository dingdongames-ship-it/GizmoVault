import React, { useState } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  Truck, 
  Globe, 
  ShieldCheck 
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../ui/Toast';
import { Address } from '../../../types';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Chandigarh'
];

const COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'SG', name: 'Singapore' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'AU', name: 'Australia' }
];

export const AddressesView: React.FC = () => {
  const { addresses, addAddress, setDefaultAddress, navigateTo } = useApp();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Karnataka');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('IN');
  const [isDefault, setIsDefault] = useState(false);

  // Shipping calculator preview state
  const [calcPincode, setCalcPincode] = useState('560001');
  const [shippingPreview, setShippingPreview] = useState<string | null>('Fast Doorstep Delivery: FREE (2-4 business days)');

  const handleOpenAddModal = () => {
    setEditingAddressId(null);
    setFullName('');
    setPhone('');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setState('Karnataka');
    setPostalCode('');
    setCountry('IN');
    setIsDefault(addresses.length === 0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (addr: Address) => {
    setEditingAddressId(addr.id);
    setFullName(addr.fullName);
    setPhone(addr.phone);
    setAddressLine1(addr.addressLine1);
    setAddressLine2(addr.addressLine2 || '');
    setCity(addr.city);
    setState(addr.state);
    setPostalCode(addr.postalCode);
    setCountry(addr.country);
    setIsDefault(addr.isDefault);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || fullName.length < 2) {
      showToast('Please enter full name', 'error');
      return;
    }

    if (country === 'IN') {
      const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
      if (!/^(?:91)?[6-9]\d{9}$/.test(cleanPhone)) {
        showToast('Please enter a valid 10-digit Indian mobile number', 'error');
        return;
      }
      if (!/^\d{6}$/.test(postalCode.trim())) {
        showToast('Please enter a valid 6-digit PIN code', 'error');
        return;
      }
    } else {
      if (phone.length < 7) {
        showToast('Please enter a valid contact phone number', 'error');
        return;
      }
      if (postalCode.length < 3) {
        showToast('Please enter a valid postal code', 'error');
        return;
      }
    }

    addAddress({
      fullName: fullName.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      country,
      isDefault
    });

    setIsModalOpen(false);
    showToast(editingAddressId ? 'Address updated successfully' : 'New address added to vault address book', 'success');
  };

  const handleTestShipping = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(calcPincode.trim())) {
      setShippingPreview(`PIN ${calcPincode.trim()}: Doorstep Delivery FREE on orders > ₹999 (2-4 business days). Priority Air ₹199 (1-2 business days).`);
    } else {
      showToast('Please enter a valid 6-digit PIN code', 'warning');
    }
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Top Navigation & Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('profile')}>
          Back to Profile
        </Button>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={handleOpenAddModal}>
          Add New Address
        </Button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>Saved Delivery Addresses</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Manage your domestic and international shipping addresses for expedited 1-click checkout.
        </p>
      </div>

      {/* Address Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20,
        marginBottom: 32
      }}>
        {addresses.map((addr) => (
          <Card 
            key={addr.id}
            style={{
              position: 'relative',
              padding: 20,
              border: addr.isDefault ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)'
            }}
          >
            {addr.isDefault && (
              <span 
                className="badge badge-cyan" 
                style={{ position: 'absolute', top: 16, right: 16, fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <CheckCircle size={12} /> DEFAULT ADDRESS
              </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <MapPin size={18} color="var(--accent-gold)" />
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0 }}>{addr.fullName}</h3>
            </div>

            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              {addr.phone}
            </div>

            <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 16 }}>
              {addr.addressLine1}
              {addr.addressLine2 && `, ${addr.addressLine2}`}<br />
              {addr.city}, {addr.state} - <strong>{addr.postalCode}</strong><br />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {addr.country === 'IN' ? 'India' : addr.country}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              {!addr.isDefault && (
                <Button variant="secondary" size="sm" onClick={() => setDefaultAddress(addr.id)}>
                  Set as Default
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={<Edit3 size={14} />} onClick={() => handleOpenEditModal(addr)}>
                Edit
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Configurable Delivery Speed & Pincode Checker Banner */}
      <Card style={{ padding: 20, background: 'var(--bg-surface-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Truck size={20} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.125rem', margin: 0 }}>Configurable Doorstep Shipping Check</h3>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Free insured express shipping across India on orders above ₹999. International priority shipping available worldwide.
        </p>

        <form onSubmit={handleTestShipping} style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
          <input
            type="text"
            placeholder="Enter 6-digit PIN code"
            value={calcPincode}
            onChange={(e) => setCalcPincode(e.target.value)}
            maxLength={6}
            className="form-input"
            style={{
              flex: 1,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.875rem'
            }}
          />
          <Button variant="secondary" type="submit" size="sm">
            Check PIN
          </Button>
        </form>

        {shippingPreview && (
          <div style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--color-success)', fontWeight: 600 }}>
            ✓ {shippingPreview}
          </div>
        )}
      </Card>

      {/* Add / Edit Address Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddressId ? "Edit Delivery Address" : "Add New Delivery Address"}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.875rem'
              }}
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="form-input"
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Mobile Phone *
            </label>
            <input
              type="tel"
              required
              placeholder={country === 'IN' ? '+91 98765 43210' : '+1 555 123 4567'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="form-input"
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Address Line 1 (Flat, House No., Street) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Flat 402, Signature Towers, MG Road"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="form-input"
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Address Line 2 (Landmark, Area)
            </label>
            <input
              type="text"
              placeholder="e.g. Near Metro Pillar 124"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              className="form-input"
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                City *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Bengaluru"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="form-input"
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                {country === 'IN' ? 'State *' : 'State / Province *'}
              </label>
              {country === 'IN' ? (
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem'
                  }}
                >
                  {INDIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="e.g. California"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)' }}
                />
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              {country === 'IN' ? '6-Digit PIN Code *' : 'Postal / ZIP Code *'}
            </label>
            <input
              type="text"
              required
              placeholder={country === 'IN' ? '560001' : '94016'}
              maxLength={country === 'IN' ? 6 : 10}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="form-input"
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            <span>Make this my default shipping address</span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Address
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
