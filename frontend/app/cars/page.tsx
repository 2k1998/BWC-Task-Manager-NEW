'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import ProtectedLayout from '@/components/ProtectedLayout';
import RegisterCarModal from '@/components/modals/RegisterCarModal';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { Car, CarListResponse } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingSkeleton, Select, Table } from '@/components/ui';

export default function CarsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const carsPermission = useMemo(() => resolveCarsPermission(user), [user]);
  const canManage = carsPermission === 'full';

  const fetchCars = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params: Record<string, unknown> = { page: 1, page_size: 100 };
      if (statusFilter) params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get<CarListResponse>('/cars', { params });
      setCars(res.data.cars || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch cars'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchCars();
  }, [fetchCars]);

  const statusBadgeColor = (status: string) => {
    if (status === 'available') return 'green';
    if (status === 'rented') return 'yellow';
    return 'gray';
  };

  if (loading && cars.length === 0) {
    return (
      <ProtectedLayout>
        <LoadingSkeleton variant="table" count={6} />
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <ErrorState message={error} onRetry={fetchCars} />
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

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Cars</h1>
          {canManage && (
            <Button onClick={() => setShowRegisterModal(true)} variant="primary" aria-label="Register Car" className="w-full sm:w-auto">
              Register Car
            </Button>
          )}
        </div>

        <Card variant="dense" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <Input
              label="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by make, model, or plate..."
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'available', label: 'Available' },
                { value: 'rented', label: 'Rented' },
                { value: 'sold', label: 'Sold' },
              ]}
            />
          </div>
        </Card>

        {cars.length === 0 ? (
          <EmptyState title="No vehicles registered." />
        ) : (
          <Card className="p-4 sm:p-0 border border-gray-200">
            <div className="block sm:hidden">
              {cars.map((car) => (
                <div key={car.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                  <div
                    className="cursor-pointer"
                    onClick={() => router.push(`/cars/${car.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/cars/${car.id}`);
                      }
                    }}
                  >
                    <div className="font-semibold text-gray-900">{car.license_plate}</div>
                    <div className="mt-2 text-sm text-gray-700">
                      <span className="font-medium">Brand/Model: </span>
                      {car.make} {car.model}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Assigned Driver: </span>
                      {(car as any).assigned_driver_name || <span className="text-gray-400 italic">Not set</span>}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">Status: </span>
                      <span className="capitalize">{car.status}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" size="sm" className="bg-white w-full" onClick={() => router.push(`/cars/${car.id}`)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" className="w-full" onClick={() => router.push(`/cars/${car.id}`)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-x-auto w-full custom-scrollbar">
              <Table>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Car</th>
                      <th className="px-6 py-4 font-medium">License Plate</th>
                      <th className="px-6 py-4 font-medium">Year</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cars.map((car) => (
                      <tr
                        key={car.id}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/cars/${car.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/cars/${car.id}`);
                          }
                        }}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900">{car.make} {car.model}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{car.license_plate}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{car.year || '-'}</td>
                        <td className="px-6 py-4">
                          <Badge variant="status" color={statusBadgeColor(car.status)}>
                            {car.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Table>
            </div>
          </Card>
        )}

        {showRegisterModal && canManage && (
          <RegisterCarModal
            onClose={() => setShowRegisterModal(false)}
            onSuccess={() => {
              setShowRegisterModal(false);
              fetchCars();
            }}
          />
        )}
      </div>
    </ProtectedLayout>
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
