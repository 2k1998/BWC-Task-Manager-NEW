'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { Button } from '@/components/ui';
import type { Task, TaskDocumentAttachment } from '@/lib/types';

interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

const URGENCY_OPTIONS = [
  'Urgent & Important',
  'Urgent',
  'Important',
  'Not Urgent & Not Important',
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export default function EditTaskModal({ task, onClose, onSuccess }: EditTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [completedBanner, setCompletedBanner] = useState('');
  const [attachments, setAttachments] = useState<TaskDocumentAttachment[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    company_id: task.company_id || '',
    department: (task as any).department || '',
    priority: (task as any).priority || '',
    urgency_label: (task as any).urgency_label || task.urgency || '',
    start_date: ((task as any).start_date || '').split('T')[0],
    deadline: (task.deadline || '').split('T')[0],
    assigned_user_id: (task as any).assigned_user_id || task.assigned_to_user_id || '',
    assigned_team_id: (task as any).assigned_team_id || task.assigned_to_team_id || '',
  });

  const [assignType, setAssignType] = useState<'user' | 'team'>(
    ((task as any).assigned_team_id || task.assigned_to_team_id) ? 'team' : 'user'
  );

  const isCompleted = useMemo(() => String(task.status || '').toLowerCase() === 'completed', [task.status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const fetchDependencies = async () => {
    try {
      const [companiesRes, departmentsRes, usersRes, teamsRes, attachmentsRes] = await Promise.all([
        apiClient.get('/companies?page=1&page_size=100'),
        apiClient.get('/admin/departments'),
        apiClient.get('/users'),
        apiClient.get('/teams'),
        apiClient.get(`/tasks/${task.id}/documents`),
      ]);

      const sortedCompanies = [...(companiesRes.data.companies || [])].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''))
      );
      setCompanies(sortedCompanies);
      setDepartments(departmentsRes.data.departments || []);
      setUsers(usersRes.data.users || []);
      setTeams(teamsRes.data.teams || []);
      setAttachments(attachmentsRes.data || []);
    } catch {
      toast.error('Failed to load edit form data');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompleted) return;

    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    if (!formData.company_id || !formData.department || !formData.priority || !formData.urgency_label) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!formData.start_date || !formData.deadline) {
      toast.error('Start date and deadline are required');
      return;
    }
    if (new Date(formData.deadline) < new Date(formData.start_date)) {
      toast.error('Deadline cannot be before start date');
      return;
    }
    if (assignType === 'user' && !formData.assigned_user_id) {
      toast.error('Please select a user');
      return;
    }
    if (assignType === 'team' && !formData.assigned_team_id) {
      toast.error('Please select a team');
      return;
    }

    try {
      setLoading(true);
      setCompletedBanner('');

      const payload = {
        title: formData.title,
        description: formData.description || null,
        company_id: formData.company_id,
        department: formData.department,
        priority: formData.priority,
        urgency_label: formData.urgency_label,
        start_date: formData.start_date,
        deadline: formData.deadline,
        assigned_user_id: assignType === 'user' ? formData.assigned_user_id : null,
        assigned_team_id: assignType === 'team' ? formData.assigned_team_id : null,
      };

      await apiClient.put(`/tasks/${task.id}`, payload);
      toast.success('Task updated successfully');
      await onSuccess();
      onClose();
    } catch (err: any) {
      const statusCode = err?.response?.status;
      const detail = err?.response?.data?.detail;

      if (statusCode === 400 && detail === 'Completed tasks cannot be edited.') {
        setCompletedBanner('Completed tasks cannot be edited.');
      } else if (statusCode === 403) {
        toast.error("You don't have permission to edit this task");
      } else {
        toast.error('Failed to update task. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 shadow-xl">
          <div className="animate-spin h-6 w-6 border-2 border-primary-gold border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white shadow-2xl w-full h-full rounded-none sm:rounded-xl sm:max-w-2xl sm:h-auto flex flex-col sm:max-h-[90vh]">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white sm:rounded-t-xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Edit Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6 pb-28 sm:pb-6">
          {(isCompleted || completedBanner) && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg px-4 py-3 text-sm">
              Completed tasks cannot be edited.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
            <input
              type="text"
              required
              disabled={isCompleted}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              disabled={isCompleted}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
              <select
                required
                disabled={isCompleted}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              >
                <option value="" disabled>Select company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
              <input
                type="text"
                list="edit-dept-suggestions"
                required
                disabled={isCompleted}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
              <datalist id="edit-dept-suggestions">
                {departments.map((d) => (
                  <option key={d.id} value={d.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
              <select
                required
                disabled={isCompleted}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="" disabled>Select priority...</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urgency Level *</label>
              <select
                required
                disabled={isCompleted}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                value={formData.urgency_label}
                onChange={(e) => setFormData({ ...formData, urgency_label: e.target.value })}
              >
                <option value="" disabled>Select urgency...</option>
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                disabled={isCompleted}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
              <input
                type="date"
                required
                disabled={isCompleted}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />
            </div>
          </div>

          <div className="border rounded-xl p-4 bg-gray-50/50">
            <label className="block text-sm font-semibold text-gray-900 mb-3">Assignment</label>
            <div className="flex bg-white rounded-lg p-1 border border-gray-200 mb-4 shadow-sm w-fit">
              <button
                type="button"
                disabled={isCompleted}
                onClick={() => {
                  setAssignType('user');
                  setFormData((prev) => ({ ...prev, assigned_team_id: '' }));
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  assignType === 'user' ? 'bg-primary-gold text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Assign to User
              </button>
              <button
                type="button"
                disabled={isCompleted}
                onClick={() => {
                  setAssignType('team');
                  setFormData((prev) => ({ ...prev, assigned_user_id: '' }));
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  assignType === 'team' ? 'bg-primary-gold text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Assign to Team
              </button>
            </div>

            {assignType === 'user' ? (
              <select
                required
                disabled={isCompleted}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                value={formData.assigned_user_id}
                onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
              >
                <option value="">Select user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.username})</option>
                ))}
              </select>
            ) : (
              <select
                required
                disabled={isCompleted}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                value={formData.assigned_team_id}
                onChange={(e) => setFormData({ ...formData, assigned_team_id: e.target.value })}
              >
                <option value="">Select team...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="border rounded-xl p-4 bg-gray-50/50">
            <label className="block text-sm font-semibold text-gray-900 mb-3">Attachments</label>
            {attachments.length === 0 ? (
              <p className="text-sm text-gray-500">No attachments</p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-700">
                {attachments.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.filename}</span>
                    <span className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>

        <div className="fixed inset-x-0 bottom-0 p-4 border-t border-gray-100 bg-white z-10 flex flex-col-reverse gap-2 sm:static sm:p-6 sm:flex-row sm:justify-end sm:gap-3 sm:rounded-b-xl">
          <Button variant="outline" onClick={onClose} type="button" disabled={loading} className="w-full sm:w-auto">
            {isCompleted ? 'Close' : 'Cancel'}
          </Button>
          {!isCompleted && (
            <Button variant="primary" onClick={handleSubmit} disabled={loading} type="submit" className="w-full sm:w-auto">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
