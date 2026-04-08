'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { Company } from '@/lib/types';

import ProtectedLayout from '@/components/ProtectedLayout';
import { Button, Card, EmptyState, ErrorState, Input, LoadingSkeleton, Modal } from '@/components/ui';

type CompaniesPermission = 'none' | 'read' | 'full';

function resolveCompaniesPermission(user: any): CompaniesPermission {
  if (!user) return 'none';
  if (user.user_type === 'Admin') return 'full'; // PRD #0 admin override

  const perms = user.permissions ?? user.pages_permissions ?? user.page_permissions;
  if (!perms) return 'none';

  const candidate =
    perms.companies ??
    perms.companies_page ??
    perms.pages?.Companies ??
    perms.pages?.companies ??
    perms.Companies ??
    perms.Company;

  if (candidate === 'full' || candidate === 'read' || candidate === 'none') return candidate;
  return 'none';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const d = new Date(value);
  // Handle invalid dates defensively
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString();
}

export default function CompanyDetails({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    vat_number: '',
    occupation: '',
    description: '',
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const companiesPermission = useMemo(() => resolveCompaniesPermission(user), [user]);
  const canEdit = companiesPermission === 'full';
  const canDelete = user?.user_type === 'Admin';

  const fetchCompany = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.get<Company>(`/companies/${id}`);
      setCompany(res.data);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to fetch company details'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  useEffect(() => {
    if (!company) return;
    setEditForm({
      name: company.name ?? '',
      vat_number: company.vat_number ?? '',
      occupation: company.occupation ?? '',
      description: company.description ?? '',
    });
  }, [company]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    const trimmedName = editForm.name.trim();
    if (!trimmedName) {
      toast.error('Company Name is required.');
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        name: trimmedName,
        vat_number: editForm.vat_number.trim() ? editForm.vat_number.trim() : null,
        occupation: editForm.occupation.trim() ? editForm.occupation.trim() : null,
        description: editForm.description.trim() ? editForm.description.trim() : null,
      };

      await apiClient.put(`/companies/${id}`, payload);
      toast.success('Company updated');
      setIsEditing(false);
      await fetchCompany();
    } catch {
      toast.error('Failed to save company. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!company) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/companies/${id}`);
      toast.success('Company deleted');
      setDeleteOpen(false);
      router.push('/companies');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        const msg = getErrorMessage(err, 'Cannot delete — company is referenced by existing records.');
        toast.error(msg);
      } else {
        toast.error('Cannot delete — company is referenced by existing records.');
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !company) {
    return (
      <ProtectedLayout>
        <LoadingSkeleton variant="card" count={2} />
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <ErrorState message={error} onRetry={fetchCompany} />
      </ProtectedLayout>
    );
  }

  if (!company) {
    return (
      <ProtectedLayout>
        <EmptyState
          title="Company Not Found"
          description="The company you are looking for does not exist or has been deleted."
        />
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              onClick={() => router.push('/companies')}
              className="bg-white px-3"
              aria-label="Back to Companies"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            </div>
          </div>

          {!isEditing && (
            <div className="flex items-center gap-3">
              {canEdit && (
                <Button variant="secondary" onClick={() => setIsEditing(true)} className="bg-white">
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Company</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <Input
                  name="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Because We Can"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                <Input
                  name="vat_number"
                  value={editForm.vat_number}
                  onChange={(e) => setEditForm((p) => ({ ...p, vat_number: e.target.value }))}
                  placeholder="VAT Number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                <Input
                  name="occupation"
                  value={editForm.occupation}
                  onChange={(e) => setEditForm((p) => ({ ...p, occupation: e.target.value }))}
                  placeholder="e.g. Real Estate"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Creation Date</label>
                <Input
                  type="date"
                  value={company.creation_date ?? ''}
                  disabled
                  title="Creation date is immutable"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-base
                             focus:outline-none focus:ring-2 focus:ring-primary-gold
                             disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Additional details..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  <span className="inline-flex items-center gap-2">
                    {saving ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : null}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </span>
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="p-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">VAT Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{company.vat_number ?? 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Occupation</dt>
                <dd className="mt-1 text-sm text-gray-900">{company.occupation ?? 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Creation Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(company.creation_date)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {company.description ?? 'No description provided.'}
                </dd>
              </div>
            </dl>
          </Card>
        )}

        {deleteOpen && (
          <Modal
            isOpen={deleteOpen}
            onClose={() => {
              if (!deleting) setDeleteOpen(false);
            }}
            title="Delete Company"
          >
            <div className="space-y-4">
              <p className="text-[15px] text-gray-700 font-medium">
                This cannot be undone. All references will block deletion.
              </p>
              <div className="text-sm text-gray-600">
                Company: <span className="font-semibold text-gray-900">{company.name}</span>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                >
                  <span className="inline-flex items-center gap-2">
                    {deleting ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : null}
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

