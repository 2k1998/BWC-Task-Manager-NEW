'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { Button, Input, Modal } from '@/components/ui';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateTimeLocalValue(isoString?: string | null) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromDateTimeLocalValue(value: string) {
  // `value` is interpreted as local time by the browser; convert to ISO for backend.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

interface ScheduleDailyCallModalProps {
  mode: 'create' | 'edit';
  contactId?: string;
  dailyCallId?: string;
  initialNextCallAt?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ScheduleDailyCallModal({
  mode,
  contactId,
  dailyCallId,
  initialNextCallAt,
  onClose,
  onSuccess,
}: ScheduleDailyCallModalProps) {
  const tDaily = useTranslations('DailyCalls');
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('Profile');
  const [loading, setLoading] = useState(false);
  const [nextCallAtLocal, setNextCallAtLocal] = useState<string>(() => toDateTimeLocalValue(initialNextCallAt));

  useEffect(() => {
    if (mode === 'edit') setNextCallAtLocal(toDateTimeLocalValue(initialNextCallAt));
  }, [initialNextCallAt, mode]);

  const canSubmit = useMemo(() => nextCallAtLocal.trim().length > 0, [nextCallAtLocal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const iso = fromDateTimeLocalValue(nextCallAtLocal);
    if (!iso) {
      toast.error(tCommon('error'));
      return;
    }

    try {
      setLoading(true);
      const payload: any = { next_call_at: iso };

      if (mode === 'create') {
        if (!contactId) {
          toast.error(tCommon('error'));
          return;
        }
        payload.contact_id = contactId;
        await apiClient.post('/daily-calls', payload);
        toast.success(tCommon('success'));
      } else {
        if (!dailyCallId) {
          toast.error(tCommon('error'));
          return;
        }
        await apiClient.put(`/daily-calls/${dailyCallId}`, payload);
        toast.success(tCommon('success'));
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={mode === 'create' ? tDaily('newCall') : tCommon('edit')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={tDaily('newCall')}
          type="datetime-local"
          value={nextCallAtLocal}
          onChange={(e) => setNextCallAtLocal(e.target.value)}
          required
          autoFocus
        />

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {tCommon('cancel')}
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
              {loading ? `${tCommon('loading')}...` : mode === 'create' ? tDaily('newCall') : tProfile('saveChanges')}
            </span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}

