import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'glass';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variantClass = variant === 'interactive' 
    ? 'card-interactive' 
    : variant === 'glass' 
    ? 'card-glass' 
    : '';

  return (
    <div className={`card ${variantClass} ${className}`} {...props}>
      {children}
    </div>
  );
};
