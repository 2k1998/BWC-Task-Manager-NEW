'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { useHasPermission } from '@/hooks/useHasPermission';
import apiClient from '@/lib/apiClient';
import type { Car, CarListResponse, Company, Payment, User } from '@/lib/types';

import {
  Button,
  Input,
  LoadingSkeleton,
  Modal,
  Select,
} from '@/components/ui';

// Backend payment schema does not include a separate `notes` field.
// To keep the UI spec while persisting safely, we embed Notes inside `description`.
const NOTES_MARKER = '\n\nNotes:';

function splitDescriptionAndNotes(description: string | null | undefined) {
  const raw = description ?? '';
  const idx = raw.indexOf(NOTES_MARKER);
  if (idx === -1) {
    return { description: raw, notes: '' };
  }
  return {
    description: raw.slice(0, idx).trim(),
    notes: raw.slice(idx + NOTES_MARKER.length).trim(),
  };
}

function combineDescriptionAndNotes(description: string, notes: string) {
  const base = description.trim();
  const extra = notes.trim();
  if (!extra) return base;
  if (!base) return `${NOTES_MARKER} ${extra}`;
  return `${base}${NOTES_MARKER} ${extra}`;
}

type PaymentModalProps =
  | {
      mode: 'create';
      defaultIsIncome?: boolean;
      onClose: () => void;
      onSuccess: () => void | Promise<void>;
    }
  | {
      mode: 'edit';
      payment: Payment;
      onClose: () => void;
      onSuccess: () => void | Promise<void>;
    };

const PAYMENT_TYPE_OPTIONS = [
  { value: 'salary', label: 'Salary' },
  { value: 'commission', label: 'Commission' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'rent', label: 'Rent' },
  { value: 'bill', label: 'Bill' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'service', label: 'Service' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'car_washing', label: 'Car Washing' },
  { value: 'coffee_meals', label: 'Coffee/Meals' },
  { value: 'parking', label: 'Parking' },
];

