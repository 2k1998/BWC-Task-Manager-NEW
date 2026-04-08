'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { Button, Input, Modal } from '@/components/ui';

interface CreateContactModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type ContactForm = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  company_name: string;
  notes: string;
};

type ContactFormErrors = Partial<Record<keyof ContactForm, string>>;

export default function CreateContactModal({ onClose, onSuccess }: CreateContactModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ContactForm>({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    company_name: '',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<ContactFormErrors>({});

  const canSubmit = useMemo(() => {
    return formData.first_name.trim().length > 0 && formData.last_name.trim().length > 0 && formData.phone.trim().length > 0;
  }, [formData.first_name, formData.last_name, formData.phone]);

  const handleChange = (key: keyof ContactForm, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) {
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validate = () => {
    const errs: ContactFormErrors = {};

    if (!formData.first_name.trim()) errs.first_name = 'First Name is required.';
    if (!formData.last_name.trim()) errs.last_name = 'Last Name is required.';
    if (!formData.phone.trim()) errs.phone = 'Phone is required.';

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setLoading(true);
      const payload: any = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() ? formData.email.trim() : null,
        company_name: formData.company_name.trim() ? formData.company_name.trim() : null,
        notes: formData.notes.trim() ? formData.notes.trim() : null,
      };

      await apiClient.post('/contacts', payload);
      toast.success('Contact created successfully');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to create contact. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name *"
            value={formData.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
            placeholder="e.g. John"
            required
            autoFocus
            error={formErrors.first_name}
          />
          <Input
            label="Last Name *"
            value={formData.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            placeholder="e.g. Doe"
            required
            error={formErrors.last_name}
          />
        </div>

        <Input
          label="Phone *"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="e.g. +30 690..."
          required
          error={formErrors.phone}
        />

        <Input
          label="Email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="e.g. name@example.com"
          error={formErrors.email}
        />

        <Input
          label="Company Name"
          value={formData.company_name}
          onChange={(e) => handleChange('company_name', e.target.value)}
          placeholder="e.g. Acme Ltd"
          error={formErrors.company_name}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 border rounded-md text-[15px] focus:ring-2 focus:ring-primary-gold outline-none ${
              formErrors.notes ? 'border-red-400 ring-red-400' : 'border-gray-300'
            }`}
            placeholder="Optional notes..."
          />
          {formErrors.notes && <p className="mt-1 text-sm text-red-600">{formErrors.notes}</p>}
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
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : null}
              {loading ? 'Creating...' : 'Create Contact'}
            </span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}

