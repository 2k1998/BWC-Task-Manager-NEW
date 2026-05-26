'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import TaskAttachmentsSection from '@/components/TaskAttachmentsSection';
import TaskComments from '@/components/tasks/TaskComments';
import { Button, LoadingSkeleton, Modal } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useHasPermission } from '@/hooks/useHasPermission';
import { getValidNextStatuses, isTerminalStatus } from '@/lib/taskLifecycle';
import type { Task } from '@/lib/types';
import { extractErrorMessage } from '@/lib/utils';

const URGENCY_OPTIONS = [
  'Urgent & Important',
  'Urgent',
  'Important',
  'Not Urgent & Not Important',
];

interface TaskDetailModalProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
  onTaskDeleted?: (taskId: string) => void;
}

type LookupTeam = { id: string; name: string; head_user_id?: string };

const UNKNOWN_USER = 'Unknown User';

function normalizeStatus(status: string): string {
  return status ?? '';
}

export default function TaskDetailModal({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailModalProps) {
  const tCommon = useTranslations('Common');
  const { user: currentUser } = useAuth();
  const canEditTasks = useHasPermission('tasks', 'edit');
  const canDeleteTasks = useHasPermission('tasks', 'delete');

  const [task, setTask] = useState<Task | null>(null);
  const [teams, setTeams] = useState<LookupTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [draft, setDraft] = useState({
    title: '',
    description: '',
    status: '',
    urgency_label: '',
  });

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError('');
      const [taskRes, teamsRes] = await Promise.all([
        apiClient.get<Task>(`/tasks/${taskId}`),
        apiClient.get('/teams'),
      ]);
      const loaded = taskRes.data;
      setTask(loaded);
      setTeams(teamsRes.data.teams || []);
      const urgency = (loaded as Task & { urgency_label?: string }).urgency_label || loaded.urgency || '';
      setDraft({
        title: loaded.title || '',
        description: loaded.description || '',
        status: normalizeStatus(loaded.status),
        urgency_label: urgency,
      });
      setIsEditing(false);
    } catch (err: unknown) {
      const message = extractErrorMessage((err as { response?: { data?: unknown } })?.response?.data);
      const resolved = message === 'An error occurred' ? 'Failed to load task' : message;
      setError(resolved);
      setTask(null);
      toast.error(resolved);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTask();
    }
    if (!isOpen) {
      setTask(null);
      setError('');
      setIsEditing(false);
    }
  }, [isOpen, taskId, fetchTask]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const normalizedStatus = task ? normalizeStatus(task.status) : '';
  const urgencyLabel = task
    ? (task as Task & { urgency_label?: string }).urgency_label || task.urgency || ''
    : '';
  const isCompleted = task ? isTerminalStatus(normalizedStatus) : false;

  const ownerId = task?.owner_user_id;
  const assignedUserId =
    task?.assigned_user_id ?? task?.assigned_to_user_id ?? null;
  const assignedTeamId =
    task?.assigned_team_id ?? task?.assigned_to_team_id ?? null;

  const canEditMetadata =
    !!task &&
    !!currentUser &&
    canEditTasks &&
    !isCompleted &&
    (currentUser.id === ownerId || currentUser.user_type === 'Admin');

  const canEditStatus = useMemo(() => {
    if (!task || !currentUser || isCompleted) return false;
    if (currentUser.user_type === 'Admin') return true;
    if (assignedUserId && String(assignedUserId) === String(currentUser.id)) return true;
    if (assignedTeamId) {
      const team = teams.find((t) => String(t.id) === String(assignedTeamId));
      if (team?.head_user_id && String(team.head_user_id) === String(currentUser.id)) return true;
    }
    return false;
  }, [task, currentUser, isCompleted, assignedUserId, assignedTeamId, teams]);

  const canDelete =
    !!task &&
    !!currentUser &&
    canDeleteTasks &&
    (currentUser.id === ownerId || currentUser.user_type === 'Admin');

  const createdByName = useMemo(() => {
    if (task?.created_by_name?.trim()) return task.created_by_name.trim();
    if (!ownerId) return '-';
    return UNKNOWN_USER;
  }, [task?.created_by_name, ownerId]);

  const assignedToName = useMemo(() => {
    if (task?.assigned_user_name?.trim()) return task.assigned_user_name.trim();
    if (task?.assigned_team_name?.trim()) return `Team: ${task.assigned_team_name.trim()}`;
    if (assignedUserId || assignedTeamId) return UNKNOWN_USER;
    return '-';
  }, [
    task?.assigned_user_name,
    task?.assigned_team_name,
    assignedUserId,
    assignedTeamId,
  ]);

  const validNextStatuses = getValidNextStatuses(normalizedStatus);

  const handleSave = async () => {
    if (!task || !taskId) return;
    try {
      setSaving(true);
      const metadataChanged =
        draft.title !== task.title ||
        draft.description !== (task.description ?? '') ||
        draft.urgency_label !== urgencyLabel;
      const statusChanged = draft.status !== normalizedStatus;

      if (metadataChanged && canEditMetadata) {
        await apiClient.put(`/tasks/${taskId}`, {
          title: draft.title.trim(),
          description: draft.description || null,
          urgency_label: draft.urgency_label,
        });
      }

      if (statusChanged && canEditStatus) {
        await apiClient.put(`/tasks/${taskId}/status`, { status: draft.status });
      }

      toast.success('Task updated successfully');
      await fetchTask();
      onTaskUpdated?.();
      setIsEditing(false);
    } catch (err: unknown) {
      const message = extractErrorMessage((err as { response?: { data?: unknown } })?.response?.data);
      toast.error(message === 'An error occurred' ? 'Failed to update task' : message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!task) return;
    setDraft({
      title: task.title || '',
      description: task.description || '',
      status: normalizedStatus,
      urgency_label: urgencyLabel,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!task || !taskId) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/tasks/${taskId}`);
      toast.success('Task deleted successfully');
      setShowDeleteModal(false);
      onTaskDeleted?.(taskId);
      onClose();
    } catch {
      toast.error('Failed to delete task. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const readOnlyBox = 'px-3 py-2 bg-gray-50 rounded-md border border-gray-200 text-[15px] text-gray-900';
  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        aria-hidden
      />
      <div
        className="fixed top-0 right-0 h-full w-full max-w-[500px] bg-white shadow-xl z-[51] flex flex-col font-sans"
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 line-clamp-2 pr-2">
            {loading ? 'Loading…' : task?.title ?? 'Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon('close')}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 shrink-0">
          {!isEditing && (canEditMetadata || canEditStatus) && !isCompleted && (
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
          {isEditing && (
            <>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </Button>
            </>
          )}
          {canDelete && !isEditing && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteModal(true)}>
              Delete
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar text-[15px] text-gray-800">
          {loading && (
            <div className="space-y-4">
              <LoadingSkeleton variant="list" count={6} />
            </div>
          )}

          {!loading && error && (
            <p className="text-red-700 font-medium border border-red-200 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {!loading && task && (
            <div className="space-y-5">
              {isCompleted && (
                <p className="text-green-800 text-sm font-medium border border-green-200 bg-green-50 rounded-md px-3 py-2">
                  This task is completed and cannot be edited.
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                {isEditing && canEditMetadata ? (
                  <input
                    type="text"
                    className={inputClass}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                ) : (
                  <div className={readOnlyBox}>{task.title}</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                {isEditing && canEditMetadata ? (
                  <textarea
                    rows={4}
                    className={inputClass}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                ) : (
                  <div className={`${readOnlyBox} whitespace-pre-wrap`}>
                    {task.description || '—'}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {isEditing && canEditStatus ? (
                    <select
                      className={inputClass}
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                    >
                      <option value={draft.status}>{draft.status} (current)</option>
                      {validNextStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className={readOnlyBox}>{normalizedStatus}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                  {isEditing && canEditMetadata ? (
                    <select
                      className={inputClass}
                      value={draft.urgency_label}
                      onChange={(e) => setDraft({ ...draft, urgency_label: e.target.value })}
                    >
                      {URGENCY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className={readOnlyBox}>{urgencyLabel || '—'}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
                  <div className={readOnlyBox}>
                    {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                  <div className={readOnlyBox}>
                    {task.created_at ? new Date(task.created_at).toLocaleString() : '—'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned to</label>
                  <div className={readOnlyBox}>{assignedToName}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created by</label>
                  <div className={readOnlyBox}>{createdByName}</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden shadow-none">
                <TaskAttachmentsSection taskId={task.id} taskOwnerUserId={task.owner_user_id} />
              </div>

              {normalizedStatus !== 'New' && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Comments</h3>
                  <TaskComments taskId={task.id} taskStatus={normalizedStatus} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {task && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => !deleting && setShowDeleteModal(false)}
          title="Delete Task"
        >
          <p className="text-gray-700 mb-6 text-[15px]">
            Are you sure you want to delete &quot;{task.title}&quot;? This task will be removed from all views.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
