'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Image from 'next/image';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Button, Card, ErrorState, Input, LoadingSkeleton } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { ProfileMeResponse } from '@/lib/types';

interface ProfileFormState {
  bio: string;
  birthday: string;
  photoFile: File | null;
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

function extractDocumentId(responseData: unknown): string | null {
  const row = asRecord(responseData);
  const document = asRecord(row.document);
  const file = asRecord(row.file);
  return (
    (typeof row.id === 'string' ? row.id : null) ||
    (typeof row.document_id === 'string' ? row.document_id : null) ||
    (typeof row.file_id === 'string' ? row.file_id : null) ||
    (typeof document.id === 'string' ? document.id : null) ||
    (typeof file.id === 'string' ? file.id : null) ||
    null
  );
}

export default function ProfilePage() {
  const tProfile = useTranslations('Profile');
  const tCommon = useTranslations('Common');
  const tAuth = useTranslations('Auth');
  const { language, setLanguage } = useLanguage();
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [form, setForm] = useState<ProfileFormState>({ bio: '', birthday: '', photoFile: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (form.photoFile) return URL.createObjectURL(form.photoFile);
    return profile?.profile_photo_url || null;
  }, [form.photoFile, profile?.profile_photo_url]);

  useEffect(() => {
    return () => {
      if (previewUrl && form.photoFile) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, form.photoFile]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<ProfileMeResponse>('/profile/me');
      const data = response.data || {};
      setProfile(data);
      setForm({
        bio: data.bio || '',
        birthday: data.birthday ? data.birthday.slice(0, 10) : '',
        photoFile: null,
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load profile.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      let profilePhotoFileId = profile?.profile_photo_file_id || null;

      if (form.photoFile) {
        const fd = new FormData();
        fd.append('file', form.photoFile);
        const uploadResponse = await apiClient.post('/documents', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const nextFileId = extractDocumentId(uploadResponse.data);
        if (!nextFileId) {
          throw new Error('Uploaded profile image did not return a document id.');
        }
        profilePhotoFileId = nextFileId;
      }

      await apiClient.put('/profile/me', {
        bio: form.bio.trim() || null,
        birthday: form.birthday || null,
        profile_photo_file_id: profilePhotoFileId,
      });

      toast.success(tCommon('success'));
      await fetchProfile();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save profile.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedLayout>
        <LoadingSkeleton variant="card" count={2} />
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <ErrorState message={error} onRetry={fetchProfile} />
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tProfile('editProfile')}</h1>
          <p className="text-gray-600 text-sm">Manage your account details and profile information.</p>
        </div>

        <Card className="space-y-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-16 h-16 rounded-full border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
              {previewUrl ? (
                <Image src={previewUrl} alt={tProfile('editProfile')} className="w-full h-full object-cover" width={64} height={64} unoptimized />
              ) : (
                <span className="text-gray-500 text-xs">{tProfile('changePhoto')}</span>
              )}
            </div>
            <div className="text-center sm:text-left">
              <label className="block text-[13px] font-medium text-gray-600 mb-1">{tProfile('changePhoto')}</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setForm((prev) => ({ ...prev, photoFile: e.target.files?.[0] || null }))}
                className="text-sm text-gray-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" value={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()} disabled />
            <Input label="Username" value={profile?.username || ''} disabled />
            <Input label={tAuth('email')} value={profile?.email || ''} disabled />
            <Input label="User Type" value={profile?.user_type || ''} disabled />
          </div>

          <Input
            label="Birthday"
            type="date"
            value={form.birthday}
            onChange={(e) => setForm((prev) => ({ ...prev, birthday: e.target.value }))}
          />

          <div className="flex justify-center">
            <div className="inline-flex rounded-md shadow-sm" role="group" aria-label="Language toggle">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${
                  language === 'en'
                    ? 'bg-primary-gold/10 text-brand-brown border-primary-gold/40'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('el')}
                className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${
                  language === 'el'
                    ? 'bg-primary-gold/10 text-brand-brown border-primary-gold/40'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Greek
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              rows={4}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#D1AE62] focus:border-[#D1AE62]"
              placeholder="Tell your team a bit about yourself..."
            />
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? `${tCommon('loading')}...` : tCommon('save')}
            </Button>
          </div>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
