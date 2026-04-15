'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import {
  Button,
  Card,
  Table,
  Input,
  EmptyState,
  ErrorState,
  LoadingSkeleton
} from '@/components/ui';
import CreateCompanyModal from '@/components/modals/CreateCompanyModal';
import type { Company, CompanyListResponse } from '@/lib/types';
import { useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function CompaniesPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const companiesPermission = useMemo(() => resolveCompaniesPermission(user), [user]);
  const canCreate = companiesPermission === 'full';

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.get<CompanyListResponse>('/companies?page=1&page_size=100');
      setCompanies(res.data.companies || []);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to fetch companies'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);
  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [companies, searchQuery]);

  if (loading && companies.length === 0) {
    return (
      <ProtectedLayout>
        <LoadingSkeleton variant="table" count={6} />
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <ErrorState message={error} onRetry={fetchCompanies} />
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          </div>

          {canCreate && (
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
              aria-label="New Company"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Company
            </Button>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <Input
            label="Search by company name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a name..."
          />
        </div>

        {companies.length === 0 ? (
          <EmptyState
            title="No companies yet. Create the first one."
            action={
              canCreate ? (
                <Button onClick={() => setShowCreateModal(true)} variant="primary">
                  New Company
                </Button>
              ) : undefined
            }
          />
        ) : filteredCompanies.length === 0 ? (
          <EmptyState
            title="No companies found"
            description="Try a different search term."
          />
        ) : (
          <Card className="p-4 sm:p-0 border border-gray-200">
            <div className="block sm:hidden">
              {filteredCompanies.map((company) => {
                const companyPhone = (company as any).phone ?? null;
                const contactPerson = (company as any).contact_person ?? null;
                return (
                <div key={company.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                  <div
                    className="cursor-pointer"
                    onClick={() => router.push(`/company/${company.id}`)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open company ${company.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/company/${company.id}`);
                      }
                    }}
                  >
                    <div className="font-semibold text-gray-900">{company.name}</div>
                    <div className="mt-2 text-sm text-gray-700">
                      <span className="font-medium">Industry: </span>
                      {company.occupation || <span className="text-gray-400 italic">Not set</span>}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Phone: </span>
                      {companyPhone || <span className="text-gray-400 italic">Not set</span>}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Contact Person: </span>
                      {contactPerson || <span className="text-gray-400 italic">Not set</span>}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white w-full"
                      onClick={() => router.push(`/company/${company.id}`)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => router.push(`/company/${company.id}`)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )})}
            </div>
            <div className="hidden sm:block overflow-x-auto w-full custom-scrollbar">
              <Table>
                <table className="min-w-full w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">VAT Number</th>
                      <th className="px-6 py-4 font-medium">Occupation</th>
                      <th className="px-6 py-4 font-medium">Creation Date</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCompanies.map((company) => (
                      <tr
                        key={company.id}
                        className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/company/${company.id}`)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open company ${company.name}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/company/${company.id}`);
                          }
                        }}
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{company.name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {company.vat_number || <span className="text-gray-400 italic">Not set</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {company.occupation || <span className="text-gray-400 italic">Not set</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {company.creation_date ? new Date(company.creation_date).toLocaleDateString() : <span className="text-gray-400 italic">Not set</span>}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white"
                            onClick={() => router.push(`/company/${company.id}`)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Table>
            </div>
          </Card>
        )}

        {showCreateModal && (
          <CreateCompanyModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchCompanies();
            }}
          />
        )}
      </div>
    </ProtectedLayout>
  );
}

function resolveCompaniesPermission(user: any): 'none' | 'read' | 'full' {
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
