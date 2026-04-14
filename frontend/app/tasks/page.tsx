'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import ProtectedLayout from '@/components/ProtectedLayout';
import TaskBoard from '@/components/TaskBoard';
import CreateTaskModal from '@/components/modals/CreateTaskModal';
import { Button, LoadingSkeleton, ErrorState, Badge } from '@/components/ui';
import type { Task } from '@/lib/types';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import Link from 'next/link';
import { getUrgencyDotColor } from '@/lib/urgencyFilter';
import { extractErrorMessage } from '@/lib/utils';

type FilterState = {
  status: string | null;
  urgency: string | null;
  assigned_user_id: string | null;
  company_id: string | null;
  team_id: string | null;
  due_date_from: string | null;
  due_date_to: string | null;
};

type LookupItem = { id: string; name: string };
type LookupUser = { id: string; full_name: string };

const DEFAULT_FILTER_STATE: FilterState = {
  status: null,
  urgency: null,
  assigned_user_id: null,
  company_id: null,
  team_id: null,
  due_date_from: null,
  due_date_to: null,
};

const STATUS_OPTIONS = ['New', 'Received', 'On Process', 'Pending', 'Loose End', 'Completed'];
const URGENCY_OPTIONS = [
  { value: 'Urgent & Important', color: '#EF4444' },
  { value: 'Urgent', color: '#3B82F6' },
  { value: 'Important', color: '#22C55E' },
  { value: 'Not Urgent & Not Important', color: '#EAB308' },
  { value: 'By the end of day', color: '#F97316' },
];

