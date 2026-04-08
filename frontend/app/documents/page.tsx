'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { DocumentListResponse } from '@/lib/types';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get<DocumentListResponse>('/documents');
      setDocuments(response.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load documents'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 100MB limit');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      await apiClient.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await fetchDocuments();
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Document uploaded successfully');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to upload document'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId: string, filename: string) => {
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
    } catch (err: any) {
      toast.error('Failed to download document');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await apiClient.delete(`/documents/${documentId}`);
      await fetchDocuments();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setCanDelete(false);
        // Interceptor handles the toast
      } else {
        toast.error(getErrorMessage(err, 'Failed to delete document'));
      }
    }
  };

  // Test delete permission on first document
  useEffect(() => {
    const testDeletePermission = async () => {
      if (documents && documents.documents.length > 0) {
        try {
          await apiClient.delete(`/documents/${documents.documents[0].id}`, {
            validateStatus: (status) => status === 403 || status === 200,
          });
          setCanDelete(true);
        } catch (err: any) {
          setCanDelete(err.response?.status !== 403);
        }
      }
    };
    testDeletePermission();
  }, [documents]);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`px-4 py-2 bg-primary-gold text-black font-semibold rounded-lg hover:bg-opacity-90 transition-colors cursor-pointer inline-block ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </label>
          </div>
        </div>

        {loading && <LoadingSkeleton variant="table" count={5} />}
        
        {!loading && error && (
          <ErrorState message={error} onRetry={fetchDocuments} />
        )}

        {!loading && !error && documents && documents.documents.length === 0 && (
          <EmptyState 
            icon={<div className="text-6xl">📄</div>}
            title="No documents found"
            description="Upload your first document to get started."
          />
        )}

        {!loading && !error && documents && documents.documents.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents?.documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {doc.original_filename}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(doc.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDownload(doc.id, doc.original_filename)}
                      className="text-primary-gold hover:text-yellow-700 mr-4"
                    >
                      Download
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
