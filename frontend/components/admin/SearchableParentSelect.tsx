'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FlatTreeOption } from '@/lib/userHierarchy';

interface SearchableParentSelectProps {
  options: FlatTreeOption[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  disabled?: boolean;
}

export default function SearchableParentSelect({
  options,
  value,
  onChange,
  required = false,
  disabled = false,
}: SearchableParentSelectProps) {
  const t = useTranslations('Admin');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.full_name.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.user_type.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-[15px] bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
        placeholder={selected ? selected.label : t('searchParent')}
        value={open ? query : selected?.label ?? ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        required={required && !value}
      />
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl text-[15px]">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-gray-500">{t('noUsers')}</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${
                      value === opt.id ? 'bg-[#D1AE62]/10 font-medium' : ''
                    }`}
                    onClick={() => {
                      onChange(opt.id);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    {opt.label}
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
