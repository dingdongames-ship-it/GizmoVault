import React, { useState } from 'react';
import { 
  User, 
  MapPin, 
  Heart, 
  Package, 
  ShieldAlert, 
  FileText, 
  HelpCircle, 
  ChevronRight, 
  LogOut, 
  ExternalLink 
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useApp } from '../../../context/AppContext';

export const ProfileView: React.FC = () => {
  const { 
    addresses, 
    orders, 
    wishlist, 
    products, 
    navigateTo, 
    openProductDetails, 
    deleteAccount 
  } = useApp();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const wishlistedProducts = products.filter(p => wishlist.includes(p.id));

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Profile Header */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, #00e5ff 0%, #3b82f6 100%)',
            color: '#041017',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.375rem',
            boxShadow: 'var(--cyan-glow)'
          }}>
            AS
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 2 }}>Aarav Sharma</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>aarav@example.com • +91 98765 43210</div>
            <span className="badge badge-success" style={{ marginTop: 6, fontSize: '0.6875rem' }}>
              Verified Vault Member
            </span>
          </div>
        </div>
      </Card>

      {/* Account Navigation List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <Card 
          variant="interactive" 
          onClick={() => navigateTo('orders')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Package size={20} color="var(--accent-cyan)" />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>My Orders & Tracking</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
            <span>{orders.length}</span>
            <ChevronRight size={18} />
          </div>
        </Card>

        <Card 
          variant="interactive" 
          onClick={() => navigateTo('wishlist')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Heart size={20} color="var(--color-danger)" />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Saved Wishlist</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
            <span>{wishlist.length}</span>
            <ChevronRight size={18} />
          </div>
        </Card>

        <Card 
          variant="interactive" 
          onClick={() => navigateTo('addresses')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MapPin size={20} color="var(--accent-gold)" />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Saved Delivery Addresses</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
            <span>{addresses.length}</span>
            <ChevronRight size={18} />
          </div>
        </Card>
      </div>

      {/* Support & Legal Links */}
      <h3 style={{ fontSize: '1.125rem', marginBottom: 12 }}>Assistance & Policies</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <Card 
          variant="interactive" 
          onClick={() => navigateTo('help')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <HelpCircle size={20} color="var(--accent-cyan)" />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Customer Help & Support</span>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </Card>

        <Card 
          variant="interactive" 
          onClick={() => navigateTo('privacy')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText size={20} color="var(--text-secondary)" />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Privacy Policy</span>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </Card>

        <Card 
          variant="interactive" 
          onClick={() => navigateTo('terms')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText size={20} color="var(--text-secondary)" />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Terms of Service</span>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </Card>

        <Card 
          variant="interactive" 
          onClick={() => navigateTo('refund-policy')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText size={20} color="var(--text-secondary)" />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Refund & Cancellation Policy</span>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </Card>
      </div>

      {/* Google Play Store Mandated Account Deletion Box */}
      <Card style={{
        background: 'rgba(244, 63, 94, 0.05)',
        border: '1px solid rgba(244, 63, 94, 0.3)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-danger)', fontWeight: 700, marginBottom: 4 }}>
              <ShieldAlert size={18} />
              <h4>Google Play Store User Data & Account Deletion</h4>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: 500, lineHeight: 1.5 }}>
              In full compliance with Google Play Store User Data policies, users have the right to delete their account and associated personal data both directly in-app or via our public web deletion portal.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
            Delete Account
          </Button>
        </div>
      </Card>

      {/* Account Deletion Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Account Deletion">
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Are you sure you wish to delete your account? All saved shipping addresses, order histories, and personal credentials will be permanently erased per Google Play Store policies.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
          <Button 
            variant="danger" 
            onClick={() => { 
              setIsDeleteModalOpen(false); 
              deleteAccount(); 
            }}
          >
            Permanently Delete My Data
          </Button>
        </div>
      </Modal>
    </div>
  );
};
