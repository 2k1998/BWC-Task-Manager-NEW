'use client';

import { useMemo, useState } from 'react';
import UserTypeBadge from '@/components/admin/UserTypeBadge';

export type AssigneeUserOption = {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  username?: string;
  user_type?: string;
};

function displayName(user: AssigneeUserOption): string {
  if (user.full_name?.trim()) return user.full_name.trim();
  const combined = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return combined || user.username || user.id;
}

interface AssigneeUserSelectProps {
  users: AssigneeUserOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function AssigneeUserSelect({
  users,
  value,
  onChange,
  placeholder = 'Select user...',
  required = false,
  disabled = false,
}: AssigneeUserSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = users.find((u) => u.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = displayName(u).toLowerCase();
      return (
        name.includes(q) ||
        (u.username ?? '').toLowerCase().includes(q) ||
        (u.user_type ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, query]);

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
        placeholder={selected ? displayName(selected) : placeholder}
        value={open ? query : selected ? displayName(selected) : ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        required={required && !value}
      />
      {selected && !open && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <UserTypeBadge userType={selected.user_type ?? 'Agent'} />
        </div>
      )}
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-gray-500 text-sm">No users found</li>
            ) : (
              filtered.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between gap-2 ${
                      value === user.id ? 'bg-[#D1AE62]/10' : ''
                    }`}
                    onClick={() => {
                      onChange(user.id);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <span className="truncate font-medium text-gray-900">{displayName(user)}</span>
                    <UserTypeBadge userType={user.user_type ?? 'Agent'} />
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}
