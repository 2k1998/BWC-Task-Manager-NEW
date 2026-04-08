import React from 'react';

type BadgeVariant = 'status' | 'urgency' | 'role' | 'outline';
type BadgeColor = 'gray' | 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  color?: BadgeColor;
  children: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ 
  variant = 'status', 
  color = 'gray',
  children,
  className = ''
}) => {
  const baseStyles = 'inline-flex items-center font-medium';
  
  // Explicit class mappings for Tailwind (can't use dynamic strings)
  const statusClasses = {
    gray: 'px-2.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800',
    red: 'px-2.5 py-0.5 rounded-full text-xs bg-red-100 text-red-800',
    blue: 'px-2.5 py-0.5 rounded-full text-xs bg-primary-gold/15 text-brand-brown',
    green: 'px-2.5 py-0.5 rounded-full text-xs bg-green-100 text-green-800',
    yellow: 'px-2.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800',
    orange: 'px-2.5 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800',
    purple: 'px-2.5 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800',
  };
  
  const urgencyClasses = {
    gray: 'px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700 border border-gray-200',
    red: 'px-3 py-1 rounded-md text-sm bg-red-50 text-red-700 border border-red-200',
    blue: 'px-3 py-1 rounded-md text-sm bg-primary-gold/10 text-brand-brown border border-primary-gold/35',
    green: 'px-3 py-1 rounded-md text-sm bg-green-50 text-green-700 border border-green-200',
    yellow: 'px-3 py-1 rounded-md text-sm bg-yellow-50 text-yellow-700 border border-yellow-200',
    orange: 'px-3 py-1 rounded-md text-sm bg-orange-50 text-orange-700 border border-orange-200',
    purple: 'px-3 py-1 rounded-md text-sm bg-purple-50 text-purple-700 border border-purple-200',
  };
  
  const roleClasses = 'px-2 py-1 rounded text-xs uppercase tracking-wide bg-gray-100 text-gray-700';
  const outlineClasses = 'px-2.5 py-0.5 rounded-full text-xs border border-gray-200 text-gray-700 bg-transparent';
  
  const variantStyles = {
    status: statusClasses[color],
    urgency: urgencyClasses[color],
    role: roleClasses,
    outline: outlineClasses,
  };
  
  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;

