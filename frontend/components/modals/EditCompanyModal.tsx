import React, { useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { Modal, Button, Input } from '@/components/ui';
import type { Company } from '@/lib/types';

interface EditCompanyModalProps {
  company: Company;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditCompanyModal({ company, onClose, onSuccess }: EditCompanyModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: company.name,
    vat_number: company.vat_number || '',
    occupation: company.occupation || '',
    description: company.description || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Company Name is required');
      return;
    }

    try {
      setLoading(true);
      const payload: any = { ...formData };
      
      // Convert empty strings to null for optional fields
      if (!payload.vat_number) payload.vat_number = null;
      if (!payload.occupation) payload.occupation = null;
      if (!payload.description) payload.description = null;

      await apiClient.put(`/admin/companies/${company.id}`, payload);
      toast.success('Company updated successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update company'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Company">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Because We Can"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
          <Input
            name="vat_number"
            value={formData.vat_number}
            onChange={handleChange}
            placeholder="VAT Number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
          <Input
            name="occupation"
            value={formData.occupation}
            onChange={handleChange}
            placeholder="e.g. Real Estate"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Creation Date</label>
          <Input
            type="date"
            value={company.creation_date || ''}
            disabled
            className="bg-gray-50 opacity-70 cursor-not-allowed"
            title="Creation date is immutable"
          />
          <p className="text-xs text-gray-500 mt-1">Creation date cannot be modified.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold outline-none"
            placeholder="Additional details..."
          />
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
