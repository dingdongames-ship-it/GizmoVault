import React from 'react';
import { Logo } from '../../ui/Logo';
import { Button } from '../../ui/Button';

export const SplashScreen: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'radial-gradient(circle at center, #101624 0%, #080c14 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div style={{ transform: 'scale(1.3)', marginBottom: '32px', animation: 'pulseGlow 2s infinite' }}>
        <Logo size="lg" showTagline={true} />
      </div>

      <div style={{ maxWidth: 360, marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>The Premier Vault</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Curated electronic gadgets & imported watches, directly authenticated from authorized WhatsApp broadcasts.
        </p>
      </div>

      <Button variant="primary" size="lg" onClick={onDismiss} style={{ minWidth: 200 }}>
        Enter Vault
      </Button>

      <div style={{ marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Google Play Store Edition • v1.0.0
      </div>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { filter: drop-shadow(0 0 16px rgba(0, 229, 255, 0.2)); }
          50% { filter: drop-shadow(0 0 32px rgba(0, 229, 255, 0.5)); }
        }
      `}</style>
    </div>
  );
};
