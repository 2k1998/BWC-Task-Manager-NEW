'use client';

import { X } from 'lucide-react';
import { useBranchFilter } from '@/context/BranchFilterContext';

export default function BranchFilterBadge({ className = '' }: { className?: string }) {
  const { selectedBranchUserId, selectedBranchLabel, clearBranch } =
    useBranchFilter();

  if (!selectedBranchUserId) return null;

  const displayName =
    selectedBranchLabel?.replace(/\s*\([^)]*\)\s*$/, '').trim() ||
    'selected branch';

  return (
    <div className={`flex flex-wrap items-center gap-2 text-[15px] ${className}`}>
      <span className="text-[#D1AE62] font-medium">
        Viewing: {displayName}&apos;s branch
      </span>
      <button
        type="button"
        onClick={clearBranch}
        className="inline-flex items-center gap-1 text-[#D1AE62] hover:opacity-80"
        aria-label="Clear branch filter"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
