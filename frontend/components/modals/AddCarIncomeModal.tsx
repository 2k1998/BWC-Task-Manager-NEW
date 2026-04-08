'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';

import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { Button, Input, Modal, Select } from '@/components/ui';

interface AddCarIncomeModalProps {
  carId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCarIncomeModal({ carId, onClose, onSuccess }: AddCarIncomeModalProps) {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customer_name: '',
    amount: '',
    income_type: 'rental',
    transaction_date: '',
    description: '',
  });

  const canSubmit = useMemo(() => {
    return (
      formData.customer_name.trim().length > 0 &&
      formData.transaction_date.length > 0 &&
      Number(formData.amount) > 0
    );
  }, [formData.amount, formData.customer_name, formData.transaction_date]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setFormError('Please fill all required fields.');
      return;
    }
    try {
      setLoading(true);
      await apiClient.post(`/cars/${carId}/income`, {
        customer_name: formData.customer_name.trim(),
        amount: Number(formData.amount),
        income_type: formData.income_type,
        transaction_date: formData.transaction_date,
        description: formData.description.trim() || null,
      });
      toast.success('Income added');
      onSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to add income'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Add Income">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Customer Name *"
          name="customer_name"
          value={formData.customer_name}
          onChange={handleChange}
          error={formError || undefined}
          autoFocus
        />
        <Input
          label="Amount *"
          name="amount"
          type="number"
          step="0.01"
          min={0}
          value={formData.amount}
          onChange={handleChange}
        />
        <Select
          label="Income Type"
          name="income_type"
          value={formData.income_type}
          onChange={handleChange}
          options={[
            { value: 'rental', label: 'Rental' },
            { value: 'sale', label: 'Sale' },
          ]}
        />
        <Input
          label="Transaction Date *"
          name="transaction_date"
          type="date"
          value={formData.transaction_date}
          onChange={handleChange}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary-gold"
            placeholder="Optional description..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading || !canSubmit}>
            {loading ? 'Saving...' : 'Add Income'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
