'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';

import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { Button, Input, Modal } from '@/components/ui';

interface AddCarExpenseModalProps {
  carId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCarExpenseModal({ carId, onClose, onSuccess }: AddCarExpenseModalProps) {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    expense_type: '',
    amount: '',
    transaction_date: '',
    description: '',
  });

  const canSubmit = useMemo(() => {
    return formData.expense_type.trim().length > 0 && formData.transaction_date.length > 0 && Number(formData.amount) > 0;
  }, [formData.amount, formData.expense_type, formData.transaction_date]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      await apiClient.post(`/cars/${carId}/expense`, {
        expense_type: formData.expense_type.trim(),
        amount: Number(formData.amount),
        transaction_date: formData.transaction_date,
        description: formData.description.trim() || null,
      });
      toast.success('Expense added');
      onSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to add expense'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Add Expense">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Expense Type *"
          name="expense_type"
          value={formData.expense_type}
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
            {loading ? 'Saving...' : 'Add Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
