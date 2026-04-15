'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingSkeleton, Modal, Table } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import type { Contact, ContactListResponse, DailyCall, DailyCallListResponse } from '@/lib/types';

import CreateContactModal from '@/components/modals/CreateContactModal';
import EditContactModal from '@/components/modals/EditContactModal';
import ImportContactsCsvModal from '@/components/modals/ImportContactsCsvModal';
import ScheduleDailyCallModal from '@/components/modals/ScheduleDailyCallModal';
import CallNotesModal from '@/components/modals/CallNotesModal';

type ContactsTab = 'all' | 'daily';

function formatDateTime(value?: string | null) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleString();
}

function minutesUntil(value?: string | null) {
  if (!value) return null;
  const next = new Date(value);
  if (Number.isNaN(next.getTime())) return null;
  return (next.getTime() - Date.now()) / 60000;
}

export default function ContactsPage() {
  const tContacts = useTranslations('Contacts');
  const tDaily = useTranslations('DailyCalls');
  const tCommon = useTranslations('Common');
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ContactsTab>('all');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dailyCalls, setDailyCalls] = useState<DailyCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateContact, setShowCreateContact] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [showImportCsv, setShowImportCsv] = useState(false);

  const [scheduleModal, setScheduleModal] = useState<
    | { open: false }
    | { open: true; mode: 'create'; contactId: string }
    | { open: true; mode: 'edit'; dailyCallId: string; initialNextCallAt?: string | null }
  >({ open: false });

  const [callNotesModal, setCallNotesModal] = useState<
    | { open: false }
    | { open: true; dailyCallId: string }
  >({ open: false });

  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState(false);

  const [deleteDailyCall, setDeleteDailyCall] = useState<DailyCall | null>(null);
  const [deletingDailyCall, setDeletingDailyCall] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [contactsRes, dailyCallsRes] = await Promise.all([
        apiClient.get<ContactListResponse>('/contacts?page=1&page_size=100'),
        apiClient.get<DailyCallListResponse>('/daily-calls?page=1&page_size=100'),
      ]);

      setContacts(contactsRes.data.contacts || []);
      setDailyCalls(dailyCallsRes.data.daily_calls || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load contacts and daily calls'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [fetchAll, user]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;

    return contacts.filter((c) => {
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      return fullName.includes(q) || phone.includes(q);
    });
  }, [contacts, searchQuery]);

  const contactById = useMemo(() => {
    const m = new Map<string, Contact>();
    contacts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contacts]);

  const sortedDailyCalls = useMemo(() => {
    const copy = [...dailyCalls];
    copy.sort((a, b) => {
      const at = a.next_call_at ? new Date(a.next_call_at).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.next_call_at ? new Date(b.next_call_at).getTime() : Number.POSITIVE_INFINITY;
      return at - bt;
    });
    return copy;
  }, [dailyCalls]);

  const hasActiveDailyCalls = useCallback(
    (contactId: string) => {
      return dailyCalls.some((dc) => dc.contact_id === contactId && !!dc.next_call_at);
    },
    [dailyCalls],
  );

  const refetch = useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  if (!user) return null;

  if (loading && contacts.length === 0 && dailyCalls.length === 0) {
    return (
      <ProtectedLayout>
        <LoadingSkeleton variant="table" count={6} />
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <ErrorState message={error} onRetry={refetch} />
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tContacts('newContact').replace('New ', '')}</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-gray-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`py-3 px-4 text-[15px] font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-primary-gold text-primary-gold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            aria-label={tContacts('noContactsFound')}
          >
            {tContacts('company').replace('Company', 'All Contacts')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`py-3 px-4 text-[15px] font-medium border-b-2 transition-colors ${
              activeTab === 'daily'
                ? 'border-primary-gold text-primary-gold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            aria-label={tDaily('newCall')}
          >
            {tDaily('newCall').replace('New ', '')}
          </button>
        </div>

        {activeTab === 'all' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex-1">
                <Input
                  label={tCommon('search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a name or phone number..."
                />
              </div>

              <div className="flex gap-3 flex-wrap w-full sm:w-auto">
                <Button variant="secondary" onClick={() => setShowImportCsv(true)} aria-label={tContacts('importCsv')} className="w-full sm:w-auto">
                  {tContacts('importCsv')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowCreateContact(true)}
                  className="w-full sm:w-auto bg-white border border-primary-gold text-primary-gold hover:bg-primary-gold/10"
                  aria-label={tContacts('newContact')}
                >
                  {tContacts('newContact')}
                </Button>
              </div>
            </div>

            {contacts.length === 0 ? (
              <EmptyState
                title="No contacts yet. Add your first contact."
                action={
                  <Button onClick={() => setShowCreateContact(true)} variant="primary">
                    New Contact
                  </Button>
                }
              />
            ) : filteredContacts.length === 0 ? (
              <EmptyState title={tContacts('noContactsFound')} description={tCommon('search')} />
            ) : (
              <Card className="p-4 sm:p-0 border border-gray-200">
                <div className="block sm:hidden">
                  {filteredContacts.map((c) => {
                    const deleteBlocked = hasActiveDailyCalls(c.id);
                    return (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                        <div className="font-semibold text-gray-900">{c.first_name} {c.last_name}</div>
                        <div className="mt-2 text-sm text-gray-700">
                          <span className="font-medium">Phone: </span>
                          {c.phone || <span className="text-gray-400 italic">Not set</span>}
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          <span className="font-medium">Email: </span>
                          {c.email || <span className="text-gray-400 italic">Not set</span>}
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          <span className="font-medium">Company: </span>
                          {c.company_name || <span className="text-gray-400 italic">Not set</span>}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button variant="secondary" size="sm" className="bg-white" onClick={() => setEditContact(c)}>
                            {tCommon('edit')}
                          </Button>
                          {!deleteBlocked ? (
                            <Button variant="destructive" size="sm" onClick={() => setDeleteContact(c)}>
                              {tCommon('delete')}
                            </Button>
                          ) : (
                            <Button variant="secondary" size="sm" className="bg-white" disabled>
                              {tCommon('delete')}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden sm:block overflow-x-auto w-full custom-scrollbar">
                  <Table>
                    <table className="min-w-full w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-medium">First Name</th>
                          <th className="px-6 py-4 font-medium">Last Name</th>
                          <th className="px-6 py-4 font-medium">{tContacts('phone')}</th>
                          <th className="px-6 py-4 font-medium">{tContacts('email')}</th>
                          <th className="px-6 py-4 font-medium">Company Name</th>
                          <th className="px-6 py-4 font-medium text-right">{tCommon('actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredContacts.map((c) => {
                          const deleteBlocked = hasActiveDailyCalls(c.id);
                          return (
                            <tr
                              key={c.id}
                              className="hover:bg-gray-50/50 transition-colors group"
                              role="row"
                            >
                              <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">{c.first_name}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-800">{c.last_name}</td>
                              <td className="px-6 py-4 text-sm text-gray-800">{c.phone}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{c.email || <span className="text-gray-400 italic">Not set</span>}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{c.company_name || <span className="text-gray-400 italic">Not set</span>}</td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="secondary" size="sm" className="bg-white" onClick={() => setEditContact(c)}>
                                  {tCommon('edit')}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="bg-white"
                                  onClick={() => setScheduleModal({ open: true, mode: 'create', contactId: c.id })}
                                >
                                  Add to Daily Calls
                                </Button>
                                {!deleteBlocked && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setDeleteContact(c)}
                                  >
                                    {tCommon('delete')}
                                  </Button>
                                )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'daily' && (
          <div className="space-y-6">
            {sortedDailyCalls.length === 0 ? (
              <EmptyState
                title="No calls scheduled. Add contacts and schedule your first call."
                action={
                  <Button
                    onClick={() => {
                      setActiveTab('all');
                      setShowCreateContact(true);
                    }}
                    variant="primary"
                  >
                    New Contact
                  </Button>
                }
              />
            ) : (
              <Card className="p-4 sm:p-0 border border-gray-200">
                <div className="block sm:hidden">
                  {sortedDailyCalls.map((dc) => {
                    const contact = contactById.get(dc.contact_id);
                    const mins = minutesUntil(dc.next_call_at);
                    const showSoon = mins !== null && mins > 5 && mins <= 30;
                    const showNow = mins !== null && mins <= 5;
                    const statusLabel = showNow ? 'Now' : showSoon ? 'Soon' : 'Scheduled';
                    const notesPreview = contact?.notes?.trim()
                      ? contact.notes.trim().slice(0, 90)
                      : 'No notes';

                    return (
                      <div key={dc.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                        <div className="font-semibold text-gray-900">
                          {contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown contact'}
                        </div>
                        <div className="mt-2 text-sm text-gray-700">
                          <span className="font-medium">Date: </span>
                          {formatDateTime(dc.next_call_at)}
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          <span className="font-medium">Status: </span>
                          {statusLabel}
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          <span className="font-medium">Notes: </span>
                          {notesPreview}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white"
                            onClick={() =>
                              setScheduleModal({
                                open: true,
                                mode: 'edit',
                                dailyCallId: dc.id,
                                initialNextCallAt: dc.next_call_at,
                              })
                            }
                          >
                            {tCommon('edit')}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteDailyCall(dc)}>
                            {tCommon('delete')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden sm:block overflow-x-auto w-full custom-scrollbar">
                  <Table>
                    <table className="min-w-full w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-medium">Contact</th>
                          <th className="px-6 py-4 font-medium">Phone</th>
                          <th className="px-6 py-4 font-medium">Next Call</th>
                          <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedDailyCalls.map((dc) => {
                          const contact = contactById.get(dc.contact_id);
                          const mins = minutesUntil(dc.next_call_at);
                          const showSoon = mins !== null && mins > 5 && mins <= 30;
                          const showNow = mins !== null && mins <= 5;

                          return (
                            <tr key={dc.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">
                                  {contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown contact'}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">{contact?.phone || <span className="text-gray-400 italic">Not set</span>}</td>
                              <td className="px-6 py-4 text-sm text-gray-800">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{formatDateTime(dc.next_call_at)}</span>
                  {showNow && <Badge variant="urgency" color="red">{tDaily('newCall')}</Badge>}
                                  {showSoon && <Badge variant="urgency" color="orange">{tDaily('newCall')}</Badge>}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="bg-white"
                                  onClick={() =>
                                    setScheduleModal({
                                      open: true,
                                      mode: 'edit',
                                      dailyCallId: dc.id,
                                      initialNextCallAt: dc.next_call_at,
                                    })
                                  }
                                >
                                  {tCommon('edit')}
                                </Button>
                                <Button variant="secondary" size="sm" className="bg-white" onClick={() => setCallNotesModal({ open: true, dailyCallId: dc.id })}>
                                  {tDaily('callNotes')}
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => setDeleteDailyCall(dc)}>
                                  {tCommon('delete')}
                                </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}

        {showCreateContact && (
          <CreateContactModal
            onClose={() => setShowCreateContact(false)}
            onSuccess={async () => {
              setShowCreateContact(false);
              await refetch();
            }}
          />
        )}

        {editContact && (
          <EditContactModal
            contact={editContact}
            onClose={() => setEditContact(null)}
            onSuccess={async () => {
              setEditContact(null);
              await refetch();
            }}
          />
        )}

        {showImportCsv && (
          <ImportContactsCsvModal
            onClose={() => setShowImportCsv(false)}
            onSuccess={async () => {
              setShowImportCsv(false);
              await refetch();
            }}
          />
        )}

        {scheduleModal.open && scheduleModal.mode === 'create' && (
          <ScheduleDailyCallModal
            mode="create"
            contactId={scheduleModal.contactId}
            onClose={() => setScheduleModal({ open: false })}
            onSuccess={async () => {
              setScheduleModal({ open: false });
              await refetch();
            }}
          />
        )}

        {scheduleModal.open && scheduleModal.mode === 'edit' && (
          <ScheduleDailyCallModal
            mode="edit"
            dailyCallId={scheduleModal.dailyCallId}
            initialNextCallAt={scheduleModal.initialNextCallAt}
            onClose={() => setScheduleModal({ open: false })}
            onSuccess={async () => {
              setScheduleModal({ open: false });
              await refetch();
            }}
          />
        )}

        {callNotesModal.open && (
          <CallNotesModal
            dailyCallId={callNotesModal.dailyCallId}
            onClose={() => setCallNotesModal({ open: false })}
            onSuccess={async () => {
              setCallNotesModal({ open: false });
              await refetch();
            }}
          />
        )}

        {deleteContact && (
          <Modal
            isOpen={true}
            onClose={() => {
              if (!deletingContact) setDeleteContact(null);
            }}
            title={tCommon('delete')}
          >
            <div className="space-y-4 pb-24 sm:pb-0">
              <p className="text-[15px] text-gray-700 font-medium">
                This action cannot be undone.
              </p>
              {hasActiveDailyCalls(deleteContact.id) ? (
                <p className="text-sm text-red-600">
                  This contact has active daily calls, so it cannot be deleted.
                </p>
              ) : (
                <div className="text-sm text-gray-600">
                  Contact: <span className="font-semibold text-gray-900">{deleteContact.first_name} {deleteContact.last_name}</span>
                </div>
              )}

              <div className="fixed inset-x-0 bottom-0 p-4 bg-white border-t border-gray-100 flex justify-end gap-3 sm:static sm:p-0 sm:pt-2 sm:border-0">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDeleteContact(null)}
                  disabled={deletingContact}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletingContact || hasActiveDailyCalls(deleteContact.id)}
                  onClick={async () => {
                    if (hasActiveDailyCalls(deleteContact.id)) {
                      toast.error('Cannot delete a contact with active daily calls.');
                      setDeleteContact(null);
                      return;
                    }
                    try {
                      setDeletingContact(true);
                      await apiClient.delete(`/contacts/${deleteContact.id}`);
                      toast.success('Contact deleted');
                      setDeleteContact(null);
                      await refetch();
                    } catch (err: unknown) {
                      toast.error(getErrorMessage(err, 'Failed to delete contact'));
                    } finally {
                      setDeletingContact(false);
                    }
                  }}
                >
                  {deletingContact ? `${tCommon('loading')}...` : tCommon('confirm')}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {deleteDailyCall && (
          <Modal
            isOpen={true}
            onClose={() => {
              if (!deletingDailyCall) setDeleteDailyCall(null);
            }}
            title={tDaily('newCall')}
          >
            <div className="space-y-4 pb-24 sm:pb-0">
              <p className="text-[15px] text-gray-700 font-medium">
                This call will be removed from your daily call schedule.
              </p>

              <div className="text-sm text-gray-600">
                Next call: <span className="font-semibold text-gray-900">{formatDateTime(deleteDailyCall.next_call_at)}</span>
              </div>

              <div className="fixed inset-x-0 bottom-0 p-4 bg-white border-t border-gray-100 flex justify-end gap-3 sm:static sm:p-0 sm:pt-2 sm:border-0">
                <Button type="button" variant="secondary" onClick={() => setDeleteDailyCall(null)} disabled={deletingDailyCall}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    try {
                      setDeletingDailyCall(true);
                      await apiClient.delete(`/daily-calls/${deleteDailyCall.id}`);
                      toast.success('Daily call removed');
                      setDeleteDailyCall(null);
                      await refetch();
                    } catch (err: unknown) {
                      toast.error(getErrorMessage(err, 'Failed to remove daily call'));
                    } finally {
                      setDeletingDailyCall(false);
                    }
                  }}
                  disabled={deletingDailyCall}
                >
                  {deletingDailyCall ? `${tCommon('loading')}...` : tCommon('confirm')}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </ProtectedLayout>
  );
}

