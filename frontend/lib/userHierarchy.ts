export const HIERARCHY_MANAGER_ROLES = ['Admin', 'Pillar', 'Manager', 'Head'] as const;

export type HierarchyManagerRole = (typeof HIERARCHY_MANAGER_ROLES)[number];

export const ROLE_CREATION_MAP: Record<string, string[]> = {
  Admin: ['Admin', 'Pillar', 'Manager', 'Head', 'Agent'],
  Pillar: ['Manager', 'Head', 'Agent'],
  Manager: ['Head', 'Agent'],
  Head: ['Agent'],
  Agent: [],
};

export const VALID_PARENT_ROLES_MAP: Record<string, string[]> = {
  Pillar: ['Admin'],
  Manager: ['Admin', 'Pillar'],
  Head: ['Admin', 'Pillar', 'Manager'],
  Agent: ['Admin', 'Pillar', 'Manager', 'Head'],
};

export interface UserTreeNode {
  id: string;
  full_name: string;
  email: string;
  user_type: string;
  parent_id: string | null;
  children: UserTreeNode[];
}

export interface FlatTreeOption {
  id: string;
  full_name: string;
  email: string;
  user_type: string;
  depth: number;
  label: string;
}

export function canManageUsers(userType: string | undefined): boolean {
  return !!userType && (HIERARCHY_MANAGER_ROLES as readonly string[]).includes(userType);
}

export function getCreatableRoles(userType: string | undefined): string[] {
  if (!userType) return [];
  return ROLE_CREATION_MAP[userType] ?? [];
}

export function getValidParentRolesFor(role: string): string[] {
  return VALID_PARENT_ROLES_MAP[role] ?? [];
}

export function filterParentOptionsByChildRole(
  options: FlatTreeOption[],
  childRole: string,
): FlatTreeOption[] {
  const allowed = getValidParentRolesFor(childRole);
  if (allowed.length === 0) return [];
  return options.filter((opt) => allowed.includes(opt.user_type));
}

export function parseFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { first_name: '', last_name: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

export function deriveUsername(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  const local = atIndex >= 0 ? trimmed.slice(0, atIndex) : trimmed;
  const domainPart = atIndex >= 0 ? trimmed.slice(atIndex + 1) : '';
  const domainSegment = domainPart.split('.')[0] ?? '';

  const sanitize = (part: string) =>
    part.toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/\./g, '');

  const combined = domainSegment
    ? `${sanitize(local)}_${sanitize(domainSegment)}`
    : sanitize(local);

  const slug = combined.slice(0, 50);
  return slug.length >= 3 ? slug : `user${Date.now().toString(36).slice(-6)}`;
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getUserTypeBadgeClasses(userType: string): string {
  switch (userType) {
    case 'Admin':
      return 'bg-[#111827] text-white';
    case 'Pillar':
      return 'bg-[#D1AE62] text-white';
    case 'Manager':
      return 'bg-[#3B82F6] text-white';
    case 'Head':
      return 'bg-[#22C55E] text-white';
    case 'Agent':
    default:
      return 'bg-[#6B7280] text-white';
  }
}

export function flattenTree(nodes: UserTreeNode[], depth = 0): FlatTreeOption[] {
  const result: FlatTreeOption[] = [];
  for (const node of nodes) {
    const indent = depth > 0 ? `${'— '.repeat(depth)}` : '';
    result.push({
      id: node.id,
      full_name: node.full_name,
      email: node.email,
      user_type: node.user_type,
      depth,
      label: `${indent}${node.full_name} (${node.user_type})`,
    });
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

function collectDescendantIds(node: UserTreeNode): Set<string> {
  const ids = new Set<string>();
  const walk = (n: UserTreeNode) => {
    for (const child of n.children) {
      ids.add(child.id);
      walk(child);
    }
  };
  walk(node);
  return ids;
}

function findNode(nodes: UserTreeNode[], id: string): UserTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export function getValidParentOptions(
  tree: UserTreeNode[],
  editingUserId?: string,
): FlatTreeOption[] {
  const all = flattenTree(tree);
  if (!editingUserId) return all;

  const selfNode = findNode(tree, editingUserId);
  const exclude = new Set<string>([editingUserId]);
  if (selfNode) {
    collectDescendantIds(selfNode).forEach((id) => exclude.add(id));
  }

  return all.filter((opt) => !exclude.has(opt.id));
}

export function collectRootIds(nodes: UserTreeNode[]): string[] {
  return nodes.map((n) => n.id);
}
