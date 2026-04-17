'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { extractErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui';

interface CreateTaskModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// EXACT STRINGS - DO NOT MODIFY
const URGENCY_OPTIONS = [
  "Urgent & Important",
  "Urgent",
  "Important",
  "Not Urgent & Not Important"
];

export default function CreateTaskModal({ onClose, onSuccess }: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Data Sources
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]); // UI Convenience only
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    company_id: '', // Fetched dynamically
    department: '',
    urgency_label: '', // NO DEFAULT - User must select
    start_date: new Date().toISOString().split('T')[0],
    deadline: '',
    assigned_user_id: '',
    assigned_team_id: '',
  });

  const [assignType, setAssignType] = useState<'user' | 'team'>('user');

  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentStatuses, setAttachmentStatuses] = useState<Array<'idle' | 'uploading' | 'done' | 'error'>>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const [uploadAttachmentsPhase, setUploadAttachmentsPhase] = useState(false);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const fetchDependencies = async () => {
    try {
      const [companiesRes, departmentsRes, usersRes, teamsRes] = await Promise.all([
        apiClient.get('/companies?page=1&page_size=100'),
        apiClient.get('/departments'),
        apiClient.get('/admin/users'), 
        apiClient.get('/teams'),
      ]);

      setCompanies(companiesRes.data.companies || []);
      const departmentsData = Array.isArray(departmentsRes.data)
        ? departmentsRes.data
        : (departmentsRes.data.departments || []);
      setDepartments(departmentsData);
      setUsers(usersRes.data.users || []);
      setTeams(teamsRes.data.teams || []);

      // Auto-select first department if available
      if (departmentsData.length > 0) {
        setFormData(prev => ({ ...prev, department: departmentsData[0].name }));
      }

    } catch (err) {
      console.error('Failed to fetch dependencies:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title) {
        toast.error('Title is required');
        return;
    }
    if (!formData.start_date || !formData.deadline) {
        toast.error('Start date and deadline are required');
        return;
    }
    // Date Validation
    if (new Date(formData.deadline) < new Date(formData.start_date)) {
        toast.error('Deadline cannot be before start date');
        return;
    }

    if (!formData.urgency_label) {
        toast.error('Please select an Urgency level');
        return;
    }
    
    // Check Assignment XOR
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
      setUploadAttachmentsPhase(false);

      const payload = {
          title: formData.title,
          description: formData.description,
          company_id: formData.company_id || null,
          department: formData.department,
          urgency_label: formData.urgency_label,
          start_date: formData.start_date,
          deadline: formData.deadline,
          // STRICT XOR: One is UUID, other is NULL.
          assigned_user_id: assignType === 'user' ? formData.assigned_user_id : null,
          assigned_team_id: assignType === 'team' ? formData.assigned_team_id : null,
          // NO owner_user_id sent
      };

      const createRes = await apiClient.post<{ id: string }>('/tasks', payload);
      const newTaskId = createRes.data.id;
      toast.success('Task created successfully');

      if (attachmentFiles.length > 0) {
        setUploadAttachmentsPhase(true);
        for (let i = 0; i < attachmentFiles.length; i++) {
          setAttachmentStatuses((prev) => {
            const next = [...prev];
            next[i] = 'uploading';
            return next;
          });
          try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', attachmentFiles[i]);
            await apiClient.post(`/tasks/${newTaskId}/documents`, formDataUpload, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            setAttachmentStatuses((prev) => {
              const next = [...prev];
              next[i] = 'done';
              return next;
            });
          } catch (uploadErr) {
            const msg = getErrorMessage(uploadErr, 'Upload failed');
            setAttachmentStatuses((prev) => {
              const next = [...prev];
              next[i] = 'error';
              return next;
            });
            setAttachmentErrors((prev) => {
              const next = [...prev];
              next[i] = msg;
              return next;
            });
          }
        }
        setUploadAttachmentsPhase(false);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const message = extractErrorMessage(err?.response?.data);
      toast.error(message === 'An error occurred' ? 'Failed to create task' : message);
    } finally {
      setLoading(false);
      setUploadAttachmentsPhase(false);
    }
  };

  if (initialLoading) {
      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-6 shadow-xl">
                  <div className="animate-spin h-6 w-6 border-2 border-primary-gold border-t-transparent rounded-full"></div>
              </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden">
      <div className="bg-white shadow-2xl w-full max-w-2xl mx-auto rounded-xl flex flex-col max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white sm:rounded-t-xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Create New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6 pb-28 sm:pb-6">
            
            {companies.length === 0 && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                    Warning: No companies found. Task creation may fail. Contact admin.
                </div>
            )}

            {/* Title */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g., Review Q3 Financials"
                />
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Add details..."
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                     <select
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all bg-white"
                        value={formData.company_id}
                        onChange={e => setFormData({...formData, company_id: e.target.value})}
                     >
                        <option value="">No Company</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                     </select>
                </div>

                {/* Department */}
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Department{departments.length > 0 ? ' *' : ''}
                     </label>
                     <select
                        required={departments.length > 0}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all bg-white"
                        value={formData.department}
                        onChange={e => setFormData({...formData, department: e.target.value})}
                     >
                        {departments.length === 0 ? (
                          <option value="" disabled>No departments available</option>
                        ) : (
                          departments.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))
                        )}
                     </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Start Date */}
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                        type="date"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                        value={formData.start_date}
                        onChange={e => setFormData({...formData, start_date: e.target.value})}
                    />
                </div>

                {/* Deadline */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                    <input
                        type="date"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                        value={formData.deadline}
                        onChange={e => setFormData({...formData, deadline: e.target.value})}
                    />
                </div>
            </div>

            {/* Urgency */}
            <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Urgency Level *</label>
                 <select
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all bg-white"
                    value={formData.urgency_label}
                    onChange={e => setFormData({...formData, urgency_label: e.target.value})}
                 >
                    <option value="" disabled>Select Urgency...</option>
                    {URGENCY_OPTIONS.map(u => (
                        <option key={u} value={u}>{u}</option>
                    ))}
                 </select>
            </div>

            {/* Assignment XOR - STRICT IMPLEMENTATION */}
            <div className="border rounded-xl p-4 bg-gray-50/50">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Assignment Target</label>
                
                {/* Exact Toggle Selector */}
                <div className="flex bg-white rounded-lg p-1 border border-gray-200 mb-4 shadow-sm w-fit">
                    <button
                        type="button"
                        onClick={() => {
                            setAssignType('user');
                            setFormData(prev => ({ ...prev, assigned_team_id: '' })); // Clear team
                        }}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                            assignType === 'user' 
                            ? 'bg-primary-gold text-white shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Assign to User
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setAssignType('team');
                            setFormData(prev => ({ ...prev, assigned_user_id: '' })); // Clear user
                        }}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                            assignType === 'team' 
                            ? 'bg-primary-gold text-white shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Assign to Team
                    </button>
                </div>

                {/* Conditional Rendering - Only ONE exists in DOM */}
                {assignType === 'user' && (
                    <div className="animate-fadeIn">
                         <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Select User</label>
                        <select
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all bg-white"
                            value={formData.assigned_user_id}
                            onChange={e => setFormData({...formData, assigned_user_id: e.target.value})}
                        >
                            <option value="">Select User...</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.username})</option>
                            ))}
                        </select>
                    </div>
                )}

                {assignType === 'team' && (
                    <div className="animate-fadeIn">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Select Team</label>
                        <select
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all bg-white"
                            value={formData.assigned_team_id}
                            onChange={e => setFormData({...formData, assigned_team_id: e.target.value})}
                        >
                            <option value="">Select Team...</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Attachments (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attachments (optional)</label>
              <input
                type="file"
                multiple
                accept="*"
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                onChange={(e) => {
                  const list = e.target.files;
                  if (!list?.length) {
                    setAttachmentFiles([]);
                    setAttachmentStatuses([]);
                    setAttachmentErrors([]);
                    return;
                  }
                  const arr = Array.from(list);
                  setAttachmentFiles(arr);
                  setAttachmentStatuses(arr.map(() => 'idle'));
                  setAttachmentErrors(arr.map(() => ''));
                }}
              />
              {attachmentFiles.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm">
                  {attachmentFiles.map((file, i) => (
                    <li key={`${file.name}-${i}`} className="flex flex-wrap items-center gap-2 text-gray-800">
                      <span className="truncate flex-1 min-w-0" title={file.name}>
                        {file.name}
                      </span>
                      {attachmentStatuses[i] === 'uploading' && (
                        <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                          <span className="inline-block h-3.5 w-3.5 border-2 border-primary-gold border-t-transparent rounded-full animate-spin" />
                          Uploading…
                        </span>
                      )}
                      {attachmentStatuses[i] === 'done' && (
                        <span className="text-xs text-green-600">Uploaded</span>
                      )}
                      {attachmentStatuses[i] === 'error' && attachmentErrors[i] && (
                        <span className="text-xs text-red-600">{attachmentErrors[i]}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

        </div>

        {/* Footer */}
        <div className="fixed inset-x-0 bottom-0 p-4 border-t border-gray-100 bg-white z-10 flex flex-col-reverse gap-2 sm:static sm:p-6 sm:flex-row sm:justify-end sm:gap-3 sm:rounded-b-xl">
            <Button variant="outline" onClick={onClose} type="button" disabled={loading} className="w-full sm:w-auto">
                Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={loading} type="submit" className="w-full sm:w-auto">
                {loading
                  ? uploadAttachmentsPhase
                    ? 'Uploading attachments...'
                    : 'Creating...'
                  : 'Create Task'}
            </Button>
        </div>

      </div>
    </div>
  );
}
