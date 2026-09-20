import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showTagline = false }) => {
  const iconSizes = {
    sm: 28,
    md: 38,
    lg: 48
  };

  const textSizes = {
    sm: '1.125rem',
    md: '1.375rem',
    lg: '1.75rem'
  };

  const dim = iconSizes[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
      <svg width={dim} height={dim} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoVaultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="128" fill="#101624" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
        <polygon points="256,76 396,156 396,316 256,396 116,316 116,156" 
                 fill="none" stroke="url(#logoVaultGrad)" strokeWidth="20" strokeLinejoin="round"/>
        <circle cx="256" cy="236" r="76" fill="#162033" stroke="#00e5ff" strokeWidth="8"/>
        <line x1="256" y1="236" x2="256" y2="185" stroke="#00e5ff" strokeWidth="8" strokeLinecap="round"/>
        <line x1="256" y1="236" x2="295" y2="236" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round"/>
        <circle cx="256" cy="236" r="10" fill="#ffffff"/>
      </svg>
      <div>
        <div style={{ 
          fontSize: textSizes[size], 
          fontWeight: 800, 
          letterSpacing: '-0.03em', 
          lineHeight: 1, 
          display: 'flex', 
          alignItems: 'center' 
        }}>
          <span style={{ color: '#f8fafc' }}>Gizmo</span>
          <span style={{ 
            background: 'linear-gradient(135deg, #00e5ff 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Vault</span>
        </div>
        {showTagline && (
          <div style={{ fontSize: '0.6875rem', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px', fontWeight: 600 }}>
            Discover • Compare • Shop
          </div>
        )}
      </div>
    </div>
  );
};
