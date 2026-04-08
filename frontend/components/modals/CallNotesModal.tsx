'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { Button, Input, Modal } from '@/components/ui';
import type { CallNoteFile } from '@/lib/types';

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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function minutesUntilExpiry(value?: string | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return (dt.getTime() - Date.now()) / 60000;
}

async function downloadDocument(documentId: string, filename: string) {
  const response = await apiClient.get(`/documents/${documentId}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

interface CallNotesModalProps {
  dailyCallId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CallNotesModal({ dailyCallId, onClose, onSuccess }: CallNotesModalProps) {
  const tDaily = useTranslations('DailyCalls');
  const tTasks = useTranslations('Tasks');
  const tCommon = useTranslations('Common');
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [notesFiles, setNotesFiles] = useState<CallNoteFile[]>([]);
  const [notesError, setNotesError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [callDescription, setCallDescription] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [nextCallAtLocal, setNextCallAtLocal] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchNotes = async () => {
      try {
        setLoadingNotes(true);
        setNotesError('');

        const res = await apiClient.get(`/daily-calls/${dailyCallId}/call-notes`);
        const data: any = res.data || {};

        const files: CallNoteFile[] =
          data.files || data.call_notes_files || data.note_files || data || [];

        if (!cancelled) setNotesFiles(Array.isArray(files) ? files : []);
      } catch (err: unknown) {
        if (cancelled) return;
        setNotesError(tCommon('error'));
        toast.error(tCommon('error'));
      } finally {
        if (!cancelled) setLoadingNotes(false);
      }
    };

    fetchNotes();

    return () => {
      cancelled = true;
    };
  }, [dailyCallId]);

  const canSubmit = useMemo(() => nextCallAtLocal.trim().length > 0, [nextCallAtLocal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const iso = fromDateTimeLocalValue(nextCallAtLocal);
    if (!iso) {
      toast.error(tCommon('error'));
      return;
    }

    try {
      setSubmitting(true);
      // Phase 12 backend:
      // - Schedule + optional text call note are updated via PUT /daily-calls/:id
      // - Attachments are uploaded via POST /daily-calls/:id/notes
      const payload: any = { next_call_at: iso };
      if (callDescription.trim()) payload.call_note = callDescription.trim();

      await apiClient.put(`/daily-calls/${dailyCallId}`, payload);

      if (attachedFile) {
        const fileFormData = new FormData();
        fileFormData.append('file', attachedFile);
        await apiClient.post(`/daily-calls/${dailyCallId}/notes`, fileFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success(tCommon('success'));
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(tCommon('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={tDaily('callNotes')}>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="text-[13px] text-gray-600">
            Call notes files are temporary and expire automatically after 7 days.
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700">{tTasks('comments')}</div>

          {loadingNotes ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-gray-200 rounded animate-pulse h-10" />
              ))}
            </div>
          ) : notesError ? (
            <div className="text-sm text-red-600">{notesError}</div>
          ) : notesFiles.length === 0 ? (
            <div className="text-sm text-gray-600">{tTasks('noCommentsYet')}</div>
          ) : (
            <div className="space-y-2">
              {notesFiles.map((f) => {
                const expiresAt = f.expires_at;
                const mins = minutesUntilExpiry(expiresAt);
                const expiresIn24h = mins !== null && mins <= 24 * 60;
                const expiresIn7d = mins !== null && mins <= 7 * 24 * 60;

                const documentId = f.document_id || f.file_id;
                const name = f.original_filename || f.filename || documentId || 'file';

                return (
                  <div key={f.id || f.file_id || name} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="text-primary-gold hover:text-yellow-700 underline text-sm font-medium"
                        onClick={async () => {
                          if (!documentId) {
                            toast.error('Missing document reference for this note.');
                            return;
                          }
                          try {
                            await downloadDocument(documentId, name);
                          } catch {
                            toast.error('Failed to download note file.');
                          }
                        }}
                        aria-label={`Download ${name}`}
                      >
                        {name}
                      </button>
                      <div className="text-xs text-gray-500 mt-1">
                        {expiresAt ? `Expires: ${new Date(expiresAt).toLocaleString()}` : 'Expiry: Not set'}
                      </div>
                      {expiresIn24h && <div className="text-xs text-red-600 mt-1">Expires in less than 24 hours.</div>}
                      {!expiresIn24h && expiresIn7d && <div className="text-xs text-amber-600 mt-1">Expires within 7 days.</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tTasks('description')}</label>
            <textarea
              value={callDescription}
              onChange={(e) => setCallDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[15px] focus:ring-2 focus:ring-primary-gold outline-none"
              placeholder={tTasks('writeAComment')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tDaily('callNotes')}</label>
            <input
              type="file"
              onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
              disabled={submitting}
              className="block w-full text-[15px] text-gray-700"
              aria-label="Attach call notes file"
            />
          </div>

          <Input
            label={tDaily('newCall')}
            type="datetime-local"
            value={nextCallAtLocal}
            onChange={(e) => setNextCallAtLocal(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting || !canSubmit}>
              <span className="inline-flex items-center gap-2">
                {submitting ? (
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
                {submitting ? `${tCommon('loading')}...` : tCommon('save')}
              </span>
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

