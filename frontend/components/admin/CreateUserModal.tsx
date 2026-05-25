'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { Button, Input } from '@/components/ui';
import ModulePermissionsEditor from '@/components/admin/ModulePermissionsEditor';
import SearchableParentSelect from '@/components/admin/SearchableParentSelect';
import apiClient from '@/lib/apiClient';
import {
  flattenTree,
  deriveUsername,
  getCreatableRoles,
  filterParentOptionsByChildRole,
  parseFullName,
  type UserTreeNode,
} from '@/lib/userHierarchy';
import {
  MODULE_KEYS,
  type AccessLevel,
  type ModuleKey,
} from '@/lib/modulePermissions';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: UserTreeNode[];
  currentUserType: string;
  currentUserId?: string;
  isAdmin: boolean;
  onSuccess: (generatedPassword: string) => void;
}

export default function CreateUserModal({
  isOpen,
  onClose,
  tree,
  currentUserType,
  currentUserId,
  isAdmin,
  onSuccess,
}: CreateUserModalProps) {
  const t = useTranslations('Admin');
  const tAdminPerm = useTranslations('AdminPermissions');
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState('');
  const [parentId, setParentId] = useState('');

  const creatableRoles = getCreatableRoles(currentUserType);
  const selectedRole = userType || creatableRoles[0] || '';
  const parentOptions = filterParentOptionsByChildRole(flattenTree(tree), selectedRole);

  useEffect(() => {
    if (!isOpen) return;
    const defaultRole = creatableRoles[0] ?? '';
    setUserType(defaultRole);
    if (!isAdmin && currentUserId) {
      setParentId(currentUserId);
    }
  }, [isOpen, isAdmin, currentUserId, creatableRoles]);

  const [permissions, setPermissions] = useState<Record<ModuleKey, AccessLevel>>(() =>
    MODULE_KEYS.reduce(
      (acc, m) => ({ ...acc, [m]: 'edit' as AccessLevel }),
      {} as Record<ModuleKey, AccessLevel>,
    ),
  );

  const resetForm = () => {
    setFullName('');
    setEmail('');
    const defaultRole = creatableRoles[0] ?? '';
    setUserType(defaultRole);
    setParentId(!isAdmin && currentUserId ? currentUserId : '');
    setPermissions(
      MODULE_KEYS.reduce(
        (acc, m) => ({ ...acc, [m]: 'edit' as AccessLevel }),
        {} as Record<ModuleKey, AccessLevel>,
      ),
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedParentId = isAdmin ? parentId : (parentId || currentUserId || '');
    if (!isAdmin && !resolvedParentId) {
      toast.error(t('parentRequired'));
      return;
    }
    const { first_name, last_name } = parseFullName(fullName);
    if (!first_name || !email || !userType) return;

    try {
      setSaving(true);
      const { data } = await apiClient.post('/admin/users', {
        email,
        username: deriveUsername(email),
        first_name,
        last_name,
        user_type: userType,
        ...(resolvedParentId ? { parent_id: resolvedParentId } : {}),
      });

      const newUserId = data.user_id ?? data.id;
      if (isAdmin && newUserId) {
        await apiClient.patch(`/admin/users/${newUserId}/permissions`, {
          permissions: MODULE_KEYS.map((module) => ({
            module,
            access_level: permissions[module],
          })),
        });
      }

      toast.success(t('createSuccess'));
      const password = data.generated_password ?? '';
      resetForm();
      onClose();
      onSuccess(password);
    } catch {
      toast.error(t('createError'));
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('createUser')}
      panelClassName="max-w-3xl shadow-xl"
    >
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
            value={selectedRole}
            onChange={(e) => {
              setUserType(e.target.value);
              setParentId(!isAdmin && currentUserId ? currentUserId : '');
            }}
          >
            {creatableRoles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('parent')}</label>
            <SearchableParentSelect
              options={parentOptions}
              value={parentId}
              onChange={setParentId}
              required={false}
            />
          </div>
        )}
        {isAdmin && (
          <div className="border-t border-gray-100 pt-4">
            <h3 className="font-medium text-gray-900 mb-3">{t('modulePermissions')}</h3>
            <ModulePermissionsEditor
              value={permissions}
              onChange={(mod, level) => setPermissions((prev) => ({ ...prev, [mod]: level }))}
            />
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={handleClose} disabled={saving}>
            {tAdminPerm('cancel')}
          </Button>
          <Button type="submit" disabled={saving}>
            {t('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
