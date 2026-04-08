'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectModal from '@/components/modals/CreateProjectModal';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { ProjectListResponse, Company } from '@/lib/types';
import { Button, LoadingSkeleton, ErrorState, EmptyState } from '@/components/ui';
import { getSavedViews, saveView, deleteView, type SavedView } from '@/lib/savedViews';

function ProjectsPageContent() {
  const [projects, setProjects] = useState<ProjectListResponse | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [companyFilter, setCompanyFilter] = useState(searchParams.get('company_id') || '');
  
  // Saved Views State
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [isSavingView, setIsSavingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  useEffect(() => {
    setSavedViews(getSavedViews('projects'));
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowCreateModal(true);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('action');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchProjects();
    fetchCompanies();
  }, [statusFilter, companyFilter]);

  // Sync filters to URL
  useEffect(() => {
    const newUrl = new URL(window.location.href);
    let changed = false;

    if (statusFilter !== (searchParams.get('status') || '')) {
      if (statusFilter) newUrl.searchParams.set('status', statusFilter);
      else newUrl.searchParams.delete('status');
      changed = true;
    }

    if (companyFilter !== (searchParams.get('company_id') || '')) {
      if (companyFilter) newUrl.searchParams.set('company_id', companyFilter);
      else newUrl.searchParams.delete('company_id');
      changed = true;
    }

    if (changed) {
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [statusFilter, companyFilter, router, searchParams]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, any> = { page: 1, page_size: 50 };
      if (statusFilter) params.status = statusFilter;
      if (companyFilter) params.company_id = companyFilter;

      const response = await apiClient.get<ProjectListResponse>('/projects', { params });
      setProjects(response.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load projects'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await apiClient.get('/companies');
      setCompanies(response.data.companies || []);
    } catch (err) {
      console.error('Failed to load companies');
    }
  };

  const saveCurrentView = () => {
    if (!newViewName.trim()) return;
    const newView = saveView('projects', newViewName.trim(), { status: statusFilter, company_id: companyFilter });
    setSavedViews(prev => [...prev, newView]);
    setIsSavingView(false);
    setNewViewName('');
  };

  const deleteViewItem = (id: string) => {
    deleteView('projects', id);
    setSavedViews(prev => prev.filter(v => v.id !== id));
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            <Button 
                variant="primary" 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Project
            </Button>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Saved Views:</span>
              <select
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-gold"
                onChange={(e) => {
                  const viewId = e.target.value;
                  if (!viewId) return;
                  const view = savedViews.find(v => v.id === viewId);
                  if (view) {
                    setStatusFilter(view.filters.status as string || '');
                    setCompanyFilter(view.filters.company_id as string || '');
                  }
                  e.target.value = ''; // Reset select after applying
                }}
                defaultValue=""
              >
                <option value="" disabled>Select a view...</option>
                {savedViews.map(view => (
                  <option key={view.id} value={view.id}>{view.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3 relative">
              {isSavingView ? (
                 <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      autoFocus
                      placeholder="Name this view..." 
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-gold"
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveCurrentView();
                        } else if (e.key === 'Escape') {
                          setIsSavingView(false);
                        }
                      }}
                    />
                    <Button variant="primary" className="py-1.5 text-xs px-3" onClick={saveCurrentView}>Save</Button>
                    <Button variant="secondary" className="py-1.5 text-xs px-3" onClick={() => setIsSavingView(false)}>Cancel</Button>
                 </div>
              ) : (
                 <Button variant="secondary" className="py-1.5 text-xs flex items-center gap-1.5" onClick={() => { setNewViewName(''); setIsSavingView(true); }}>
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                   Save Current View
                 </Button>
              )}
              {savedViews.length > 0 && (
                <div className="group relative">
                  <span className="text-xs text-red-500 cursor-pointer hover:underline px-2 block sm:inline">Delete lists</span>
                  <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48 py-1">
                     {savedViews.map(view => (
                       <button 
                         key={view.id} 
                         onClick={() => deleteViewItem(view.id)}
                         className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-red-600 flex justify-between items-center"
                       >
                         {view.name}
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                     ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none"
              >
                <option value="">All Statuses</option>
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <LoadingSkeleton variant="card" count={6} />
        )}
        
        {!loading && error && (
          <ErrorState message={error} onRetry={fetchProjects} />
        )}
        
        {!loading && !error && projects && projects.projects.length === 0 && (
          <EmptyState 
            icon={<div className="text-6xl">📁</div>}
            title="No projects found"
            description="Try adjusting your filters to see more projects."
          />
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects?.projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {showCreateModal && (
            <CreateProjectModal 
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    fetchProjects();
                }}
            />
        )}
      </div>
    </ProtectedLayout>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedLayout>
          <div className="p-6">
            <LoadingSkeleton variant="list" count={6} />
          </div>
        </ProtectedLayout>
      }
    >
      <ProjectsPageContent />
    </Suspense>
  );
}
