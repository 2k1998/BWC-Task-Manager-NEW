/** Module keys aligned with backend `user_permissions.module` and AdminPermissions i18n. */
export const MODULE_KEYS = [
  'tasks',
  'contacts',
  'companies',
  'projects',
  'cars',
  'analytics',
  'payments',
  'documents',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const ACCESS_LEVELS = ['none', 'view', 'edit', 'delete'] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export function defaultPermissionsMap(): Record<ModuleKey, AccessLevel> {
  return MODULE_KEYS.reduce(
    (acc, key) => {
      acc[key] = 'edit';
      return acc;
    },
    {} as Record<ModuleKey, AccessLevel>,
  );
}