function TasksPageContent() {
  const tTasks = useTranslations('Tasks');
  const tCommon = useTranslations('Common');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [urgencyMenuOpen, setUrgencyMenuOpen] = useState(false);
  const urgencyMenuRef = useRef<HTMLDivElement>(null);

  const [filterState, setFilterState] = useState<FilterState>({
    ...DEFAULT_FILTER_STATE,
    status: searchParams.get('status') || null,
    urgency: searchParams.get('urgency') || null,
  });

  const [users, setUsers] = useState<LookupUser[]>([]);
  const [companies, setCompanies] = useState<LookupItem[]>([]);
  const [teams, setTeams] = useState<LookupItem[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowCreateModal(true);
      // Remove the query param so refreshing doesn't reopen it
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('action');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchTasks();
  }, [filterState, page]);

  // Sync filters to URL
  useEffect(() => {
    const newUrl = new URL(window.location.href);
    let changed = false;
    const urlStatus = searchParams.get('status') || '';
    const urlUrgency = searchParams.get('urgency') || '';
    const statusVal = filterState.status || '';
    const urgencyVal = filterState.urgency || '';

    if (statusVal !== urlStatus) {
      if (statusVal) newUrl.searchParams.set('status', statusVal);
      else newUrl.searchParams.delete('status');
      changed = true;
    }

    if (urgencyVal !== urlUrgency) {
      if (urgencyVal) newUrl.searchParams.set('urgency', urgencyVal);
      else newUrl.searchParams.delete('urgency');
      changed = true;
    }

    if (changed) {
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [filterState.status, filterState.urgency, router, searchParams]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (urgencyMenuRef.current && !urgencyMenuRef.current.contains(event.target as Node)) {
        setUrgencyMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isFilterPanelOpen || lookupsLoaded || lookupsLoading) return;
    const fetchLookups = async () => {
      try {
        setLookupsLoading(true);
        const [usersRes, companiesRes, teamsRes] = await Promise.all([
          apiClient.get('/users'),
          apiClient.get('/companies'),
          apiClient.get('/teams'),
        ]);

        const rawUsers = usersRes.data?.users || usersRes.data || [];
        const mappedUsers = (Array.isArray(rawUsers) ? rawUsers : []).map((u: any) => {
          const fullName =
            String(u.full_name || '').trim() ||
            `${String(u.first_name || '').trim()} ${String(u.last_name || '').trim()}`.trim() ||
            String(u.username || u.email || u.id || 'Unknown user');
          return { id: String(u.id), full_name: fullName };
        });

        const mappedCompanies = (companiesRes.data?.companies || [])
          .map((c: any) => ({ id: String(c.id), name: String(c.name || '') }))
          .sort((a: LookupItem, b: LookupItem) => a.name.localeCompare(b.name));

        const mappedTeams = (teamsRes.data?.teams || []).map((t: any) => ({
          id: String(t.id),
          name: String(t.name || ''),
        }));

        setUsers(mappedUsers);
        setCompanies(mappedCompanies);
        setTeams(mappedTeams);
        setLookupsLoaded(true);
      } catch (err) {
      toast.error(getErrorMessage(err, tCommon('error')));
      } finally {
        setLookupsLoading(false);
      }
    };
    fetchLookups();
  }, [isFilterPanelOpen, lookupsLoaded]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = { page, page_size: 100 };
      if (filterState.status) params.status_filter = filterState.status;
      if (filterState.urgency) params.urgency_filter = filterState.urgency;
      if (filterState.assigned_user_id) params.assigned_user_filter = filterState.assigned_user_id;
      if (filterState.company_id) params.company_filter = filterState.company_id;

      const response = await apiClient.get('/tasks', { params });
      setTasks(response.data.tasks || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  };

  const setFilterValue = (key: keyof FilterState, value: string | null) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilterState(DEFAULT_FILTER_STATE);
    setPage(1);
  };

  const activeFilterCount = useMemo(
    () => Object.values(filterState).filter((v) => Boolean(v)).length,
    [filterState],
  );
  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((task) => {
      const assignedName =
        String((task as any).assigned_to_name || '') ||
        String((task as any).assigned_user_name || '');
      return (
        task.title.toLowerCase().includes(q) ||
        String(task.status || '').toLowerCase().includes(q) ||
        assignedName.toLowerCase().includes(q)
      );
    });
  }, [tasks, searchQuery]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // No Optimistic UI - Wait for backend source of truth
    try {
      await apiClient.put(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success(tCommon('success'));
      await fetchTasks();
    } catch (err: any) {
      const extracted = extractErrorMessage(err?.response?.data);
      const errorMsg = extracted === 'An error occurred' ? tCommon('error') : extracted;
      toast.error(errorMsg);
      throw err;
    }
  };

  if (loading && !tasks.length) { 
    return (
      <ProtectedLayout>
        <div className="h-full px-4">
          <div className="mb-6 flex justify-between items-center">
             <div>
                <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
             </div>
             <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="flex h-[calc(100vh-200px)] gap-6 overflow-x-auto pb-4">
             {[...Array(5)].map((_, i) => (
                <div key={i} className="w-80 h-full flex-shrink-0">
                  <LoadingSkeleton variant="card" count={2} />
                </div>
             ))}
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error && !tasks.length) {
    return (
      <ProtectedLayout>
        <ErrorState message={error} onRetry={fetchTasks} />
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="flex flex-col min-h-0">
        <div className="px-1 sm:px-4 mb-4 flex-shrink-0 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tTasks('filters')}</h1>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full sm:w-auto sm:flex sm:items-center">
              <Button
                variant="outline"
                onClick={() => setIsFilterPanelOpen((v) => !v)}
                className={`flex items-center justify-center gap-2 w-full sm:w-auto ${
                  isFilterPanelOpen ? 'ring-1 ring-[#D1AE62]' : ''
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 ? `${tTasks('filters')} · ${activeFilterCount}` : tTasks('filters')}
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {tTasks('newTask')}
              </Button>
            </div>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tCommon('search')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent"
          />
        </div>

        <div className="px-1 sm:px-4">
          <div
            className={`mb-4 overflow-hidden transition-all duration-200 ${
              isFilterPanelOpen ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="mb-4 border border-gray-200 rounded-lg bg-white p-4">
              <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-wrap lg:items-end">
                <div className="col-span-1 min-w-0 lg:min-w-[180px]">
                  <label className="block text-xs text-gray-500 mb-1">{tTasks('status')}</label>
                  <select
                    value={filterState.status || ''}
                    onChange={(e) => setFilterValue('status', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent"
                  >
                    <option value="">{tTasks('allStatuses')}</option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 min-w-0 lg:min-w-[210px] relative" ref={urgencyMenuRef}>
                  <label className="block text-xs text-gray-500 mb-1">{tTasks('urgency')}</label>
                  <button
                    type="button"
                    onClick={() => setUrgencyMenuOpen((v) => !v)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2 truncate">
                      {filterState.urgency ? (
                        <>
                          <span
                            className="w-2 h-2 rounded-full inline-block mr-2"
                            style={{ backgroundColor: URGENCY_OPTIONS.find((o) => o.value === filterState.urgency)?.color }}
                          />
                          {filterState.urgency}
                        </>
                      ) : (
                        tTasks('allUrgencies')
                      )}
                    </span>
                    <span className="text-gray-500">▾</span>
                  </button>
                  {urgencyMenuOpen && (
                    <div className="absolute z-30 mt-1 w-full border border-gray-200 rounded-md bg-white">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterValue('urgency', null);
                          setUrgencyMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                      >
                        {tTasks('allUrgencies')}
                      </button>
                      {URGENCY_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => {
                            setFilterValue('urgency', o.value);
                            setUrgencyMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 flex items-center"
                        >
                          <span className="w-2 h-2 rounded-full inline-block mr-2" style={{ backgroundColor: o.color }} />
                          {o.value}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-1 min-w-0 lg:min-w-[180px]">
                  <label className="block text-xs text-gray-500 mb-1">{tTasks('assignedTo')}</label>
                  <select
                    value={filterState.assigned_user_id || ''}
                    onChange={(e) => setFilterValue('assigned_user_id', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent"
                    disabled={lookupsLoading && !lookupsLoaded}
                  >
                    <option value="">{tTasks('allUsers')}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 min-w-0 lg:min-w-[180px]">
                  <label className="block text-xs text-gray-500 mb-1">{tTasks('company')}</label>
                  <select
                    value={filterState.company_id || ''}
                    onChange={(e) => setFilterValue('company_id', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent"
                    disabled={lookupsLoading && !lookupsLoaded}
                  >
                    <option value="">{tTasks('allCompanies')}</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 min-w-0 lg:min-w-[180px]">
                  <label className="block text-xs text-gray-500 mb-1">{tTasks('team')}</label>
                  <select
                    value={filterState.team_id || ''}
                    onChange={(e) => setFilterValue('team_id', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent"
                    disabled={lookupsLoading && !lookupsLoaded}
                  >
                    <option value="">{tTasks('allTeams')}</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 min-w-0 lg:col-span-1 lg:min-w-[150px]">
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={filterState.due_date_from || ''}
                    onChange={(e) => setFilterValue('due_date_from', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent"
                  />
                </div>

                <div className="col-span-2 min-w-0 lg:col-span-1 lg:min-w-[150px]">
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={filterState.due_date_to || ''}
                    onChange={(e) => setFilterValue('due_date_to', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent"
                  />
                </div>

                <div className="col-span-2 flex justify-end lg:ml-auto lg:self-end">
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      {tCommon('clearAll')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-1 sm:px-4 pb-3 md:hidden">
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const urgencyLabel = String((task as any).urgency_label || (task as any).urgency || 'Unknown');
              const assignedTo =
                String((task as any).assigned_to_name || '') ||
                String((task as any).assigned_user_name || '') ||
                '-';
              const urgencyDot = getUrgencyDotColor(urgencyLabel) || '#9CA3AF';
              return (
                <Link key={task.id} href={`/tasks/${task.id}`} className="block">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <Badge variant="status" color="gray">{task.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: urgencyDot }} />
                      <span>{urgencyLabel}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-700">{tTasks('assignedTo')}:</span> {assignedTo}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-700">Due:</span>{' '}
                      {task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="hidden md:block flex-1 min-h-0 overflow-hidden">
          <TaskBoard 
            tasks={filteredTasks} 
            currentUser={currentUser} 
            onStatusChange={handleStatusChange}
            onTaskRefresh={fetchTasks}
          />
        </div>
      </div>

      {showCreateModal && (
        <CreateTaskModal 
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
                fetchTasks();
                // Optionally keep modal open? No, requirement says close.
            }}
        />
      )}
    </ProtectedLayout>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <ProtectedLayout>
          <div className="p-6">
            <LoadingSkeleton variant="list" count={8} />
          </div>
        </ProtectedLayout>
      }
    >
      <TasksPageContent />
    </Suspense>
  );
}
