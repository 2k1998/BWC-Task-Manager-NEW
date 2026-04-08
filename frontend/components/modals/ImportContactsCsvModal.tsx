'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { Button, Modal } from '@/components/ui';

interface ImportContactsCsvModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportContactsCsvModal({ onClose, onSuccess }: ImportContactsCsvModalProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number } | null>(null);

  const canConfirm = useMemo(() => !!file && !loading && !importSummary, [file, loading, importSummary]);

  const handleConfirm = async () => {
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.post('/contacts/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data: any = res.data || {};
      const imported =
        (typeof data.imported === 'number' ? data.imported : Number(data.imported)) ||
        (typeof data.imported_contacts === 'number' ? data.imported_contacts : Number(data.imported_contacts)) ||
        0;
      const skipped =
        (typeof data.skipped === 'number' ? data.skipped : Number(data.skipped)) ||
        (typeof data.skipped_rows === 'number' ? data.skipped_rows : Number(data.skipped_rows)) ||
        0;

      setImportSummary({ imported, skipped });
    } catch (err: unknown) {
      toast.error('Failed to import CSV. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Import Contacts CSV">
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">CSV File (.csv)</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={loading || !!importSummary}
            className="block w-full text-[15px] text-gray-700"
            aria-label="Choose CSV file"
          />
          {file && <p className="text-sm text-gray-600">Selected: <span className="font-medium text-gray-800">{file.name}</span></p>}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-700">
          ⚠️ If your contacts use Greek characters, save the file as UTF-8. If it fails to decode, the system will fall back to Windows-1253.
        </div>

        {importSummary && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-[15px] text-gray-700">
            Imported <span className="font-semibold">{importSummary.imported}</span> contacts, skipped{' '}
            <span className="font-semibold">{importSummary.skipped}</span> rows with missing required fields
          </div>
        )}

        <div className="flex justify-end gap-3 mt-2">
          {!importSummary ? (
            <>
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleConfirm} disabled={!canConfirm}>
                {loading ? 'Importing...' : 'Confirm'}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                onSuccess();
                onClose();
              }}
            >
              Done
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

