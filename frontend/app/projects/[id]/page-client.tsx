'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Card, Badge, Button, EmptyState } from '@/components/ui';
import ActivityTimeline from '@/components/ActivityTimeline';
import apiClient from '@/lib/apiClient';
import type { Project } from '@/lib/types';
import { extractErrorMessage } from '@/lib/utils';

const statusColorMap: Record<string, 'blue' | 'yellow' | 'green' | 'orange' | 'red'> = {
  'Planning': 'blue',
  'In Progress': 'yellow',
  'Completed': 'green',
  'On Hold': 'orange',
  'Cancelled': 'red',
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    fetchProject();
  }, [params.id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Project>(`/projects/${params.id}`);
      setProject(response.data);
    } catch (err: any) {
      const message = extractErrorMessage(err?.response?.data);
      const resolved = message === 'An error occurred' ? 'Failed to load project' : message;
      setError(resolved);
      toast.error(resolved);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!project) return;
    
    try {
      setUpdating(true);
      await apiClient.put(`/projects/${project.id}/status`, { status: newStatus });
      toast.success('Project status updated successfully');
      await fetchProject();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setCanEdit(false);
        toast.error('You do not have permission to edit this project');
      } else {
        const message = extractErrorMessage(err?.response?.data);
        toast.error(message === 'An error occurred' ? 'Failed to update status' : message);
      }
    } finally {
      setUpdating(false);
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

  if (!project) {
    return (
      <ProtectedLayout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <EmptyState
              icon={<span className="text-6xl">📁</span>}
              title="Project not found"
              description="The project you're looking for doesn't exist"
            />
          </Card>
        </div>
      </ProtectedLayout>
    );
  }

  const statuses = ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
  const statusColor = statusColorMap[project.status] || 'blue';

  // Calculate timeline progress
  const startDate = new Date(project.start_date);
  const endDate = new Date(project.expected_completion_date);
  const today = new Date();
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = today.getTime() - startDate.getTime();
  const progress = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);

  return (
    <ProtectedLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900"
        >
          ← Back to Projects
        </Button>

        {/* Main Project Card */}
        <Card>
          {/* Header Section */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <Badge variant="status" color={statusColor}>
                {project.status}
              </Badge>
            </div>
          </div>

          {/* Timeline Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Project Timeline</h3>
            <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                <span>{startDate.toLocaleDateString()}</span>
                <span className="font-semibold text-gray-900">{progress.toFixed(0)}% Complete</span>
                <span>{endDate.toLocaleDateString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-gold h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Ownership Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Project Team</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Project Owner</p>
                <p className="text-gray-900 font-medium">ID: {project.owner_user_id}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Project Manager</p>
                <p className="text-gray-900 font-medium">ID: {project.project_manager_user_id}</p>
              </div>
            </div>
          </div>

          {/* Project Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              {canEdit ? (
                <select
                  value={project.status}
                  onChange={(e) => handleStatusUpdate(e.target.value)}
                  disabled={updating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-base bg-white
                           focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent
                           disabled:bg-gray-50 disabled:text-gray-500 transition-colors duration-150"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 text-gray-600">
                  {project.status} (Read-only)
                </div>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                {project.project_type}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                {project.priority}
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                {project.budget_amount ? `$${project.budget_amount.toLocaleString()}` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <div className="px-4 py-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-900 leading-relaxed">{project.description}</p>
              </div>
            </div>
          )}

          {/* Location */}
          {(project.location_address || project.location_postcode) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <div className="px-4 py-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-900">
                  {project.location_address}
                  {project.location_postcode && `, ${project.location_postcode}`}
                </p>
              </div>
            </div>
          )}
        </Card>
        
        <ActivityTimeline entityType="Project" entityId={project.id} />
      </div>
    </ProtectedLayout>
  );
}
