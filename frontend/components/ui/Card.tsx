import React from 'react';

type CardVariant = 'default' | 'dense' | 'highlight';

interface CardProps {
  variant?: CardVariant;
  urgencyColor?: 'red' | 'blue' | 'green' | 'yellow' | 'orange';
  className?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ 
  variant = 'default', 
  urgencyColor,
  className = '', 
  children 
}) => {
  const baseStyles = 'bg-white rounded-lg border border-gray-200';
  
  // Explicit class mapping for Tailwind (can't use dynamic strings)
  const urgencyBorderClasses = {
    red: 'border-l-4 border-l-red-500',
    blue: 'border-l-4 border-l-blue-500',
    green: 'border-l-4 border-l-green-500',
    yellow: 'border-l-4 border-l-yellow-500',
    orange: 'border-l-4 border-l-orange-500',
  };
  
  const variantStyles = {
    default: 'p-6',
    dense: 'p-4',
    highlight: urgencyColor 
      ? `p-6 ${urgencyBorderClasses[urgencyColor]}` 
      : 'p-6',
  };
  
  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};

export default Card;

