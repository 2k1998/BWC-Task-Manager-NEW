'use client';

import React, { useState } from 'react';
import { Task, User } from '@/lib/types';
import { getValidNextStatuses } from '@/lib/taskLifecycle';
import { Card, Badge, Button, Modal } from '@/components/ui';
import { toast } from 'sonner';
import Link from 'next/link';
import EditTaskModal from '@/components/modals/EditTaskModal';
import apiClient from '@/lib/apiClient';
import { getUrgencyDotColor } from '@/lib/urgencyFilter';

interface TaskBoardProps {
  tasks: Task[];
  currentUser: User | null;
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  onTaskRefresh: () => Promise<void>;
}

const COLUMNS = [
  'New',
  'Received',
  'On Process',
  'Pending',
  'Loose End',
  'Completed',
];

export default function TaskBoard({ tasks, currentUser, onStatusChange, onTaskRefresh }: TaskBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const tasksByStatus = COLUMNS.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status);
    return acc;
  }, {} as Record<string, Task[]>);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task) return;

    if (task.status === targetStatus) {
      setDraggedTaskId(null);
      return;
    }

    const validNext = getValidNextStatuses(task.status);
    if (!validNext.includes(targetStatus)) {
      toast.error(`Invalid transition: Cannot move from ${task.status} to ${targetStatus}`);
      setDraggedTaskId(null);
      return;
    }

    try {
      await onStatusChange(task.id, targetStatus);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    } finally {
      setDraggedTaskId(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] overflow-x-auto gap-4 md:gap-6 pb-4 px-2">
      {COLUMNS.map((status) => (
        <div
          key={status}
          className={`flex-shrink-0 min-w-[18rem] w-[18rem] md:w-80 flex flex-col h-full bg-gray-50/50 rounded-xl border border-gray-200/50 ${
            status === 'Completed' ? 'opacity-60 bg-gray-100/50' : ''
          }`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, status)}
        >
          <div className="p-4 border-b border-gray-200/50 flex items-center justify-between sticky top-0 bg-inherit rounded-t-xl z-10 backdrop-blur-sm">
            <h3 className="font-semibold text-gray-700">{status}</h3>
            <Badge variant="status" color="gray">
              {tasksByStatus[status]?.length || 0}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {tasksByStatus[status]?.map((task) => (
              <BoardCard
                key={task.id}
                task={task}
                currentUser={currentUser}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onStatusChange={onStatusChange}
                onTaskRefresh={onTaskRefresh}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BoardCard({
  task,
  currentUser,
  onDragStart,
  onStatusChange,
  onTaskRefresh,
}: {
  task: Task;
  currentUser: User | null;
  onDragStart: (e: React.DragEvent) => void;
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  onTaskRefresh: () => Promise<void>;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusUpdate = async (e: React.MouseEvent, newStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    
    if (task.status === newStatus || !onStatusChange) return;
    
    try {
      setIsUpdating(true);
      await onStatusChange(task.id, newStatus);
    } catch (error) {
       console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };
  const urgencyLabel =
    (task as any).urgency_label || (task as any).urgency || 'Unknown';
  const urgencyColorMap: Record<string, 'red' | 'blue' | 'green' | 'yellow' | 'orange'> = {
    'Urgent & Important': 'red',
    Urgent: 'blue',
    Important: 'green',
    'Not Urgent & Not Important': 'yellow',
    'By the end of day': 'orange',
    Orange: 'orange',
    'Same-day auto': 'orange',
  };
  const color = urgencyColorMap[urgencyLabel] || 'gray';
  const urgencyDot = getUrgencyDotColor(urgencyLabel) || '#9CA3AF';

  // Authority Zones logic
  let visualEmphasis = 'opacity-100 shadow-sm';
  let badge = null;

  if (currentUser) {
    if (task.assigned_to_user_id === currentUser.id) {
       // My Active Responsibility - Strong emphasis
       visualEmphasis = 'opacity-100 ring-1 ring-primary-gold/30 bg-white';
       badge = <Badge variant="role">Assignee</Badge>;
    } else if ((task as any).owner_user_id === currentUser.id) {
       // My Delegated Work - Softer
       visualEmphasis = 'opacity-85 hover:opacity-100 bg-gray-50/50';
       badge = <Badge variant="role">Owner</Badge>;
    } else {
       // Viewer - Lowest emphasis
       visualEmphasis = 'opacity-70 hover:opacity-100 grayscale-[0.3] hover:grayscale-0 bg-gray-50';
       badge = <Badge variant="role">Viewer</Badge>;
    }
  }

  const canEditOrDelete =
    !!currentUser && (
      currentUser.id === (task as any).owner_user_id ||
      currentUser.user_type === 'Admin'
    );

  const handleDeleteTask = async () => {
    try {
      setDeleting(true);
      await apiClient.delete(`/tasks/${task.id}`);
      setShowDeleteModal(false);
      toast.success('Task deleted successfully');
      await onTaskRefresh();
    } catch {
      toast.error('Failed to delete task. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        className={`relative group cursor-grab active:cursor-grabbing transition-all duration-200 ${visualEmphasis}`}
      >
        <Link href={`/tasks/${task.id}`} className="block">
          <Card
            variant="highlight"
            urgencyColor={color}
            className="!p-4 hover:shadow-md transition-all border-0 ring-1 ring-black/5"
          >
          <div className="mb-3">
            <p className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-primary-dark transition-colors">
              {task.title}
            </p>
            <p className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-600">
              <span
                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: urgencyDot }}
              />
              <span className="truncate">{urgencyLabel}</span>
            </p>
          </div>
          
          <div className="flex items-center justify-between text-xs relative">
            <div className="flex flex-col">
              {task.deadline && (
                <span className={`font-medium ${
                  new Date(task.deadline) < new Date() ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
             
             <div className="flex items-center gap-2">
               {badge}

              {canEditOrDelete && (
                <div ref={menuRef} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
                      className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                      aria-label="Actions"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>

                    {showMenu && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowMenu(false);
                            setShowEditModal(true);
                          }}
                          className="w-full text-left px-4 py-1.5 text-xs text-gray-700 hover:bg-gray-50 hover:text-brand-brown"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowMenu(false);
                            setShowDeleteModal(true);
                          }}
                          className="w-full text-left px-4 py-1.5 text-xs text-danger hover:bg-gray-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
              )}
             </div>
          </div>
          </Card>
        </Link>
      </div>

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
            Delete
          </Button>
        </div>
      </Modal>

      {showEditModal && (
        <EditTaskModal
          task={task}
          onClose={() => setShowEditModal(false)}
          onSuccess={onTaskRefresh}
        />
      )}
    </>
  );
}
