import apiClient from '@/lib/apiClient';

export interface UserBrief {
  id: string;
  full_name: string;
  email: string;
  user_type: string;
}

export async function getAssignableUsers(): Promise<UserBrief[]> {
  const res = await apiClient.get<UserBrief[]>('/users/assignable');
  return res.data ?? [];
}
