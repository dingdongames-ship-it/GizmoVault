import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  icon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{ 
            position: 'absolute', 
            left: '14px', 
            color: 'var(--text-muted)', 
            display: 'flex', 
            alignItems: 'center', 
            pointerEvents: 'none' 
          }}>
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`form-input ${className}`}
          style={{ paddingLeft: icon ? '42px' : undefined, borderColor: error ? 'var(--color-danger)' : undefined }}
          {...props}
        />
      </div>
      {error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '4px', fontWeight: 500 }}>
          {error}
        </span>
      )}
      {!error && helperText && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          {helperText}
        </span>
      )}
    </div>
  );
};
