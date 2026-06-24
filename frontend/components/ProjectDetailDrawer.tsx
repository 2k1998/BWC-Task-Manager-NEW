'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { LoadingSkeleton } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import type { Project } from '@/lib/types';
import { extractErrorMessage } from '@/lib/utils';

interface ProjectDetailDrawerProps {
  projectId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatBudget(value: number | null | undefined): string {
  if (value == null) return '—';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProjectDetailDrawer({
  projectId,
  isOpen,
  onClose,
}: ProjectDetailDrawerProps) {
  const tCommon = useTranslations('Common');
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get<Project>(`/projects/${projectId}`);
      setProject(response.data);
    } catch (err: unknown) {
      const message = extractErrorMessage((err as { response?: { data?: unknown } })?.response?.data);
      const resolved = message === 'An error occurred' ? 'Failed to load project' : message;
      setError(resolved);
      setProject(null);
      toast.error(resolved);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchProject();
    }
    if (!isOpen) {
      setProject(null);
      setError('');
    }
  }, [isOpen, projectId, fetchProject]);

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

  if (!isOpen) return null;

  const readOnlyBox = 'px-3 py-2 bg-gray-50 rounded-md border border-gray-200 text-[15px] text-gray-900';
  const locationParts = [project?.location_address, project?.location_postcode].filter(Boolean);
  const locationLabel = locationParts.length > 0 ? locationParts.join(', ') : '—';

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
        aria-label="Project details"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 line-clamp-2 pr-2">
            {loading ? 'Loading…' : project?.name ?? 'Project'}
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

        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar text-[15px] text-gray-800">
          {loading && (
            <div className="space-y-4">
              <LoadingSkeleton variant="list" count={6} />
            </div>
          )}

          {!loading && error && (
            <p className="text-red-700 font-medium border border-red-200 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {!loading && project && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <div className={readOnlyBox}>{project.name}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                  <div className={readOnlyBox}>{project.project_type || '—'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div className={readOnlyBox}>{project.status || '—'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <div className={readOnlyBox}>{project.priority || '—'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <div className={readOnlyBox}>{project.company_id || '—'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget Amount</label>
                  <div className={readOnlyBox}>{formatBudget(project.budget_amount)}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <div className={readOnlyBox}>{formatDate(project.start_date)}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Completion Date</label>
                  <div className={readOnlyBox}>{formatDate(project.expected_completion_date)}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <div className={`${readOnlyBox} whitespace-pre-wrap`}>{project.description || '—'}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <div className={readOnlyBox}>{locationLabel}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
