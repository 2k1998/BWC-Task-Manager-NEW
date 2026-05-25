'use client';

import { getUserTypeBadgeClasses } from '@/lib/userHierarchy';

interface UserTypeBadgeProps {
  userType: string;
  label?: string;
}

export default function UserTypeBadge({ userType, label }: UserTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${getUserTypeBadgeClasses(userType)}`}
    >
      {label ?? userType}
    </span>
  );
}
