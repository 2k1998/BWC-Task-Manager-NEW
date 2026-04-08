import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Design-system table container.
 * Consumers are responsible for <thead>/<tbody> structure + row classes.
 */
export default function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden bg-white ${className}`}>
      {children}
    </div>
  );
}

