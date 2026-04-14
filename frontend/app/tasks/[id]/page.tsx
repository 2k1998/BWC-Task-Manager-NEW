'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import TransferTaskModal from '@/components/TransferTaskModal';
import EditTaskModal from '@/components/modals/EditTaskModal';
import ActivityTimeline from '@/components/ActivityTimeline';
import TaskAttachmentsSection from '@/components/TaskAttachmentsSection';
import TaskComments from '@/components/tasks/TaskComments';
import { Card, Badge, Button, Modal } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { getValidNextStatuses, isTerminalStatus } from '@/lib/taskLifecycle';
import { useAuth } from '@/context/AuthContext';
import type { Task, User } from '@/lib/types';
import { extractErrorMessage } from '@/lib/utils';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [subordinates, setSubordinates] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchTask();
    fetchSubordinates();
  }, [params.id]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Task>(`/tasks/${params.id}`);
      setTask(response.data);
    } catch (err: any) {
      const message = extractErrorMessage(err?.response?.data);
      const resolved = message === 'An error occurred' ? 'Failed to load task' : message;
      setError(resolved);
      toast.error(resolved);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubordinates = async () => {
    try {
      const response = await apiClient.get('/admin/users');
      const allUsers = response.data.users || [];
      const subs = allUsers.filter((u: any) => u.manager_id === currentUser?.id);
      setSubordinates(subs);
    } catch (err) {
      console.error('Failed to load subordinates');
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!task) return;
    
    try {
      setUpdating(true);
      await apiClient.put(`/tasks/${task.id}/status`, { status: newStatus });
      toast.success('Task status updated successfully');
      await fetchTask();
    } catch (err: any) {
      const message = extractErrorMessage(err?.response?.data);
      toast.error(message === 'An error occurred' ? 'Failed to update status' : message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/tasks/${task.id}`);
      setShowDeleteModal(false);
      toast.success('Task deleted successfully');
      router.push('/tasks');
    } catch {
      toast.error('Failed to delete task. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <div className="max-w-4xl mx-auto">
          <Card variant="highlight" urgencyColor="red">
            <p className="text-red-700 font-medium">{error}</p>
          </Card>
        </div>
      </ProtectedLayout>
    );
  }

  if (!task) {
    return (
      <ProtectedLayout>
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500">Task not found</p>
        </div>
      </ProtectedLayout>
    );
  }

  const validNextStatuses = getValidNextStatuses(task.status);
  const isCompleted = isTerminalStatus(task.status);
  const urgencyLabel = (task as any).urgency_label || task.urgency;
  const canEditOrDelete =
    !!currentUser && (
      currentUser.id === task.owner_user_id ||
      currentUser.user_type === 'Admin'
    );

  // Determine user role
  let userRole = 'Viewer';
  if (currentUser) {
    if (task.owner_user_id === currentUser.id) {
      userRole = 'Owner';
    } else if (task.assigned_to_user_id === currentUser.id) {
      userRole = 'Assignee';
    } else if (task.assigned_to_team_id && (currentUser as any).is_team_head) {
      userRole = 'Assignee (Team Head)';
    }
  }

  // Map urgency to color
  const urgencyColorMap: Record<string, 'red' | 'blue' | 'green' | 'yellow' | 'orange'> = {
    'Urgent & Important': 'red',
    'Urgent': 'blue',
    'Important': 'green',
    'Not Urgent & Not Important': 'yellow',
    'Same-day auto': 'orange',
  };

  const urgencyColor = urgencyColorMap[urgencyLabel] || 'gray';

  return (
    <ProtectedLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900"
        >
          ← Back to Tasks
        </Button>

        {/* Completed Task Notice */}
        {isCompleted && (
          <Card variant="highlight" urgencyColor="green">
            <p className="text-green-800 font-medium">
              ✓ This task is completed and cannot be edited.
            </p>
          </Card>
        )}

        {/* Main Task Card */}
        <Card>
          {/* Header Section */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
              <div className="flex items-center gap-2">
                {canEditOrDelete && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
                      Edit Task
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setShowDeleteModal(true)}>
                      Delete Task
                    </Button>
                  </>
                )}
                <Badge variant="urgency" color={urgencyColor}>
                  {urgencyLabel}
                </Badge>
              </div>
            </div>
            <Badge variant="role">Your Role: {userRole}</Badge>
          </div>

          {/* Task Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              {isCompleted ? (
                <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900 font-medium border border-gray-200">
                  {task.status}
                </div>
              ) : (
                <div>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusUpdate(e.target.value)}
                    disabled={updating}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-base bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent
                             disabled:bg-gray-50 disabled:text-gray-500 transition-colors duration-150"
                  >
                    <option value={task.status} disabled>
                      {task.status} (current)
                    </option>
                    {validNextStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  {!isCompleted && validNextStatuses.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">No valid transitions available</p>
                  )}
                </div>
              )}
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                {task.urgency}
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                {new Date(task.deadline).toLocaleDateString()}
              </div>
            </div>

            {/* Created */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Created</label>
              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                {new Date(task.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <div className="px-4 py-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-900 leading-relaxed">{task.description}</p>
              </div>
            </div>
          )}

          {/* Assignment Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Assignment</h3>
            <div className="space-y-2">
              {task.assigned_to_user_id && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Assigned to User:</span> {task.assigned_to_user_id}
                </p>
              )}
              {task.assigned_to_team_id && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Assigned to Team:</span> {task.assigned_to_team_id}
                </p>
              )}
              {!task.assigned_to_user_id && !task.assigned_to_team_id && (
                <p className="text-sm text-gray-500">Not assigned</p>
              )}
            </div>
          </div>

          {/* Transfer Task Button - Phase 4 Strict Rule */}
          {!isCompleted && urgencyLabel === 'Not Urgent & Not Important' && subordinates.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <Button
                variant="primary"
                onClick={() => setShowTransferModal(true)}
              >
                Transfer Task
              </Button>
              <p className="mt-2 text-xs text-gray-500">
                You can transfer this low-urgency task to your direct subordinates.
              </p>
            </div>
          )}
        </Card>

        <TaskAttachmentsSection taskId={task.id} taskOwnerUserId={task.owner_user_id} />

        {task.status !== 'New' && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Comments</h3>
            <TaskComments taskId={task.id} taskStatus={task.status} />
          </div>
        )}
      </div>

      {showTransferModal && (
        <TransferTaskModal
          taskId={task.id}
          taskTitle={task.title}
          urgencyLabel={urgencyLabel}
          subordinates={subordinates}
          onClose={() => setShowTransferModal(false)}
          onSuccess={fetchTask}
        />
      )}

      <Modal
        isOpen={showDeleteModal}
        onClose={() => !deleting && setShowDeleteModal(false)}
        title="Delete Task"
      >
        <p className="text-gray-700 mb-6">
          Are you sure you want to delete "{task.title}"? This task will be removed from all views.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteTask} disabled={deleting}>
            {deleting ? 'Delete' : 'Delete'}
          </Button>
        </div>
      </Modal>

      {showEditModal && (
        <EditTaskModal
          task={task}
          onClose={() => setShowEditModal(false)}
          onSuccess={fetchTask}
        />
      )}

      <ActivityTimeline entityType="Task" entityId={task.id} />
    </ProtectedLayout>
  );
}
