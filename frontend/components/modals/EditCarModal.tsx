'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { Button, Input, Modal } from '@/components/ui';
import type { Car } from '@/lib/types';

interface EditCarModalProps {
  car: Car;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditCarModal({ car, onClose, onSuccess }: EditCarModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    make: car.make ?? '',
    model: car.model ?? '',
    license_plate: car.license_plate ?? '',
    year: String(car.year ?? ''),
    purchase_date: car.purchase_date ?? '',
    purchase_price:
      car.purchase_price === null || car.purchase_price === undefined ? '' : String(car.purchase_price),
    notes: car.notes ?? '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const year = Number(formData.year);
    if (!formData.make.trim() || !formData.model.trim() || !formData.license_plate.trim() || !Number.isFinite(year)) {
      toast.error('Please complete all required fields.');
      return;
    }

    try {
      setLoading(true);
      await apiClient.put(`/cars/${car.id}`, {
        make: formData.make.trim(),
        model: formData.model.trim(),
        license_plate: formData.license_plate.trim(),
        year,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price ? Number(formData.purchase_price) : null,
        notes: formData.notes.trim() || null,
      });
      toast.success('Car details updated');
      onSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update car'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Car">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Make *" name="make" value={formData.make} onChange={handleChange} autoFocus />
        <Input label="Model *" name="model" value={formData.model} onChange={handleChange} />
        <Input
          label="License Plate *"
          name="license_plate"
          value={formData.license_plate}
          onChange={handleChange}
        />
        <Input label="Year *" name="year" type="number" min={1900} max={2100} value={formData.year} onChange={handleChange} />
        <Input
          label="Purchase Date"
          name="purchase_date"
          type="date"
          value={formData.purchase_date ?? ''}
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
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
