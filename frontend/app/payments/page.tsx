'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import ProtectedLayout from '@/components/ProtectedLayout';
import PaymentModal from '@/components/modals/PaymentModal';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { Company, Payment, PaymentListResponse, User } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  Modal,
  Select,
  Table,
} from '@/components/ui';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
  });

  // Dependencies for dropdowns
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [employeeUserId, setEmployeeUserId] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [paymentCategory, setPaymentCategory] = useState('');
  const [currency, setCurrency] = useState('');
  const [isIncomeOnly, setIsIncomeOnly] = useState(false); // OFF => no filter

  // Modals
  const [paymentModal, setPaymentModal] = useState<
    | { open: false }
    | { open: true; mode: 'create' }
    | { open: true; mode: 'edit'; payment: Payment }
  >({ open: false });

  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auth
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const isAdmin = user?.user_type === 'Admin';
  const canCreate = useMemo(() => resolvePaymentsPermission(user) === 'full', [user]);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await apiClient.get<{ companies: Company[] }>(
        '/companies?page=1&page_size=100',
      );
      setCompanies(res.data.companies || []);
    } catch (err) {
      setCompanies([]);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      // Backend user listing is admin-only in this codebase.
      const res = await apiClient.get<{ users: User[] }>(
        '/admin/users?page=1&page_size=100',
      );
      setEmployees(res.data.users || []);
    } catch (err) {
      setEmployees([]);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
    if (isAdmin) fetchEmployees();
  }, [fetchCompanies, fetchEmployees, isAdmin]);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, unknown> = {
        page: 1,
        page_size: 100,
      };

      // Backend expects ISO date strings (YYYY-MM-DD) for date_from/date_to.
      if (fromDate) params.date_from = fromDate;
      if (toDate) params.date_to = toDate;
      if (companyId) params.company_id = companyId;
      if (employeeUserId) params.employee_user_id = employeeUserId;
      if (paymentType) params.payment_type = paymentType;
      if (paymentCategory.trim()) params.payment_category = paymentCategory.trim();
      if (currency.trim()) params.currency = currency.trim();

      // Filter behavior per spec discussion: toggle OFF => no is_income filter (show all)
      if (isIncomeOnly) params.is_income = true;

      const [paymentsRes, summaryRes] = await Promise.all([
        apiClient.get<PaymentListResponse>('/payments', { params }),
        apiClient.get<{
          total_income: number | string;
          total_expenses: number | string;
          net_balance: number | string;
        }>('/payments/summary', { params }),
      ]);

      setPayments(paymentsRes.data.payments ?? []);

      const parseDec = (v: unknown) => {
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        return Number.isFinite(n) ? n : 0;
      };

      setSummary({
        totalIncome: parseDec(summaryRes.data?.total_income),
        totalExpenses: parseDec(summaryRes.data?.total_expenses),
        netBalance: parseDec(summaryRes.data?.net_balance),
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load payments'));
    } finally {
      setLoading(false);
    }
  }, [companyId, currency, employeeUserId, fromDate, isIncomeOnly, paymentCategory, paymentType, toDate]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const companyById = useMemo(() => {
    return new Map(companies.map((c) => [c.id, c]));
  }, [companies]);

  const employeeById = useMemo(() => {
    return new Map(employees.map((u) => [u.id, u]));
  }, [employees]);

  const netColor =
    summary.netBalance > 0 ? 'green' : summary.netBalance < 0 ? 'red' : 'blue';

  const summaryCards = useMemo(() => {
    const format2 = (n: number) =>
      n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    return [
      { label: 'Total Income', value: format2(summary.totalIncome), badgeColor: 'green' },
      { label: 'Total Expenses', value: format2(summary.totalExpenses), badgeColor: 'red' },
      { label: 'Net Balance', value: format2(summary.netBalance), badgeColor: netColor },
    ];
  }, [netColor, summary.netBalance, summary.totalExpenses, summary.totalIncome]);

  const canEditRow = useCallback(
    (payment: Payment) => {
      if (!currentUserId) return false;
      if (!canCreate && !isAdmin) return false;
      return isAdmin || payment.created_by_user_id === currentUserId;
    },
    [canCreate, currentUserId, isAdmin],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletePayment) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/payments/${deletePayment.id}`);
      toast.success('Payment deleted');
      setDeletePayment(null);
      await fetchPayments();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to delete payment'));
    } finally {
      setDeleting(false);
    }
  }, [deletePayment, fetchPayments]);

  const paymentTypeOptions = useMemo(
    () => [
      { value: '', label: 'All Types' },
      { value: 'salary', label: 'Salary' },
      { value: 'commission', label: 'Commission' },
      { value: 'bonus', label: 'Bonus' },
      { value: 'rent', label: 'Rent' },
      { value: 'bill', label: 'Bill' },
      { value: 'purchase', label: 'Purchase' },
      { value: 'service', label: 'Service' },
    ],
    [],
  );

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          </div>

          {canCreate && (
            <Button
              onClick={() => setPaymentModal({ open: true, mode: 'create' })}
              variant="primary"
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
              aria-label="Add Payment"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Payment
            </Button>
          )}
        </div>

        {/* Summary Bar */}
        <div className="flex flex-col md:grid md:grid-cols-3 gap-4">
          {summaryCards.map((c) => {
            const color =
              c.badgeColor === 'green'
                ? 'text-green-700 border-green-200 bg-green-50/30'
                : c.badgeColor === 'red'
                  ? 'text-red-700 border-red-200 bg-red-50/30'
                  : 'text-blue-700 border-blue-200 bg-blue-50/30';

            return (
              <div
                key={c.label}
                className={`bg-white border border-gray-200 rounded-lg p-4 ${color}`}
              >
                <div className="text-sm font-medium text-gray-600">{c.label}</div>
                <div className="text-2xl font-bold mt-2">
                  {c.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter Panel */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="From Date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <Input
              label="To Date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />

            <Select
              label="Company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              options={[
                { value: '', label: 'All Companies' },
                ...companies.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />

            <Select
              label="Employee"
              value={employeeUserId}
              onChange={(e) => setEmployeeUserId(e.target.value)}
              disabled={!isAdmin}
              options={[
                { value: '', label: 'All Employees' },
                ...employees.map((u) => ({
                  value: u.id,
                  label: `${u.first_name} ${u.last_name}`.trim() || u.email || u.username,
                })),
              ]}
            />

            <Select
              label="Payment Type"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              options={paymentTypeOptions}
            />

            <Input
              label="Payment Category"
              value={paymentCategory}
              onChange={(e) => setPaymentCategory(e.target.value)}
              placeholder="Optional"
            />

            <Input
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="Optional"
            />

            <div className="flex items-end">
              <div className="w-full">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-700">Is Income?</div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isIncomeOnly}
                    onClick={() => setIsIncomeOnly((v) => !v)}
                    className={[
                      'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors',
                      isIncomeOnly ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-block h-5 w-5 transform rounded-full bg-white border border-gray-200 transition-transform',
                        isIncomeOnly ? 'translate-x-5' : 'translate-x-1',
                      ].join(' ')}
                    />
                  </button>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {isIncomeOnly ? 'Showing income payments only.' : 'Showing both income and expenses.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading && payments.length === 0 ? (
          <LoadingSkeleton variant="table" count={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchPayments} />
        ) : payments.length === 0 ? (
          <EmptyState title="No payments recorded yet." />
        ) : (
          <Card className="p-4 sm:p-0 border border-gray-200">
            <div className="block sm:hidden">
              {payments.map((p) => {
                const employee = p.employee_user_id ? employeeById.get(p.employee_user_id) : null;
                const employeeLabel = employee
                  ? `${employee.first_name} ${employee.last_name}`.trim() || employee.email || employee.username
                  : p.employee_user_id || 'Not set';
                const amountNum =
                  typeof p.amount === 'number' ? p.amount : parseFloat(String(p.amount));
                const amountLabel = Number.isFinite(amountNum)
                  ? amountNum.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : String(p.amount);

                return (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                    <div className="font-semibold text-gray-900">{p.description || p.title}</div>
                    <div className={`mt-2 text-sm font-semibold ${p.is_income ? 'text-green-700' : 'text-red-700'}`}>
                      Amount: {amountLabel} {p.currency}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Type: </span>
                      <span className="capitalize">{p.payment_type}</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Date: </span>
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : <span className="text-gray-400 italic">Not set</span>}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Assigned User: </span>
                      {employeeLabel === 'Not set' ? <span className="text-gray-400 italic">Not set</span> : employeeLabel}
                    </div>
                    <div className="mt-4 flex gap-2">
                      {canEditRow(p) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-white w-full"
                          onClick={() => setPaymentModal({ open: true, mode: 'edit', payment: p })}
                        >
                          Edit
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => setDeletePayment(p)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden sm:block overflow-x-auto w-full custom-scrollbar">
              <Table>
                <table className="min-w-full w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Title</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Company</th>
                      <th className="px-6 py-4 font-medium">Employee</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Currency</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Income/Expense</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map((p) => {
                      const companyLabel =
                        companyById.get(p.company_id)?.name ?? p.company_id ?? 'Not set';

                      const employee = p.employee_user_id ? employeeById.get(p.employee_user_id) : null;
                      const employeeLabel = employee
                        ? `${employee.first_name} ${employee.last_name}`.trim() || employee.email || employee.username
                        : p.employee_user_id || 'Not set';

                      const amountNum =
                        typeof p.amount === 'number' ? p.amount : parseFloat(String(p.amount));
                      const amountLabel = Number.isFinite(amountNum) ? amountNum.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(p.amount);

                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{p.title}</div>
                            {p.description ? (
                              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
                            ) : null}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 capitalize">{p.payment_type}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{companyLabel}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {employeeLabel === 'Not set' ? (
                              <span className="text-gray-400 italic">Not set</span>
                            ) : (
                              employeeLabel
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-800">{amountLabel}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{p.currency}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : <span className="text-gray-400 italic">Not set</span>}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="status" color={p.is_income ? 'green' : 'red'}>
                              {p.is_income ? 'Income' : 'Expense'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap justify-end gap-2">
                            {canEditRow(p) && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="bg-white"
                                onClick={() => setPaymentModal({ open: true, mode: 'edit', payment: p })}
                              >
                                Edit
                              </Button>
                            )}

                            {isAdmin && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeletePayment(p)}
                              >
                                Delete
                              </Button>
                            )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Table>
            </div>
          </Card>
        )}

        {/* Create/Edit Payment Modal */}
        {paymentModal.open && paymentModal.mode === 'create' && (
          <PaymentModal
            mode="create"
            onClose={() => setPaymentModal({ open: false })}
            onSuccess={fetchPayments}
          />
        )}

        {paymentModal.open && paymentModal.mode === 'edit' && (
          <PaymentModal
            mode="edit"
            payment={paymentModal.payment}
            onClose={() => setPaymentModal({ open: false })}
            onSuccess={fetchPayments}
          />
        )}

        {/* Delete Confirmation */}
        {deletePayment && (
          <Modal
            isOpen={true}
            onClose={() => {
              if (!deleting) setDeletePayment(null);
            }}
            title="Delete Payment"
          >
            <div className="space-y-4 pb-24 sm:pb-0">
              <p className="text-[15px] text-gray-700 font-medium">This action cannot be undone.</p>
              <div className="text-sm text-gray-600">
                Payment: <span className="font-semibold text-gray-900">{deletePayment.title}</span>
              </div>
              <div className="fixed inset-x-0 bottom-0 p-4 bg-white border-t border-gray-100 flex justify-end gap-3 sm:static sm:p-0 sm:pt-2 sm:border-0">
                <Button type="button" variant="secondary" onClick={() => setDeletePayment(null)} disabled={deleting}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
                  <span className="inline-flex items-center gap-2">
                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                  </span>
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </ProtectedLayout>
  );
}

function resolvePaymentsPermission(user: any): 'none' | 'read' | 'full' {
  if (!user) return 'none';
  if (user.user_type === 'Admin') return 'full'; // Admin override

  const perms = user.permissions ?? user.pages_permissions ?? user.page_permissions;
  if (!perms) return 'none';

  const candidate =
    perms.payments ??
    perms.payments_page ??
    perms.pages?.Payments ??
    perms.pages?.payments ??
    perms.Payments ??
    perms.Payment;

  if (candidate === 'full' || candidate === 'read' || candidate === 'none') return candidate;
  return 'none';
}

