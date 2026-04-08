'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import ProtectedLayout from '@/components/ProtectedLayout';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { Badge, Button, EmptyState, ErrorState, LoadingSkeleton, Select, Table } from '@/components/ui';

type SortOrder = 'asc' | 'desc';

interface CompanyOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
}

interface SummaryResponse {
  active_tasks: number;
  overdue_tasks: number;
  completed_last_30_days: number;
  tasks_created_this_month: number;
}

interface TasksPerCompanyItem {
  company_name: string;
  task_count: number;
}

interface TasksPerUserItem {
  user_name: string;
  task_count: number;
}

interface CompletedOverTimeItem {
  date: string;
  completed_count: number;
}

interface StatusDistributionItem {
  status: string;
  count: number;
}

interface AnalyticsTask {
  id: string;
  title: string;
  company_name: string;
  assignee_name?: string | null;
  owner_name?: string | null;
  status: string;
  urgency_label: string;
  deadline?: string | null;
}

interface AnalyticsTasksResponse {
  tasks: AnalyticsTask[];
  total: number;
  page: number;
  page_size: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'New', label: 'New' },
  { value: 'Received', label: 'Received' },
  { value: 'On Process', label: 'On Process' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Loose End', label: 'Loose End' },
];

const PIE_COLORS = ['#000000', '#342C19', '#D1AE62', '#D9D9D9', '#6B7280', '#16A34A'];

const URGENCY_COLOR_MAP: Record<string, 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'gray'> = {
  'Urgent & Important': 'red',
  Urgent: 'blue',
  Important: 'green',
  'Not Urgent & Not Important': 'yellow',
  Orange: 'orange',
};

function formatUserLabel(user: UserOption): string {
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return fullName || user.username || user.email || user.id;
}

