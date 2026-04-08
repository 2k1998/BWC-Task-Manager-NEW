'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import ProtectedLayout from '@/components/ProtectedLayout';
import AddCarExpenseModal from '@/components/modals/AddCarExpenseModal';
import AddCarIncomeModal from '@/components/modals/AddCarIncomeModal';
import EditCarModal from '@/components/modals/EditCarModal';
import UpdateCarMaintenanceModal from '@/components/modals/UpdateCarMaintenanceModal';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { Car, CarExpense, CarFinancialsResponse, CarIncome, CarMaintenance, CarStatus } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingSkeleton, Select, Table } from '@/components/ui';

type FinancialTab = 'income' | 'expenses';

export default function CarDetailPage() {
  const params = useParams<{ id: string }>();
  const carId = params?.id;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [car, setCar] = useState<Car | null>(null);
  const [maintenance, setMaintenance] = useState<CarMaintenance | null>(null);
  const [incomes, setIncomes] = useState<CarIncome[]>([]);
  const [expenses, setExpenses] = useState<CarExpense[]>([]);
  const [totals, setTotals] = useState({ totalIncome: 0, totalExpenses: 0, profitLoss: 0 });

  const [activeTab, setActiveTab] = useState<FinancialTab>('income');
  const [editingCar, setEditingCar] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState(false);
  const [addingIncome, setAddingIncome] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const carsPermission = useMemo(() => resolveCarsPermission(user), [user]);
  const canManage = carsPermission === 'full';

  const fetchDetails = useCallback(async () => {
    if (!carId) return;
    try {
      setLoading(true);
      setError('');
      const [carRes, financialRes] = await Promise.all([
        apiClient.get(`/cars/${carId}`),
        apiClient.get<CarFinancialsResponse>(`/cars/${carId}/financials`),
      ]);

      const carPayload = carRes.data?.car ?? carRes.data;
      setCar(carPayload as Car);
      setMaintenance((carRes.data?.maintenance ?? carPayload?.maintenance ?? null) as CarMaintenance | null);

      const totalsPayload = financialRes.data ?? ({} as CarFinancialsResponse);
      const parseNum = (v: unknown) => {
        const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
        return Number.isFinite(n) ? n : 0;
      };
      setIncomes(totalsPayload.incomes ?? []);
      setExpenses(totalsPayload.expenses ?? []);
      setTotals({
        totalIncome: parseNum(totalsPayload.total_income),
        totalExpenses: parseNum(totalsPayload.total_expenses),
        profitLoss: parseNum(totalsPayload.profit ?? totalsPayload.profit_loss),
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch car details'));
    } finally {
      setLoading(false);
    }
  }, [carId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleStatusUpdate = async (nextStatus: CarStatus) => {
    if (!car || !canManage || savingStatus) return;
    try {
      setSavingStatus(true);
      await apiClient.put(`/cars/${car.id}`, { status: nextStatus });
      toast.success('Status updated');
      await fetchDetails();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    } finally {
      setSavingStatus(false);
    }
  };

  const isDueSoon = (dateValue?: string | null) => {
    if (!dateValue) return false;
    const due = new Date(dateValue);
    if (Number.isNaN(due.getTime())) return false;
    const diffMs = due.getTime() - Date.now();
    const days = diffMs / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  };

  const nextServiceSoon = isDueSoon(maintenance?.next_service_date);
  const nextKteoSoon = isDueSoon(maintenance?.next_kteo_date);

  const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '-');
  const fmtMoney = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading && !car) {
    return (
      <ProtectedLayout>
        <LoadingSkeleton variant="table" count={6} />
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <ErrorState message={error} onRetry={fetchDetails} />
      </ProtectedLayout>
    );
  }

  if (carsPermission === 'none') {
    return (
      <ProtectedLayout>
        <EmptyState title="You do not have access to Cars." />
      </ProtectedLayout>
    );
  }

  if (!car) {
    return (
      <ProtectedLayout>
        <EmptyState title="Car not found." />
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{car.make} {car.model}</h1>
              <p className="text-sm text-gray-600 mt-1">License Plate: {car.license_plate}</p>
            </div>
            {canManage ? (
              <div className="w-full md:w-56">
                <Select
                  label="Status"
                  value={car.status}
                  onChange={(e) => handleStatusUpdate(e.target.value as CarStatus)}
                  disabled={savingStatus}
                  options={[
                    { value: 'available', label: 'Available' },
                    { value: 'rented', label: 'Rented' },
                    { value: 'sold', label: 'Sold' },
                  ]}
                />
              </div>
            ) : (
              <Badge variant="status" color={car.status === 'available' ? 'green' : car.status === 'rented' ? 'yellow' : 'gray'}>
                {car.status}
              </Badge>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Car Details</h2>
              {canManage && (
                <Button variant="secondary" size="sm" onClick={() => setEditingCar(true)}>
                  Edit
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Field label="Year" value={String(car.year || '-')} />
              <Field label="Purchase Date" value={fmtDate(car.purchase_date)} />
              <Field
                label="Purchase Price"
                value={car.purchase_price === null || car.purchase_price === undefined ? '-' : String(car.purchase_price)}
              />
              <Field label="Notes" value={car.notes || '-'} />
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Maintenance</h2>
              {canManage && (
                <Button variant="secondary" size="sm" onClick={() => setEditingMaintenance(true)}>
                  Update Maintenance
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Field label="Last Service Date" value={fmtDate(maintenance?.last_service_date)} />
              <Field
                label="Next Service Date"
                value={fmtDate(maintenance?.next_service_date)}
                warning={nextServiceSoon}
              />
              <Field label="Last KTEO Date" value={fmtDate(maintenance?.last_kteo_date)} />
              <Field
                label="Next KTEO Date"
                value={fmtDate(maintenance?.next_kteo_date)}
                warning={nextKteoSoon}
              />
              <Field label="Last Tyre Change Date" value={fmtDate(maintenance?.last_tyre_change_date)} />
            </div>
          </Card>
        </div>

        <Card className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Financials</h2>
            {canManage && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Button variant="secondary" size="sm" onClick={() => setAddingIncome(true)}>
                  Add Income
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setAddingExpense(true)}>
                  Add Expense
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-green-50/40 border border-green-200 rounded-lg p-3">
              <p className="text-xs uppercase tracking-wide text-gray-600">Total Income</p>
              <p className="text-xl font-semibold text-green-700 mt-1">{fmtMoney(totals.totalIncome)}</p>
            </div>
            <div className="bg-red-50/40 border border-red-200 rounded-lg p-3">
              <p className="text-xs uppercase tracking-wide text-gray-600">Total Expenses</p>
              <p className="text-xl font-semibold text-red-700 mt-1">{fmtMoney(totals.totalExpenses)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs uppercase tracking-wide text-gray-600">Profit/Loss</p>
              <p className={`text-xl font-semibold mt-1 ${totals.profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmtMoney(totals.profitLoss)}
              </p>
            </div>
          </div>

          <div className="border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={`px-3 py-2 text-sm font-medium border-b-2 ${
                  activeTab === 'income'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('income')}
              >
                Income
              </button>
              <button
                type="button"
                className={`px-3 py-2 text-sm font-medium border-b-2 ${
                  activeTab === 'expenses'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('expenses')}
              >
                Expenses
              </button>
            </div>
          </div>

          {activeTab === 'income' ? (
            incomes.length === 0 ? (
              <EmptyState title="No income records yet." />
            ) : (
              <>
                <div className="block sm:hidden">
                  {incomes.map((item) => (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 w-full">
                      <div className="font-semibold text-gray-900">{item.customer_name || 'Unknown customer'}</div>
                      <div className="mt-2 text-sm text-gray-700">
                        <span className="font-medium">Type: </span>
                        <span className="capitalize">{item.income_type}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        <span className="font-medium">Amount: </span>
                        {String(item.amount)}
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        <span className="font-medium">Date: </span>
                        {fmtDate(item.transaction_date)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block">
                  <Table>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="px-4 py-3 font-medium">Customer</th>
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {incomes.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-sm text-gray-800">{item.customer_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 capitalize">{item.income_type}</td>
                            <td className="px-4 py-3 text-sm text-gray-800">{String(item.amount)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{fmtDate(item.transaction_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Table>
                </div>
              </>
            )
          ) : expenses.length === 0 ? (
            <EmptyState title="No expense records yet." />
          ) : (
            <>
              <div className="block sm:hidden">
                {expenses.map((item) => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 w-full">
                    <div className="font-semibold text-gray-900">{item.expense_type}</div>
                    <div className="mt-2 text-sm text-gray-700">
                      <span className="font-medium">Amount: </span>
                      {String(item.amount)}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Date: </span>
                      {fmtDate(item.transaction_date)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-medium">Expense Type</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {expenses.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-800">{item.expense_type}</td>
                          <td className="px-4 py-3 text-sm text-gray-800">{String(item.amount)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{fmtDate(item.transaction_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Table>
              </div>
            </>
          )}
        </Card>

        {editingCar && canManage && (
          <EditCarModal
            car={car}
            onClose={() => setEditingCar(false)}
            onSuccess={() => {
              setEditingCar(false);
              fetchDetails();
            }}
          />
        )}
        {editingMaintenance && canManage && (
          <UpdateCarMaintenanceModal
            carId={car.id}
            maintenance={maintenance}
            onClose={() => setEditingMaintenance(false)}
            onSuccess={() => {
              setEditingMaintenance(false);
              fetchDetails();
            }}
          />
        )}
        {addingIncome && canManage && (
          <AddCarIncomeModal
            carId={car.id}
            onClose={() => setAddingIncome(false)}
            onSuccess={() => {
              setAddingIncome(false);
              fetchDetails();
            }}
          />
        )}
        {addingExpense && canManage && (
          <AddCarExpenseModal
            carId={car.id}
            onClose={() => setAddingExpense(false)}
            onSuccess={() => {
              setAddingExpense(false);
              fetchDetails();
            }}
          />
        )}
      </div>
    </ProtectedLayout>
  );
}

function Field({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-sm ${warning ? 'text-orange-700 font-medium' : 'text-gray-800'}`}>
        {warning ? 'Near due: ' : ''}
        {value}
      </p>
    </div>
  );
}

function resolveCarsPermission(user: any): 'none' | 'read' | 'full' {
  if (!user) return 'none';
  if (user.user_type === 'Admin') return 'full';

  const perms = user.permissions ?? user.pages_permissions ?? user.page_permissions;
  if (!perms) return 'none';

  const candidate =
    perms.cars ??
    perms.cars_page ??
    perms.pages?.Cars ??
    perms.pages?.cars ??
    perms.Cars ??
    perms.Car;

  if (candidate === 'full' || candidate === 'read' || candidate === 'none') return candidate;
  return 'none';
}
