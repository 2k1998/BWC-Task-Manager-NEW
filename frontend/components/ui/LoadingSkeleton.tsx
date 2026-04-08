import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'card' | 'list' | 'table';
  count?: number;
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
      <div className="flex gap-2">
        <div className="h-5 bg-gray-100 rounded-full w-16" />
        <div className="h-5 bg-gray-100 rounded-full w-20" />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 animate-pulse">
      <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
      <div className="h-5 bg-gray-100 rounded-full w-16" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/4" />
      <div className="h-4 bg-gray-100 rounded w-1/6" />
      <div className="h-4 bg-gray-100 rounded w-1/5" />
      <div className="ml-auto h-4 bg-gray-100 rounded w-16" />
    </div>
  );
}

export default function LoadingSkeleton({ variant = 'card', count = 3 }: LoadingSkeletonProps) {
  const items = Array.from({ length: count });

  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {items.map((_, i) => <ListSkeleton key={i} />)}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {items.map((_, i) => <TableSkeleton key={i} />)}
      </div>
    );
  }

  // Default: card
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}
