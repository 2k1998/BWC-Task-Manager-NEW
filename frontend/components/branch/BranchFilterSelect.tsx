'use client';

import { useBranchFilter } from '@/context/BranchFilterContext';

export default function BranchFilterSelect() {
  const {
    isAdmin,
    branchHeads,
    branchHeadsLoading,
    selectedBranchUserId,
    setBranch,
  } = useBranchFilter();

  if (!isAdmin) return null;

  const isActive = !!selectedBranchUserId;

  return (
    <select
      aria-label="Filter by branch"
      value={selectedBranchUserId ?? ''}
      disabled={branchHeadsLoading}
      onChange={(e) => {
        const value = e.target.value;
        if (!value) {
          setBranch(null, null);
          return;
        }
        const head = branchHeads.find((h) => h.id === value);
        const label = head
          ? `${head.full_name} (${head.user_type})`
          : null;
        setBranch(value, label);
      }}
      className={`text-[15px] px-3 py-1.5 rounded-lg border bg-white min-w-[140px] sm:min-w-[180px] max-w-[200px] sm:max-w-[240px] truncate ${
        isActive
          ? 'border-[#D1AE62] text-gray-900'
          : 'border-gray-200 text-gray-700'
      }`}
    >
      <option value="">All Branches</option>
      {branchHeads.map((head) => (
        <option key={head.id} value={head.id}>
          {head.full_name} ({head.user_type})
        </option>
      ))}
    </select>
  );
}
