import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import type { AccessLevel, ModuleKey } from '@/lib/modulePermissions';

const RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  delete: 3,
};

/**
 * Returns true if the current user's module access is at least `requiredLevel`.
 * Hierarchy: delete >= edit >= view > none. Admins always return true.
 */
export function useHasPermission(module: ModuleKey, requiredLevel: AccessLevel): boolean {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  if (user?.user_type === 'Admin') {
    return true;
  }

  const effective = (permissions[module] ?? 'edit') as AccessLevel;
  const userRank = RANK[effective] ?? 0;
  const requiredRank = RANK[requiredLevel] ?? 0;
  return userRank >= requiredRank;
}
