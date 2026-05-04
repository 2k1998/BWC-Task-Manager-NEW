'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { ACCESS_LEVELS, MODULE_KEYS, type AccessLevel, type ModuleKey } from '@/lib/modulePermissions';
import { usePermissions } from '@/context/PermissionsContext';
import { useAuth } from '@/context/AuthContext';

type ApiPermissionRow = { module: string; access_level: string };

interface PermissionsModalProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

function isAccessLevel(v: string): v is AccessLevel {
  return (ACCESS_LEVELS as readonly string[]).includes(v);
}

export default function PermissionsModal({ userId, userName, isOpen, onClose }: PermissionsModalProps) {
  const t = useTranslations('AdminPermissions');
  const { refetch: refetchMyPermissions } = usePermissions();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<ModuleKey, AccessLevel>>(() =>
    MODULE_KEYS.reduce((acc, m) => ({ ...acc, [m]: 'edit' as AccessLevel }), {} as Record<ModuleKey, AccessLevel>),
  );

  const loadPermissions = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data } = await apiClient.get<ApiPermissionRow[]>(`/admin/users/${userId}/permissions`);
      const rows = Array.isArray(data) ? data : [];
      const next = MODULE_KEYS.reduce((acc, m) => {
        const row = rows.find((r) => r.module === m);
        const level = row?.access_level && isAccessLevel(row.access_level) ? row.access_level : 'edit';
        acc[m] = level;
        return acc;
      }, {} as Record<ModuleKey, AccessLevel>);
      setDraft(next);
    } catch {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    if (isOpen && userId) {
      void loadPermissions();
    }
  }, [isOpen, userId, loadPermissions]);

  const setLevel = (module: ModuleKey, level: AccessLevel) => {
    setDraft((prev) => ({ ...prev, [module]: level }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.patch(`/admin/users/${userId}/permissions`, {
        permissions: MODULE_KEYS.map((module) => ({
          module,
          access_level: draft[module],
        })),
      });
      toast.success(t('saveSuccess'));
      if (currentUser?.id === userId) {
        await refetchMyPermissions();
      }
      onClose();
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      panelClassName="max-w-3xl shadow-xl"
    >
      <div className="text-[15px] text-gray-700 space-y-4">
        <p className="text-gray-600">
          {t('description')} — <span className="font-medium text-gray-900">{userName}</span>
        </p>

        {loading ? (
          <p className="text-gray-500 py-6 text-center">{t('loading')}</p>
        ) : (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {MODULE_KEYS.map((mod) => (
              <div
                key={mod}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
              >
                <span className="font-medium text-gray-900 shrink-0 min-w-[7rem]">{t(`modules.${mod}`)}</span>
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                  {ACCESS_LEVELS.map((level) => {
                    const active = draft[mod] === level;
                    return (
                      <label
                        key={level}
                        className={`inline-flex items-center cursor-pointer rounded-lg border px-2.5 py-1.5 transition-colors ${
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
                          onChange={() => setLevel(mod, level)}
                        />
                        <span>{t(`levels.${level}`)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || loading}>
            {t('save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