export default function PaymentModal(props: PaymentModalProps) {
  const t = useTranslations('Payments');
  const { user } = useAuth();
  const isAdmin = user?.user_type === 'Admin';
  const canViewCars = useHasPermission('cars', 'view');
  const { isLoading: permissionsLoading } = usePermissions();

  const mode = props.mode;
  const payment = mode === 'edit' ? props.payment : null;
  const createDefaultIsIncome = mode === 'create' ? (props.defaultIsIncome ?? false) : false;

  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [carsStatus, setCarsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [carsRetry, setCarsRetry] = useState(0);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    currency: 'EUR',
    payment_type: '',
    payment_category: '',
    payment_date: today,
    is_income: createDefaultIsIncome,
    income_source: '' as '' | 'car_rental' | 'car_sale',
    car_id: '',
    employee_user_id: '',
    company_id: '',
    notes: '',
  });

  useEffect(() => {
    const init = async () => {
      try {
        setInitialLoading(true);

        const companiesRes = await apiClient.get<{ companies: Company[] }>(
          '/companies?page=1&page_size=100',
        );
        setCompanies(companiesRes.data.companies || []);

        if (isAdmin) {
          const usersRes = await apiClient.get<{ users: User[] }>(
            '/admin/users?page=1&page_size=100',
          );
          setEmployees(usersRes.data.users || []);
        } else {
          setEmployees([]);
        }
      } catch {
        // Errors are handled globally by apiClient interceptors.
        setCompanies([]);
        setEmployees([]);
      } finally {
        setInitialLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!payment) return;
    const { description, notes } = splitDescriptionAndNotes(payment.description ?? null);
    setFormData({
      title: payment.title ?? '',
      description,
      notes,
      amount: payment.amount ? String(payment.amount) : '',
      currency: payment.currency ?? 'EUR',
      payment_type: payment.payment_type ?? '',
      payment_category: payment.payment_category ?? '',
      payment_date: payment.payment_date ? String(payment.payment_date) : today,
      is_income: !!payment.is_income,
      income_source: payment.is_income ? (payment.income_source ?? '') : '',
      car_id: payment.is_income && payment.income_source ? (payment.car_id ?? '') : '',
      employee_user_id: payment.employee_user_id ? String(payment.employee_user_id) : '',
      company_id: payment.company_id ? String(payment.company_id) : '',
    });
  }, [payment, today]);

  const needsCar = formData.is_income && !!formData.income_source;

  useEffect(() => {
    if (!needsCar || !canViewCars || permissionsLoading) return;
    const controller = new AbortController();
    const loadCars = async () => {
      setCarsStatus('loading');
      setCars([]);
      try {
        const allCars: Car[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const { data } = await apiClient.get<CarListResponse>('/cars', {
            params: { page, page_size: 100 },
            signal: controller.signal,
          });
          if (!Array.isArray(data.cars) || !Number.isFinite(data.total) ||
              !data.page_size || data.page_size < 1) {
            throw new Error('Invalid car list response');
          }
          allCars.push(...data.cars);
          hasMore = page * data.page_size < data.total!;
          if (hasMore && data.cars.length === 0) throw new Error('Incomplete car list');
          page += 1;
        }
        if (!controller.signal.aborted) {
          setCars([...new Map(allCars.map((car) => [car.id, car])).values()]);
          setCarsStatus('ready');
        }
      } catch {
        if (!controller.signal.aborted) {
          setCars([]);
          setCarsStatus('error');
        }
      }
    };
    void loadCars();
    return () => controller.abort();
  }, [needsCar, canViewCars, permissionsLoading, carsRetry]);

  // The backend permits preserving an existing association when Cars access is revoked.
  // New or changed associations still require a verified car from the loaded list.
  const preservesSavedCar = !permissionsLoading && !canViewCars && !!payment?.is_income &&
    !!payment.income_source && !!payment.car_id &&
    formData.income_source === payment.income_source && formData.car_id === payment.car_id;
  const selectedCarExists = cars.some((car) => car.id === formData.car_id);
  const carOptions = cars.map((car) => ({
    value: car.id,
    label: `${car.license_plate} · ${car.make} ${car.model}`,
  }));

  if (preservesSavedCar) {
    carOptions.push({ value: formData.car_id, label: `${t('incomeSavedCar')} (${formData.car_id})` });
  }

  const canSubmit = useMemo(() => {
    const amount = parseFloat(formData.amount);
    return (
      (!needsCar || preservesSavedCar || (!permissionsLoading && canViewCars && carsStatus === 'ready' && selectedCarExists)) &&
      formData.title.trim().length > 0 &&
      Number.isFinite(amount) &&
      amount > 0 &&
      formData.company_id.trim().length > 0 &&
      formData.payment_type.trim().length > 0 &&
      formData.payment_date.trim().length > 0 &&
      formData.currency.trim().length > 0
    );
  }, [formData.amount, formData.company_id, formData.currency, formData.payment_date, formData.payment_type, formData.title, needsCar, permissionsLoading, canViewCars, carsStatus, selectedCarExists, preservesSavedCar]);

  const companyOptions = useMemo(() => {
    const base = companies.map((c) => ({ value: c.id, label: c.name }));
    const selectedCompanyId = formData.company_id;
    const selectedInList = base.some((o) => o.value === selectedCompanyId);
    if (!selectedCompanyId || selectedInList) return base;

    return [
      ...base,
      { value: selectedCompanyId, label: payment?.company_id === selectedCompanyId ? 'Selected Company' : selectedCompanyId },
    ];
  }, [companies, formData.company_id, payment?.company_id]);

  const employeeOptions = useMemo(() => {
    const base = employees.map((u) => ({
      value: u.id,
      label: `${u.first_name} ${u.last_name}`.trim() || u.email || u.username,
    }));
    if (!formData.employee_user_id) return base;

    const selectedId = formData.employee_user_id;
    const selectedInList = base.some((o) => o.value === selectedId);
    if (selectedInList) return base;

    return [
      ...base,
      {
        value: selectedId,
        label: 'Selected Employee',
      },
    ];
  }, [employees, formData.employee_user_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      toast.error('Please complete all required fields.');
      return;
    }

    const amountNum = parseFloat(formData.amount);
    const combinedDescription = combineDescriptionAndNotes(formData.description, formData.notes);

    // Backend does not support a separate `notes` field; we embed it into `description`.
    const payload: any = {
      title: formData.title.trim(),
      // Keep leading marker intact so edit-mode can split notes back out.
      description: combinedDescription ? combinedDescription.trimEnd() : null,
      amount: amountNum,
      currency: formData.currency.trim() || 'EUR',
      payment_type: formData.payment_type,
      payment_category: formData.payment_category.trim() ? formData.payment_category.trim() : null,
      payment_date: formData.payment_date,
      is_income: formData.is_income,
      income_source: needsCar ? formData.income_source : null,
      car_id: needsCar ? formData.car_id : null,
      employee_user_id: formData.employee_user_id ? formData.employee_user_id : null,
      company_id: formData.company_id,
    };

    try {
      setSubmitting(true);

      if (mode === 'create') {
        await apiClient.post('/payments', payload);
        toast.success('Payment created successfully');
      } else if (payment) {
        await apiClient.put(`/payments/${payment.id}`, payload);
        toast.success('Payment updated successfully');
      }

      await props.onSuccess();
      props.onClose();
    } catch (err) {
      toast.error('Failed to save payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle =
    mode === 'create'
      ? createDefaultIsIncome
        ? t('modalTitleIncome')
        : t('modalTitlePayment')
      : 'Edit Payment';

  if (initialLoading) {
    return (
      <Modal isOpen={true} onClose={props.onClose} title={modalTitle}>
        <LoadingSkeleton variant="card" count={2} />
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={props.onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4 pb-28 sm:pb-0">
        <div>
          <Input
            label="Title *"
            value={formData.title}
            onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g. May Salary"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold outline-none"
            placeholder="Add details..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">€</span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              className="pl-8"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Currency"
            value={formData.currency}
            onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))}
          />

          <Select
            label="Payment Type *"
            value={formData.payment_type}
            onChange={(e) => setFormData((p) => ({ ...p, payment_type: e.target.value }))}
            options={[
              { value: '', label: 'Select Type...' },
              ...PAYMENT_TYPE_OPTIONS,
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Payment Category"
            value={formData.payment_category}
            onChange={(e) => setFormData((p) => ({ ...p, payment_category: e.target.value }))}
            placeholder="Optional"
          />

          <Input
            label="Payment Date *"
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData((p) => ({ ...p, payment_date: e.target.value }))}
            required
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-gray-700">Is Income? *</div>
          <button
            type="button"
            role="switch"
            aria-checked={formData.is_income}
            aria-label={t('isIncome')}
            onClick={() => setFormData((p) => ({ ...p, is_income: !p.is_income, income_source: '', car_id: '' }))}
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors',
              formData.is_income ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-5 w-5 transform rounded-full bg-white border border-gray-200 transition-transform',
                formData.is_income ? 'translate-x-5' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>

        {formData.is_income && (
          <div className="space-y-3">
            <Select
              label={t('incomeSource')}
              aria-label={t('incomeSource')}
              value={formData.income_source}
              onChange={(e) => setFormData((p) => ({
                ...p,
                income_source: e.target.value as typeof p.income_source,
                car_id: e.target.value ? p.car_id : '',
              }))}
              options={[
                { value: '', label: t('incomeSourceOther') },
                { value: 'car_rental', label: t('incomeSourceRental') },
                { value: 'car_sale', label: t('incomeSourceSale') },
              ]}
            />
            {needsCar && (
              <div>
                <Select
                  label={t('incomeCar')}
                  aria-label={t('incomeCar')}
                  aria-describedby="payment-car-status"
                  value={selectedCarExists || preservesSavedCar ? formData.car_id : ''}
                  onChange={(e) => setFormData((p) => ({ ...p, car_id: e.target.value }))}
                  disabled={permissionsLoading || !canViewCars || carsStatus !== 'ready' || cars.length === 0}
                  required
                  options={[{ value: '', label: t('selectIncomeCar') }, ...carOptions]}
                />
                <div id="payment-car-status" className="mt-2 text-sm" aria-live="polite">
                  {permissionsLoading || (canViewCars && (carsStatus === 'idle' || carsStatus === 'loading')) ? (
                    <p className="text-gray-500">{t('incomeCarsLoading')}</p>
                  ) : !canViewCars ? (
                    <p className={preservesSavedCar ? 'text-gray-600' : 'text-red-700'}>{t(preservesSavedCar ? 'incomeCarsPreserved' : 'incomeCarsNoPermission')}</p>
                  ) : carsStatus === 'error' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-red-700">{t('incomeCarsError')}</p>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setCarsRetry((n) => n + 1)}>
                        {t('retryIncomeCars')}
                      </Button>
                    </div>
                  ) : cars.length === 0 ? (
                    <p className="text-gray-600">{t('incomeCarsEmpty')}</p>
                  ) : formData.car_id && !selectedCarExists ? (
                    <p className="text-red-700">{t('incomeCarUnavailable')}</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Employee"
            value={formData.employee_user_id}
            onChange={(e) => setFormData((p) => ({ ...p, employee_user_id: e.target.value }))}
            disabled={!isAdmin}
            options={[
              { value: '', label: 'None' },
              ...employeeOptions,
            ]}
          />

          <Select
            label="Company *"
            value={formData.company_id}
            onChange={(e) => setFormData((p) => ({ ...p, company_id: e.target.value }))}
            options={[
              { value: '', label: 'Select Company...' },
              ...companyOptions,
            ]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold outline-none"
            placeholder="Extra notes..."
          />
        </div>

        <div className="fixed inset-x-0 bottom-0 p-4 bg-white border-t border-gray-100 flex justify-end gap-3 sm:static sm:p-0 sm:mt-6 sm:pt-4 sm:border-t">
          <Button type="button" variant="secondary" onClick={props.onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || !canSubmit}>
            {submitting ? 'Saving...' : mode === 'create' ? 'Create Payment' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

