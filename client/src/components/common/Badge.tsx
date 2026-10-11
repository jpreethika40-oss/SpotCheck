import React from 'react';

export type BadgeVariant = 'sage' | 'amber' | 'crimson' | 'sand' | 'charcoal';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'sand',
  size = 'md',
  icon,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    sage: 'bg-sage-bg text-sage border border-[#D5DDD5]',
    amber: 'bg-amber-bg text-amber border border-[#EBDCBF]',
    crimson: 'bg-crimson-bg text-crimson border border-[#F2D6D3]',
    sand: 'bg-sand-light text-charcoal border border-warm',
    charcoal: 'bg-charcoal text-ivory border border-charcoal-dark',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full leading-none tracking-tight ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon && <span className="inline-block">{icon}</span>}
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const norm = status.toUpperCase().replace(/\s+/g, '_');

  let variant: BadgeVariant = 'sand';
  let label = status;

  switch (norm) {
    case 'VERIFIED':
    case 'SYNCED':
    case 'PASS':
    case 'OPERATIONAL':
    case 'ACTIVE':
    case 'COMPLETED':
      variant = 'sage';
      break;

    case 'IN_PROGRESS':
    case 'ASSIGNED':
    case 'MEDIUM':
    case 'PENDING':
    case 'UPLOADING':
    case 'NEEDS_ATTENTION':
      variant = 'amber';
      break;

    case 'FAIL':
    case 'CRITICAL':
    case 'HIGH':
    case 'OUT_OF_SERVICE':
    case 'CONFLICT':
    case 'FAILED':
    case 'REJECTED':
      variant = 'crimson';
      break;

    case 'DRAFT':
    case 'REPORTED':
    case 'LOW':
    case 'NA':
    case 'INACTIVE':
    case 'RESOLVED':
    default:
      variant = 'sand';
      break;
  }

  // Format label nicely
  label = norm
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
};
