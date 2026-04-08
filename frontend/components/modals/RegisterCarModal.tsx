'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';

import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { Button, Input, Modal, Select } from '@/components/ui';
import type { CarStatus } from '@/lib/types';

interface RegisterCarModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function RegisterCarModal({ onClose, onSuccess }: RegisterCarModalProps) {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    license_plate: '',
    year: '',
    purchase_date: '',
    purchase_price: '',
    status: 'available' as CarStatus,
    notes: '',
  });

  const canSubmit = useMemo(() => {
    return (
      formData.make.trim().length > 0 &&
      formData.model.trim().length > 0 &&
      formData.license_plate.trim().length > 0 &&
      formData.year.trim().length > 0
    );
  }, [formData.license_plate, formData.make, formData.model, formData.year]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const make = formData.make.trim();
    const model = formData.model.trim();
    const licensePlate = formData.license_plate.trim();
    const year = Number(formData.year);

    if (!make || !model || !licensePlate || !Number.isFinite(year)) {
      setFormError('Please fill all required fields correctly.');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/cars', {
        make,
        model,
        license_plate: licensePlate,
        year,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price ? Number(formData.purchase_price) : null,
        status: formData.status,
        notes: formData.notes.trim() || null,
      });
      toast.success('Car registered successfully');
      onSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to register car'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Register Car">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Make *"
          name="make"
          value={formData.make}
          onChange={handleChange}
          placeholder="e.g. Toyota"
          error={formError || undefined}
          autoFocus
        />
        <Input
          label="Model *"
          name="model"
          value={formData.model}
          onChange={handleChange}
          placeholder="e.g. Corolla"
        />
        <Input
          label="License Plate *"
          name="license_plate"
          value={formData.license_plate}
          onChange={handleChange}
          placeholder="e.g. ABC-1234"
        />
        <Input
          label="Year *"
          name="year"
          type="number"
          min={1900}
          max={2100}
          value={formData.year}
          onChange={handleChange}
          placeholder="e.g. 2022"
        />
        <Input
          label="Purchase Date"
          name="purchase_date"
          type="date"
          value={formData.purchase_date}
          onChange={handleChange}
        />
        <Input
          label="Purchase Price"
          name="purchase_price"
          type="number"
          min={0}
          step="0.01"
          value={formData.purchase_price}
          onChange={handleChange}
          placeholder="e.g. 12500"
        />
        <Select
          label="Status"
          name="status"
          value={formData.status}
          onChange={handleChange}
          options={[
            { value: 'available', label: 'Available' },
            { value: 'rented', label: 'Rented' },
            { value: 'sold', label: 'Sold' },
          ]}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary-gold"
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading || !canSubmit}>
            {loading ? 'Saving...' : 'Register Car'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
