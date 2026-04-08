import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { Modal, Button, Input } from '@/components/ui';

interface CreateCompanyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCompanyModal({ onClose, onSuccess }: CreateCompanyModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    vat_number: '',
    occupation: '',
    creation_date: '',
    description: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = useMemo(() => formData.name.trim().length > 0, [formData.name]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError('Company Name is required.');
      return;
    }

    try {
      setLoading(true);
      const payload: any = { ...formData };
      payload.name = trimmedName;
      
      // Convert empty strings to null for optional fields
      if (!payload.vat_number) payload.vat_number = null;
      if (!payload.occupation) payload.occupation = null;
      if (!payload.creation_date) payload.creation_date = null;
      if (!payload.description) payload.description = null;

      await apiClient.post('/companies', payload);
      toast.success('Company created successfully');
      onSuccess();
    } catch (err: any) {
      // PRD-required UX copy (do not show raw backend errors as primary UX)
      toast.error('Failed to save company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Company">
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
            error={formError || undefined}
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
            name="creation_date"
            type="date"
            value={formData.creation_date}
            onChange={handleChange}
          />
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
          <Button type="submit" variant="primary" disabled={loading || !canSubmit}>
            <span className="inline-flex items-center gap-2">
              {loading ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              ) : null}
              {loading ? 'Creating...' : 'Create Company'}
            </span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
