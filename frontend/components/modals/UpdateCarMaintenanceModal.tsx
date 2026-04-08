'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { Button, Input, Modal } from '@/components/ui';
import type { CarMaintenance } from '@/lib/types';

interface UpdateCarMaintenanceModalProps {
  carId: string;
  maintenance: CarMaintenance | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UpdateCarMaintenanceModal({
  carId,
  maintenance,
  onClose,
  onSuccess,
}: UpdateCarMaintenanceModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    last_service_date: maintenance?.last_service_date ?? '',
    next_service_date: maintenance?.next_service_date ?? '',
    last_kteo_date: maintenance?.last_kteo_date ?? '',
    next_kteo_date: maintenance?.next_kteo_date ?? '',
    last_tyre_change_date: maintenance?.last_tyre_change_date ?? '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await apiClient.put(`/cars/${carId}/maintenance`, {
        last_service_date: formData.last_service_date || null,
        next_service_date: formData.next_service_date || null,
        last_kteo_date: formData.last_kteo_date || null,
        next_kteo_date: formData.next_kteo_date || null,
        last_tyre_change_date: formData.last_tyre_change_date || null,
      });
      toast.success('Maintenance updated');
      onSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update maintenance'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Update Maintenance">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Last Service Date"
          name="last_service_date"
          type="date"
          value={formData.last_service_date}
          onChange={handleChange}
        />
        <Input
          label="Next Service Date"
          name="next_service_date"
          type="date"
          value={formData.next_service_date}
          onChange={handleChange}
        />
        <Input
          label="Last KTEO Date"
          name="last_kteo_date"
          type="date"
          value={formData.last_kteo_date}
          onChange={handleChange}
        />
        <Input
          label="Next KTEO Date"
          name="next_kteo_date"
          type="date"
          value={formData.next_kteo_date}
          onChange={handleChange}
        />
        <Input
          label="Last Tyre Change Date"
          name="last_tyre_change_date"
          type="date"
          value={formData.last_tyre_change_date}
          onChange={handleChange}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Saving...' : 'Update Maintenance'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
