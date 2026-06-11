'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
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

function DownloadIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3"
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
  const tTasks = useTranslations('Tasks');
  const [items, setItems] = useState<TaskDocumentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachUploading, setAttachUploading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TaskDocumentAttachment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});
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

  const handleDownload = async (documentId: string, filename: string) => {
    setDownloadErrors((prev) => {
      const next = { ...prev };
      delete next[documentId];
      return next;
    });
    setDownloadingIds((prev) => new Set(prev).add(documentId));
    try {
      const response = await apiClient.get(`/documents/${documentId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      let message = tTasks('downloadFailed');
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 404) {
          message = tTasks('downloadFileNotAvailable');
        } else if (status === 403) {
          message = tTasks('downloadForbidden');
        }
      }
      setDownloadErrors((prev) => ({
        ...prev,
        [documentId]: message,
      }));
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
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
    <Card className="p-0 min-w-0">
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

      <div className="p-6 @container min-w-0">
        {loading ? (
          <LoadingSkeleton variant="table" count={4} />
        ) : items.length === 0 ? (
          <EmptyState title="No attachments yet." />
        ) : (
          <Table className="min-w-0">
            <div className="overflow-x-auto min-w-0">
              <table className="w-full min-w-[20rem] text-sm table-fixed">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                    <th className="px-3 py-3 font-medium w-px">File</th>
                    <th className="px-3 py-3 font-medium w-28 hidden @sm:table-cell">Uploaded by</th>
                    <th className="px-3 py-3 font-medium w-32 hidden @lg:table-cell">Date</th>
                    <th className="px-3 py-3 font-medium w-20">Size</th>
                    <th className="px-3 py-3 font-medium w-36 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((doc) => {
                    const showRemove = canRemoveAttachment(user, taskOwnerUserId, doc.uploaded_by);
                    return (
                      <tr key={doc.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-3 max-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <DocIcon />
                            <span className="font-medium text-gray-900 truncate" title={doc.filename}>
                              {doc.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-700 hidden @sm:table-cell max-w-0">
                          <span className="block truncate" title={doc.uploaded_by}>
                            {doc.uploaded_by}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-600 hidden @lg:table-cell max-w-0">
                          <span className="block truncate" title={new Date(doc.created_at).toLocaleString()}>
                            {new Date(doc.created_at).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap w-20">
                          {formatFileSize(doc.size_bytes)}
                        </td>
                        <td className="px-3 py-3 text-right w-36 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 shrink-0 flex-nowrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={downloadingIds.has(doc.document_id)}
                              onClick={() => handleDownload(doc.document_id, doc.filename)}
                              aria-label={`Download ${doc.filename}`}
                            >
                              {downloadingIds.has(doc.document_id) ? (
                                <span className="inline-block h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <DownloadIcon />
                              )}
                            </Button>
                            {showRemove ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => setRemoveTarget(doc)}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                          {downloadErrors[doc.document_id] ? (
                            <p className="text-xs text-red-600 mt-1">{downloadErrors[doc.document_id]}</p>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
