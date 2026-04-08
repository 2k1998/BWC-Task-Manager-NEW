import apiClient from '@/lib/apiClient';
import type { TaskComment } from '@/lib/types';

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const res = await apiClient.get<TaskComment[]>(`/tasks/${taskId}/comments`);
  return res.data ?? [];
}

export async function createTaskComment(taskId: string, body: string): Promise<TaskComment> {
  const res = await apiClient.post<TaskComment>(`/tasks/${taskId}/comments`, { body });
  return res.data;
}
