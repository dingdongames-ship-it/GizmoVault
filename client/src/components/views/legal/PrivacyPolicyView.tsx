import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, Trash2, Mail } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { useApp } from '../../../context/AppContext';

export const PrivacyPolicyView: React.FC = () => {
  const { navigateTo } = useApp() as any;

  return (
    <div id="privacy-policy-page" style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo?.('home')}>
          Back
        </Button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <span style={{ color: 'var(--accent-cyan)' }}>Privacy</span> Policy
        </h1>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Shield size={20} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>GizmoVault Privacy Policy</h2>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          <strong>Effective Date:</strong> 1 January 2026 &nbsp;·&nbsp; <strong>Last Updated:</strong> 19 September 2026
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          GizmoVault ("we", "our", "us") is committed to protecting your personal information.
          This Privacy Policy explains how we collect, use, share, and protect data
          in accordance with applicable laws including DPDP Act 2023 (India) and Google Play Store policies.
        </p>
      </Card>

      {[
        {
          icon: <Eye size={18} color="var(--accent-cyan)" />,
          title: '1. Information We Collect',
          content: `We collect the following types of information:

• Account Information: Name, email address, phone number when you register.
• Order Information: Delivery address, items ordered, payment method (no raw card data is ever stored).
• Device Information: Device type, OS version, app version, and anonymous usage analytics.
• Location: Delivery PIN code (only when you provide it for shipping estimates).
• Communications: Customer support messages and feedback.

We do NOT collect: Raw card numbers, CVV codes, or payment secrets.
We do NOT collect: Unauthorized WhatsApp messages or private group content.`
        },
        {
          icon: <Lock size={18} color="var(--accent-gold)" />,
          title: '2. How We Use Your Information',
          content: `Your data is used only to:

• Process and fulfill your orders.
• Provide customer support.
• Send order notifications (via email or SMS where consented).
• Improve our products and services.
• Comply with legal obligations.

We do NOT sell your personal data to third parties.
We do NOT use your data for unauthorized advertising without consent.`
        },
        {
          icon: <Shield size={18} color="var(--color-success)" />,
          title: '3. How We Protect Your Data',
          content: `Security measures include:

• PCI-DSS Level 1 compliant payment processing via Razorpay.
• All card payments are tokenized — we never store raw card numbers.
• HTTPS/TLS encryption on all data in transit.
• Bcrypt password hashing with secure salting.
• JWT-based authentication with secure expiry.
• HMAC-SHA256 signed webhook verification for payment callbacks.
• SQL injection protection and parameterized queries throughout.
• CORS, CSP headers, and Helmet.js security hardening.`
        },
        {
          icon: <Trash2 size={18} color="var(--color-danger)" />,
          title: '4. Account Deletion & Data Rights',
          content: `You have the right to:

• Access your personal data at any time.
• Correct inaccurate information in your profile.
• Request deletion of your account and all associated data.
• Export your order history data.

To delete your account:
• In-App: Go to Profile → Settings → Delete Account
• Web/Email: Send a request to privacy@gizmovault.in

We will process account deletion within 30 days as required by Google Play Store Data Safety policy.
Order records required for legal/tax compliance may be retained for up to 7 years per applicable law.`
        },
        {
          icon: <Mail size={18} color="var(--text-secondary)" />,
          title: '5. WhatsApp Integration Compliance',
          content: `GizmoVault receives product information exclusively through:

• Authorized Meta Business API (official WhatsApp Cloud API).
• Authorized WhatsApp Business accounts registered with Meta.

We do NOT: Scrape private WhatsApp groups.
We do NOT: Access unauthorized or personal WhatsApp messages.
We do NOT: Store WhatsApp media beyond product catalog purposes.

All WhatsApp webhook events are verified using official Meta HMAC-SHA256 signatures.`
        },
        {
          icon: <Eye size={18} color="var(--text-secondary)" />,
          title: '6. Cookies & Tracking',
          content: `GizmoVault uses:

• Essential session cookies for authentication.
• Analytics cookies (anonymized, aggregated) for app performance improvement.

We do NOT use third-party advertising trackers.
You can clear cookies and app data through your device settings at any time.`
        },
        {
          icon: <Shield size={18} color="var(--text-secondary)" />,
          title: '7. Third-Party Services',
          content: `We use the following trusted third parties:

• Razorpay: Payment processing (PCI-DSS compliant).
• Delhivery / BlueDart: Logistics and order fulfillment.
• Meta WhatsApp Business API: Authorized product ingestion only.

Each third party has their own privacy policies. We only share minimal necessary data.`
        },
        {
          title: '8. Contact Us',
          icon: <Mail size={18} color="var(--accent-cyan)" />,
          content: `For privacy questions, data requests, or account deletion:

Email: privacy@gizmovault.in
Address: GizmoVault, India

For Google Play Store data safety information, visit our Data Safety section on the Play Store listing.`
        }
      ].map((section, idx) => (
        <Card key={idx} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {section.icon}
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{section.title}</h3>
          </div>
          <pre style={{
            whiteSpace: 'pre-wrap', fontFamily: 'inherit',
            fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0
          }}>{section.content}</pre>
        </Card>
      ))}
    </div>
  );
};
