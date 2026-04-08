'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { TaskDocumentAttachment, User } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, EmptyState, LoadingSkeleton, Modal, Table } from '@/components/ui';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploaderDisplayName(user: User | null): string {
  if (!user) return '';
  return `${user.first_name} ${user.last_name}`.trim();
}

function canRemoveAttachment(
  user: User | null,
  taskOwnerId: string | undefined,
  uploadedBy: string,
): boolean {
  if (!user) return false;
  if (user.user_type === 'Admin') return true;
  if (taskOwnerId && user.id === taskOwnerId) return true;
  if (uploadedBy.trim() === uploaderDisplayName(user)) return true;
  return false;
}

function DocIcon() {
  return (
    <svg
      className="w-5 h-5 text-gray-500 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

interface TaskAttachmentsSectionProps {
  taskId: string;
  taskOwnerUserId?: string;
}

export default function TaskAttachmentsSection({ taskId, taskOwnerUserId }: TaskAttachmentsSectionProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<TaskDocumentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachUploading, setAttachUploading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TaskDocumentAttachment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<TaskDocumentAttachment[]>(`/tasks/${taskId}/documents`);
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadOne = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    await apiClient.post(`/tasks/${taskId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const handleAttachChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setAttachUploading(true);
    try {
      for (const file of Array.from(files)) {
        try {
          await uploadOne(file);
        } catch (err) {
          toast.error(getErrorMessage(err, `Failed to upload "${file.name}"`));
        }
      }
      await fetchDocuments();
    } finally {
      setAttachUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/tasks/${taskId}/documents/${removeTarget.document_id}`);
      setItems((prev) => prev.filter((d) => d.document_id !== removeTarget.document_id));
      toast.success('Attachment removed');
      setRemoveTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove attachment'));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">Attachments</h2>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*"
            className="hidden"
            onChange={handleAttachChange}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={attachUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {attachUploading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Uploading…
              </span>
            ) : (
              'Attach File'
            )}
          </Button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <LoadingSkeleton variant="table" count={4} />
        ) : items.length === 0 ? (
          <EmptyState title="No attachments yet." />
        ) : (
          <Table>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Uploaded by</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((doc) => {
                  const showRemove = canRemoveAttachment(user, taskOwnerUserId, doc.uploaded_by);
                  return (
                    <tr key={doc.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <DocIcon />
                          <span className="font-medium text-gray-900 truncate" title={doc.filename}>
                            {doc.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">{doc.uploaded_by}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        {new Date(doc.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatFileSize(doc.size_bytes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {showRemove ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setRemoveTarget(doc)}
                          >
                            Remove
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Table>
        )}
      </div>

      <Modal
        isOpen={!!removeTarget}
        onClose={() => !deleteLoading && setRemoveTarget(null)}
        title="Remove attachment"
      >
        <p className="text-gray-700 mb-6">Remove this attachment?</p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={deleteLoading} onClick={() => setRemoveTarget(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteLoading}
            onClick={handleConfirmRemove}
          >
            {deleteLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Remove
              </span>
            ) : (
              'Remove'
            )}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
