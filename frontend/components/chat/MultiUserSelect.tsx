'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import UserTypeBadge from '@/components/admin/UserTypeBadge';
import type { UserBrief } from '@/lib/api/users';

interface MultiUserSelectProps {
  users: UserBrief[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Users that cannot be picked (e.g. already members of the group). */
  excludeIds?: string[];
  placeholder?: string;
  disabled?: boolean;
}

export default function MultiUserSelect({
  users,
  value,
  onChange,
  excludeIds = [],
  placeholder,
  disabled = false,
}: MultiUserSelectProps) {
  const t = useTranslations('Chat');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const selectable = useMemo(() => users.filter((u) => !excluded.has(u.id)), [users, excluded]);
  const selectedUsers = useMemo(
    () => value.map((id) => selectable.find((u) => u.id === id)).filter((u): u is UserBrief => Boolean(u)),
    [value, selectable]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = selectable.filter((u) => !value.includes(u.id));
    if (!q) return available;
    return available.filter(
      (u) =>
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.user_type ?? '').toLowerCase().includes(q)
    );
  }, [selectable, value, query]);

  const removeUser = (id: string) => onChange(value.filter((v) => v !== id));

  return (
    <div className="relative">
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 bg-[#D1AE62]/15 text-gray-900 border border-[#D1AE62]/40 rounded-full pl-3 pr-1.5 py-1 text-sm"
            >
              <span className="truncate max-w-[160px]">{user.full_name || user.email}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeUser(user.id)}
                  className="text-gray-500 hover:text-gray-900 rounded-full w-4 h-4 flex items-center justify-center"
                  aria-label={`${t('removeMember')} ${user.full_name || user.email}`}
                >
                  &times;
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#D1AE62] focus:border-transparent outline-none transition-all disabled:bg-gray-50 text-[15px] text-gray-900 placeholder:text-gray-400"
        placeholder={placeholder ?? t('searchUser')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
      />
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-gray-500 text-sm">{t('noUsersFound')}</li>
            ) : (
              filtered.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
                    onClick={() => {
                      onChange([...value, user.id]);
                      setQuery('');
                    }}
                  >
                    <span className="truncate font-medium text-gray-900">{user.full_name || user.email}</span>
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