export default function AnalyticsPage() {
  const { user } = useAuth();

  const role = user?.user_type ?? '';
  const canSelectUser = role === 'Admin' || role === 'Pillar' || role === 'Manager';

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [draftCompanyId, setDraftCompanyId] = useState('');
  const [draftUserId, setDraftUserId] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [draftDateFrom, setDraftDateFrom] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'));
  const [draftDateTo, setDraftDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [appliedCompanyId, setAppliedCompanyId] = useState('');
  const [appliedUserId, setAppliedUserId] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'));
  const [appliedDateTo, setAppliedDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState('deadline');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [tasksPerCompany, setTasksPerCompany] = useState<TasksPerCompanyItem[]>([]);
  const [tasksPerUser, setTasksPerUser] = useState<TasksPerUserItem[]>([]);
  const [completedSeries, setCompletedSeries] = useState<CompletedOverTimeItem[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistributionItem[]>([]);
  const [tableData, setTableData] = useState<AnalyticsTasksResponse>({
    tasks: [],
    total: 0,
    page: 1,
    page_size: 10,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const finalAppliedUserId = useMemo(() => {
    if (!user?.id) return appliedUserId;
    if (role === 'Agent' || role === 'Head') {
      return user.id;
    }
    return appliedUserId;
  }, [appliedUserId, role, user?.id]);

  const commonParams = useMemo(() => {
    const params: Record<string, string | number> = {
      date_from: appliedDateFrom,
      date_to: appliedDateTo,
    };
    if (appliedCompanyId) params.company_id = appliedCompanyId;
    if (appliedStatus) params.status = appliedStatus;
    if (finalAppliedUserId) params.user_id = finalAppliedUserId;
    return params;
  }, [appliedCompanyId, appliedDateFrom, appliedDateTo, appliedStatus, finalAppliedUserId]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const companyRes = await apiClient.get('/companies', { params: { page: 1, page_size: 100 } });
      setCompanies(companyRes.data?.companies || []);
    } catch {
      setCompanies([]);
    }

    if (!canSelectUser) {
      setUsers([]);
      return;
    }

    try {
      const usersRes = await apiClient.get('/analytics/users');
      setUsers(usersRes.data?.users || []);
    } catch {
      setUsers([]);
    }
  }, [canSelectUser]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const tasksParams: Record<string, string | number> = {
        ...commonParams,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      const [summaryRes, companyRes, userRes, completedRes, tableRes] = await Promise.all([
        apiClient.get<SummaryResponse>('/analytics/summary', { params: commonParams }),
        apiClient.get<{ items: TasksPerCompanyItem[] }>('/analytics/tasks-per-company', { params: commonParams }),
        apiClient.get<{ items: TasksPerUserItem[] }>('/analytics/tasks-per-user', { params: commonParams }),
        apiClient.get<{ items: CompletedOverTimeItem[] }>('/analytics/completed', { params: commonParams }),
        apiClient.get<AnalyticsTasksResponse>('/analytics/tasks', { params: tasksParams }),
      ]);

      setSummary(summaryRes.data);
      setTasksPerCompany(companyRes.data?.items || []);
      setTasksPerUser(userRes.data?.items || []);
      setCompletedSeries(completedRes.data?.items || []);
      setStatusDistribution([]);
      setTableData(tableRes.data || { tasks: [], total: 0, page: 1, page_size: pageSize });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load analytics data.'));
    } finally {
      setLoading(false);
    }
  }, [commonParams, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    fetchDropdowns();
  }, [fetchDropdowns]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedCompanyId(draftCompanyId);
    setAppliedStatus(draftStatus);
    setAppliedDateFrom(draftDateFrom);
    setAppliedDateTo(draftDateTo);
    setAppliedUserId(canSelectUser ? draftUserId : '');
  };

  const hasAnyData =
    (summary?.active_tasks ?? 0) > 0 ||
    (summary?.overdue_tasks ?? 0) > 0 ||
    (summary?.completed_last_30_days ?? 0) > 0 ||
    (summary?.tasks_created_this_month ?? 0) > 0 ||
    tableData.tasks.length > 0;

  const totalPages = Math.max(1, Math.ceil((tableData.total || 0) / pageSize));

  const handleSort = (column: string) => {
    setPage(1);
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const kpiCards = [
    {
      label: 'Active Tasks',
      value: summary?.active_tasks ?? 0,
      trend: null,
    },
    {
      label: 'Overdue Tasks',
      value: summary?.overdue_tasks ?? 0,
      trend: null,
    },
    {
      label: 'Completed (Last 30 Days)',
      value: summary?.completed_last_30_days ?? 0,
      trend: null,
    },
    {
      label: 'Created This Month',
      value: summary?.tasks_created_this_month ?? 0,
      trend: null,
    },
  ];

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        </div>

        <section className="border border-gray-200 rounded-lg bg-white p-4">
          <div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-5 gap-4">
            <Select
              label="Company"
              value={draftCompanyId}
              onChange={(e) => setDraftCompanyId(e.target.value)}
              options={[
                { value: '', label: 'All Companies' },
                ...companies.map((company) => ({ value: company.id, label: company.name })),
              ]}
            />

            {canSelectUser && (
              <Select
                label="User"
                value={draftUserId}
                onChange={(e) => setDraftUserId(e.target.value)}
                options={[
                  { value: '', label: role === 'Manager' ? 'Self + Downline' : 'All Users' },
                  ...users.map((option) => ({ value: option.id, label: formatUserLabel(option) })),
                ]}
              />
            )}

            <div>
              <label className="block text-[13px] font-medium text-gray-600 mb-1">Date From</label>
              <input
                type="date"
                value={draftDateFrom}
                onChange={(e) => setDraftDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-800 focus:border-[#D1AE62] focus:ring-1 focus:ring-[#D1AE62] outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-gray-600 mb-1">Date To</label>
              <input
                type="date"
                value={draftDateTo}
                onChange={(e) => setDraftDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-800 focus:border-[#D1AE62] focus:ring-1 focus:ring-[#D1AE62] outline-none"
              />
            </div>

            <Select
              label="Task Status"
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
              options={STATUS_OPTIONS}
            />
          </div>

          <div className="mt-4">
            <Button onClick={handleApplyFilters} variant="primary">
              Apply Filters
            </Button>
          </div>
        </section>

        {loading ? (
          <>
            <LoadingSkeleton variant="card" count={4} />
            <LoadingSkeleton variant="card" count={4} />
            <LoadingSkeleton variant="table" count={6} />
          </>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchAnalytics} />
        ) : !hasAnyData ? (
          <EmptyState
            title="No data available for the selected filters."
            description="Try changing company, user, date range, or status filters."
          />
        ) : (
          <>
            <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {kpiCards.map((card) => (
                <div key={card.label} className="border border-gray-200 rounded-lg bg-white p-4">
                  <p className="text-sm text-gray-600">{card.label}</p>
                  <p className="text-3xl font-semibold text-gray-900 mt-2">{card.value}</p>
                  {card.trend && <p className="text-xs text-gray-500 mt-1">{card.trend}</p>}
                </div>
              ))}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg bg-white p-4">
                <h2 className="text-base font-semibold text-gray-800 mb-3">Tasks per Company</h2>
                <div className="h-[250px] sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksPerCompany}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="company_name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="task_count" fill="#4B5563" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg bg-white p-4">
                <h2 className="text-base font-semibold text-gray-800 mb-3">Tasks per User</h2>
                <div className="h-[250px] sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksPerUser}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="user_name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="task_count" fill="#6B7280" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg bg-white p-4">
                <h2 className="text-base font-semibold text-gray-800 mb-3">Completed Tasks Over Time</h2>
                <div className="h-[250px] sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={completedSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="completed_count" stroke="#D1AE62" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg bg-white p-4">
                <h2 className="text-base font-semibold text-gray-800 mb-3">Task Status Distribution</h2>
                <div className="h-[250px] sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusDistribution} dataKey="count" nameKey="status" outerRadius={100}>
                        {statusDistribution.map((entry, idx) => (
                          <Cell key={`${entry.status}-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

        <section className="border border-gray-200 rounded-lg bg-white p-4 sm:p-0">
              <div className="block sm:hidden">
                {tableData.tasks.map((task) => (
                  <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                    <div className="font-semibold text-gray-900">{task.title}</div>
                    <div className="mt-2 text-sm text-gray-700">
                      <span className="font-medium">Company: </span>
                      {task.company_name}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Assignee: </span>
                      {task.assignee_name || '-'}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Status: </span>
                      {task.status}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
              <Table>
                <table className="w-full min-w-[900px] text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[13px] font-medium text-gray-600 uppercase tracking-wide">
                      {[
                        ['title', 'Title'],
                        ['company_name', 'Company'],
                        ['assignee_name', 'Assignee'],
                        ['owner_name', 'Owner'],
                        ['status', 'Status'],
                        ['urgency_label', 'Urgency'],
                        ['deadline', 'Deadline'],
                      ].map(([key, label]) => (
                        <th
                          key={key}
                          className="px-4 py-3 cursor-pointer select-none"
                          onClick={() => handleSort(key)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            {sortBy === key ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.tasks.map((task) => (
                      <tr key={task.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-[15px] text-gray-800">{task.title}</td>
                        <td className="px-4 py-3 text-[15px] text-gray-800">{task.company_name}</td>
                        <td className="px-4 py-3 text-[15px] text-gray-800">{task.assignee_name || '-'}</td>
                        <td className="px-4 py-3 text-[15px] text-gray-800">{task.owner_name || '-'}</td>
                        <td className="px-4 py-3 text-[15px] text-gray-800">{task.status}</td>
                        <td className="px-4 py-3">
                          <Badge variant="status" color={URGENCY_COLOR_MAP[task.urgency_label] || 'gray'}>
                            {task.urgency_label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-[15px] text-gray-800">
                          {task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Table>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Page {tableData.page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
