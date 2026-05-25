/** Query params for optional admin branch filtering on list endpoints. */
export function branchQueryParams(
  selectedBranchUserId: string | null | undefined
): Record<string, string> {
  if (!selectedBranchUserId) return {};
  return { branch_user_id: selectedBranchUserId };
}
