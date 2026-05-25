'use client';

import { useTranslations } from 'next-intl';
import { ACCESS_LEVELS, MODULE_KEYS, type AccessLevel, type ModuleKey } from '@/lib/modulePermissions';

interface ModulePermissionsEditorProps {
  value: Record<ModuleKey, AccessLevel>;
  onChange: (module: ModuleKey, level: AccessLevel) => void;
  disabled?: boolean;
}

export default function ModulePermissionsEditor({
  value,
  onChange,
  disabled = false,
}: ModulePermissionsEditorProps) {
  const t = useTranslations('AdminPermissions');

  return (
    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
      {MODULE_KEYS.map((mod) => (
        <div
          key={mod}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
        >
          <span className="font-medium text-gray-900 shrink-0 min-w-[7rem] text-[15px]">
            {t(`modules.${mod}`)}
          </span>
          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            {ACCESS_LEVELS.map((level) => {
              const active = value[mod] === level;
              return (
                <label
                  key={level}
                  className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 transition-colors text-[15px] ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    active
                      ? 'border-[#D1AE62] bg-[#D1AE62]/15 text-gray-900 ring-1 ring-[#D1AE62]/40'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`perm-${mod}`}
                    checked={active}
                    disabled={disabled}
                    onChange={() => onChange(mod, level)}
                  />
                  <span>{t(`levels.${level}`)}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
