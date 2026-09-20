import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const Skeleton: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ width = '100%', height = '20px', borderRadius, className = '', style }) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: borderRadius || 'var(--radius-sm)',
        ...style
      }}
    />
  );
};

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionText, onAction }) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon}
      </div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{title}</h3>
      <p style={{ maxWidth: 360, fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>{description}</p>
      {actionText && onAction && (
        <Button onClick={onAction} variant="primary" size="sm" style={{ marginTop: 8 }}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export const ErrorBanner: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => {
  return (
    <div style={{
      background: 'var(--color-danger-bg)',
      border: '1px solid rgba(244, 63, 94, 0.3)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      margin: '16px 0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertTriangle size={20} color="var(--color-danger)" />
        <span style={{ fontSize: '0.875rem', color: '#fca5a5', fontWeight: 500 }}>{message}</span>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="ghost" size="sm" icon={<RefreshCw size={14} />}>
          Retry
        </Button>
      )}
    </div>
  );
};
