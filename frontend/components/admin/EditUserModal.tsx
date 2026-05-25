'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { Button, Input } from '@/components/ui';
import SearchableParentSelect from '@/components/admin/SearchableParentSelect';
import apiClient from '@/lib/apiClient';
import {
  getCreatableRoles,
  getValidParentOptions,
  filterParentOptionsByChildRole,
  parseFullName,
  type UserTreeNode,
} from '@/lib/userHierarchy';

interface EditUserModalProps {
  isOpen: boolean;
  userId: string | null;
  tree: UserTreeNode[];
  currentUserType: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditUserModal({
  isOpen,
  userId,
  tree,
  currentUserType,
  onClose,
  onSuccess,
}: EditUserModalProps) {
  const t = useTranslations('Admin');
  const tAdminPerm = useTranslations('AdminPermissions');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState('');
  const [parentId, setParentId] = useState('');

  const creatableRoles = getCreatableRoles(currentUserType);
  const baseParentOptions = userId ? getValidParentOptions(tree, userId) : [];
  const parentOptions = filterParentOptionsByChildRole(baseParentOptions, userType);

  const loadUser = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data } = await apiClient.get(`/admin/users/${userId}`);
      setFullName(`${data.first_name ?? ''} ${data.last_name ?? ''}`.trim());
      setEmail(data.email ?? '');
      setUserType(data.user_type ?? '');
      setParentId(data.parent_id ?? '');
    } catch {
      toast.error(t('loadError'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [userId, t, onClose]);

  useEffect(() => {
    if (isOpen && userId) void loadUser();
  }, [isOpen, userId, loadUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const { first_name, last_name } = parseFullName(fullName);

    try {
      setSaving(true);
      await apiClient.patch(`/admin/users/${userId}`, {
        email,
        first_name,
        last_name,
        user_type: userType,
        parent_id: parentId || null,
      });
      toast.success(t('updateSuccess'));
      onSuccess();
      onClose();
    } catch {
      toast.error(t('updateError'));
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (role: string) => {
    if (!role) return '';
    const key = `roles.${role}` as 'roles.Admin' | 'roles.Pillar' | 'roles.Manager' | 'roles.Head' | 'roles.Agent';
    const known = ['Admin', 'Pillar', 'Manager', 'Head', 'Agent'];
    return known.includes(role) ? t(key) : role;
  };

  const displayRoles = creatableRoles.includes(userType)
    ? creatableRoles
    : [...creatableRoles, userType].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('editUser')}
      panelClassName="max-w-lg shadow-xl"
    >
      {loading ? (
        <p className="text-gray-500 py-8 text-center text-[15px]">{t('loading')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-[15px]">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('fullName')}</label>
            <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('userType')}</label>
            <select
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none"
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
            >
              {displayRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('parent')}</label>
            <SearchableParentSelect
              options={parentOptions}
              value={parentId}
              onChange={setParentId}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
              {tAdminPerm('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {t('save')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
