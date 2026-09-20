import React from 'react';
import { ArrowLeft, ShieldCheck, Mail, MessageSquare, Phone } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { useApp } from '../../../context/AppContext';

export const PolicyViews: React.FC<{ type: 'privacy' | 'terms' | 'refund-policy' | 'help' }> = ({ type }) => {
  const { navigateTo } = useApp();

  if (type === 'privacy') {
    return (
      <div style={{ paddingBottom: 48, maxWidth: 800, margin: '0 auto' }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('profile')} style={{ marginBottom: 16 }}>
          Back to Profile
        </Button>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ShieldCheck size={24} color="var(--accent-cyan)" />
            <h1>GizmoVault Privacy Policy</h1>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Last Updated: September 2026 • Google Play Store Data Safety Compliant
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <section>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>1. Information We Collect</h3>
              <p>
                We collect personal information necessary for ecommerce order fulfillment and communication: Full Name, Phone Number, Delivery Address, Email Address, and Purchase Records. We do not collect invasive location, contacts, or biometric data.
              </p>
            </section>

            <section>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>2. How We Use Information</h3>
              <p>
                Your information is used strictly to verify orders, deliver shipments via authorized courier logistics, provide tracking updates via SMS or authorized WhatsApp notifications, and process refunds. We never sell personal data to advertisers.
              </p>
            </section>

            <section>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>3. Google Play Store Account Deletion</h3>
              <p>
                In compliance with Google Play Developer Policies, you may delete your account and associated personal data at any time directly through the app settings or via our web portal at <code>/auth/account-deletion-request</code>.
              </p>
            </section>

            <section>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>4. Data Security</h3>
              <p>
                All data in transit is encrypted using TLS 1.3 standards. Payment card numbers are tokenized directly through PCI-DSS Level 1 compliant gateway partners and never stored on GizmoVault servers.
              </p>
            </section>
          </div>
        </Card>
      </div>
    );
  }

  if (type === 'refund-policy') {
    return (
      <div style={{ paddingBottom: 48, maxWidth: 800, margin: '0 auto' }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('profile')} style={{ marginBottom: 16 }}>
          Back to Profile
        </Button>
        <Card>
          <h1 style={{ marginBottom: 8 }}>Refund & Return Policy</h1>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Effective Date: September 2026
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <section>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>7-Day Doorstep Replacement Guarantee</h3>
              <p>
                If your electronic gadget or imported watch arrives defective, physically damaged in transit, or different from specifications, you are eligible for an immediate doorstep replacement or 100% refund within 7 days of delivery.
              </p>
            </section>
            <section>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>Refund Processing Time</h3>
              <p>
                Refunds for UPI payments are credited within 2–4 hours of approval. Credit and debit card refunds are credited within 3–5 business days as per banking clearing networks.
              </p>
            </section>
          </div>
        </Card>
      </div>
    );
  }

  if (type === 'terms') {
    return (
      <div style={{ paddingBottom: 48, maxWidth: 800, margin: '0 auto' }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('profile')} style={{ marginBottom: 16 }}>
          Back to Profile
        </Button>
        <Card>
          <h1 style={{ marginBottom: 8 }}>Terms of Service</h1>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Governing Law: India
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <p>
              By accessing GizmoVault, purchasing items, or connecting through authorized WhatsApp channels, you agree to our commercial purchasing and delivery terms. All prices are stated in Indian Rupees (INR) and include applicable taxes.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // HELP & SUPPORT
  return (
    <div style={{ paddingBottom: 48, maxWidth: 800, margin: '0 auto' }}>
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('profile')} style={{ marginBottom: 16 }}>
        Back to Profile
      </Button>
      <Card style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 8 }}>Customer Support Hub</h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          Need assistance with an order, delivery tracking, or technical gadget specs? Our support specialists are available 24/7.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={{ padding: 16, background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <MessageSquare size={20} color="var(--color-success)" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>WhatsApp Support</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>+91 98765 43210</div>
          </div>

          <div style={{ padding: 16, background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <Mail size={20} color="var(--accent-cyan)" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Email Assistance</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>support@gizmovault.com</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
