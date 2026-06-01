'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import UserTypeBadge from '@/components/admin/UserTypeBadge';
import { collectRootIds, getInitials, type UserTreeNode } from '@/lib/userHierarchy';

interface UserHierarchyTreeProps {
  nodes: UserTreeNode[];
  activeById: Record<string, boolean>;
  showPermissions: boolean;
  showResetPassword: boolean;
  showDeactivate: boolean;
  actioningUserId: string | null;
  onEdit: (node: UserTreeNode) => void;
  onPermissions: (node: UserTreeNode) => void;
  onResetPassword: (node: UserTreeNode) => void;
  onToggleActive: (node: UserTreeNode, activate: boolean) => void;
}

function TreeNodeRow({
  node,
  depth,
  expandedIds,
  onToggleExpand,
  activeById,
  showPermissions,
  showResetPassword,
  showDeactivate,
  actioningUserId,
  onEdit,
  onPermissions,
  onResetPassword,
  onToggleActive,
  t,
  roleLabel,
}: {
  node: UserTreeNode;
  depth: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  activeById: Record<string, boolean>;
  showPermissions: boolean;
  showResetPassword: boolean;
  showDeactivate: boolean;
  actioningUserId: string | null;
  onEdit: (node: UserTreeNode) => void;
  onPermissions: (node: UserTreeNode) => void;
  onResetPassword: (node: UserTreeNode) => void;
  onToggleActive: (node: UserTreeNode, activate: boolean) => void;
  t: ReturnType<typeof useTranslations<'Admin'>>;
  roleLabel: (role: string) => string;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const isActive = activeById[node.id] !== false;
  const paddingLeft = 12 + depth * 20;

  return (
    <>
      <div
        className={`flex flex-col sm:flex-row sm:items-center gap-3 py-3 px-4 border-b border-gray-100 last:border-0 text-[15px] ${
          isActive ? '' : 'opacity-50 bg-gray-50 text-gray-500'
        }`}
        style={{ paddingLeft }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(node.id)}
              className="shrink-0 p-0.5 text-gray-500 hover:text-gray-800"
              aria-expanded={expanded}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <div className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 font-semibold text-xs shrink-0">
            {getInitials(node.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-gray-900 truncate">{node.full_name}</div>
            <div className="text-gray-500 truncate text-sm">{node.email}</div>
          </div>
          <UserTypeBadge userType={node.user_type} label={roleLabel(node.user_type)} />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 pl-7 sm:pl-0">
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="text-gray-800 border border-gray-300 bg-white px-3 py-1 rounded-lg hover:bg-gray-50 text-sm"
          >
            {t('edit')}
          </button>
          {showPermissions && (
            <button
              type="button"
              onClick={() => onPermissions(node)}
              className="text-gray-900 border border-[#D1AE62]/50 bg-[#D1AE62]/15 px-3 py-1 rounded-lg hover:bg-[#D1AE62]/25 text-sm"
            >
              {t('permissions')}
            </button>
          )}
          {showResetPassword && (
            <button
              type="button"
              onClick={() => onResetPassword(node)}
              disabled={actioningUserId === node.id}
              className="text-gray-900 border border-[#D1AE62]/50 bg-[#D1AE62]/15 px-3 py-1 rounded-lg hover:bg-[#D1AE62]/25 text-sm disabled:opacity-50"
            >
              {t('resetPassword')}
            </button>
          )}
          {showDeactivate && (
            <button
              type="button"
              onClick={() => onToggleActive(node, !isActive)}
              disabled={actioningUserId === node.id}
              className="text-gray-700 border border-gray-300 bg-gray-50 px-3 py-1 rounded-lg hover:bg-gray-100 text-sm disabled:opacity-50"
            >
              {isActive ? t('deactivate') : t('activate')}
            </button>
          )}
        </div>
      </div>
      {hasChildren && expanded &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            activeById={activeById}
            showPermissions={showPermissions}
            showResetPassword={showResetPassword}
            showDeactivate={showDeactivate}
            actioningUserId={actioningUserId}
            onEdit={onEdit}
            onPermissions={onPermissions}
            onResetPassword={onResetPassword}
            onToggleActive={onToggleActive}
            t={t}
            roleLabel={roleLabel}
          />
        ))}
    </>
  );
}

export default function UserHierarchyTree({
  nodes,
  activeById,
  showPermissions,
  showResetPassword,
  showDeactivate,
  actioningUserId,
  onEdit,
  onPermissions,
  onResetPassword,
  onToggleActive,
}: UserHierarchyTreeProps) {
  const t = useTranslations('Admin');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(collectRootIds(nodes)));

  const roleLabel = (role: string) => {
    const key = `roles.${role}` as 'roles.Admin' | 'roles.Pillar' | 'roles.Manager' | 'roles.Head' | 'roles.Agent';
    const known = ['Admin', 'Pillar', 'Manager', 'Head', 'Agent'];
    return known.includes(role) ? t(key) : role;
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (nodes.length === 0) {
    return <p className="p-8 text-center text-gray-500 text-[15px]">{t('noUsers')}</p>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          activeById={activeById}
          showPermissions={showPermissions}
          showResetPassword={showResetPassword}
          showDeactivate={showDeactivate}
          actioningUserId={actioningUserId}
          onEdit={onEdit}
          onPermissions={onPermissions}
          onResetPassword={onResetPassword}
          onToggleActive={onToggleActive}
          t={t}
          roleLabel={roleLabel}
        />
      ))}
    </div>
  );
}
