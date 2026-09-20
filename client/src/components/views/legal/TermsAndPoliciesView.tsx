import React, { useState } from 'react';
import { ArrowLeft, FileText, RefreshCw, Truck, ShieldCheck, Mail, AlertTriangle } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { useApp } from '../../../context/AppContext';

type PolicyTab = 'terms' | 'refund' | 'shipping' | 'deletion';

export const TermsAndPoliciesView: React.FC = () => {
  const { navigateTo } = useApp();
  const [activeTab, setActiveTab] = useState<PolicyTab>('terms');

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('home')}>
          Back to Store
        </Button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Legal & Store Policies</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        <Button
          variant={activeTab === 'terms' ? 'primary' : 'secondary'}
          size="sm"
          icon={<FileText size={16} />}
          onClick={() => setActiveTab('terms')}
        >
          Terms of Service
        </Button>
        <Button
          variant={activeTab === 'refund' ? 'primary' : 'secondary'}
          size="sm"
          icon={<RefreshCw size={16} />}
          onClick={() => setActiveTab('refund')}
        >
          Refund & Returns
        </Button>
        <Button
          variant={activeTab === 'shipping' ? 'primary' : 'secondary'}
          size="sm"
          icon={<Truck size={16} />}
          onClick={() => setActiveTab('shipping')}
        >
          Shipping & Delivery
        </Button>
        <Button
          variant={activeTab === 'deletion' ? 'primary' : 'secondary'}
          size="sm"
          icon={<AlertTriangle size={16} />}
          onClick={() => setActiveTab('deletion')}
        >
          Data Deletion Request
        </Button>
      </div>

      {/* Terms Content */}
      {activeTab === 'terms' && (
        <Card style={{ padding: 24, lineHeight: 1.7 }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} color="var(--color-primary)" />
            Terms of Service
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Last updated: September 2026</p>
          <p>Welcome to GizmoVault. By accessing or using our application, website, and services, you agree to be bound by these Terms of Service.</p>
          
          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1.05rem' }}>1. Authenticity Guarantee</h3>
          <p>GizmoVault guarantees that all curated gadgets and imported watches listed on our platform are verified for authenticity and accurately described. Specifications, warranty periods, and condition grades are checked prior to catalog publication.</p>

          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1.05rem' }}>2. Pricing & Orders</h3>
          <p>All prices are listed in Indian Rupees (INR) inclusive of applicable taxes. In the event of a technical listing error, GizmoVault reserves the right to cancel unfulfilled orders with a 100% prompt refund.</p>

          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1.05rem' }}>3. User Conduct & Security</h3>
          <p>Users must not attempt to circumvent platform security, abuse coupon promotions, reverse-engineer proprietary algorithms, or submit fraudulent payment information.</p>
        </Card>
      )}

      {/* Refund Policy */}
      {activeTab === 'refund' && (
        <Card style={{ padding: 24, lineHeight: 1.7 }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={20} color="var(--color-primary)" />
            Refund & Cancellation Policy
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Fair, transparent return windows for gadgets & imported timepieces.</p>
          
          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1.05rem' }}>7-Day Replacement & Return Window</h3>
          <p>Products that arrive damaged, defective, or materially different from the catalog description are eligible for free replacement or full refund within 7 days of delivery.</p>

          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1.05rem' }}>Refund Processing Timeline</h3>
          <p>Once a returned item is received and inspected at our fulfillment hub, refunds are credited back to the original payment source (UPI, Credit Card, Net Banking) within 5 to 7 business days.</p>

          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1.05rem' }}>Order Cancellations</h3>
          <p>Orders can be cancelled with one click from your Order History screen anytime before dispatch. Instant refunds are processed for prepaid cancellations prior to shipping.</p>
        </Card>
      )}

      {/* Shipping Policy */}
      {activeTab === 'shipping' && (
        <Card style={{ padding: 24, lineHeight: 1.7 }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={20} color="var(--color-primary)" />
            Shipping & Delivery Policy
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Insured, tamper-evident courier dispatch across India.</p>
          
          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1.05rem' }}>Shipping Tiers</h3>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li><strong>Standard Insured Delivery:</strong> 3-5 business days. Free for orders above ₹999.</li>
            <li><strong>Express Air Courier:</strong> 1-2 business days for select metro PIN codes.</li>
          </ul>

          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1.05rem' }}>Tamper-Evident Packaging</h3>
          <p>Every imported watch and gadget is sealed in security-taped packaging. Do not accept deliveries if the security seal has been broken or tampered with.</p>
        </Card>
      )}

      {/* Play Store Account Deletion Request */}
      {activeTab === 'deletion' && (
        <Card style={{ padding: 24, lineHeight: 1.7 }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} color="#10b981" />
            Google Play Store Data Safety & Account Deletion
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            In full compliance with Google Play Store User Data & Account Deletion policies:
          </p>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: 16, borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            <h4 style={{ fontWeight: 600, marginBottom: 8 }}>How to Delete Your Account:</h4>
            <ol style={{ paddingLeft: 20 }}>
              <li>Go to <strong>Customer Profile</strong> in the GizmoVault app.</li>
              <li>Scroll down to the <strong>Privacy & Security</strong> section.</li>
              <li>Tap <strong>Delete My Account & Personal Data</strong>.</li>
              <li>Confirm the verification prompt. Your personal profile, addresses, and identifiers are instantly purged and anonymized.</li>
            </ol>
          </div>

          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1.05rem' }}>Web-Based Deletion Request (Without App Installation)</h3>
          <p>If you have uninstalled the app or prefer email submission, email our Data Protection Officer at:</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', fontWeight: 600, color: 'var(--color-primary)' }}>
            <Mail size={16} /> privacy@gizmovault.in
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Requests submitted via email are verified and processed within 48 hours in accordance with Play Store policy requirements.
          </p>
        </Card>
      )}
    </div>
  );
};
