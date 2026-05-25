'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import HierarchyManagerRoute from '@/components/HierarchyManagerRoute';
import AdminRoute from '@/components/AdminRoute';
import PermissionsModal from '@/components/PermissionsModal';
import UserHierarchyTree from '@/components/admin/UserHierarchyTree';
import CreateUserModal from '@/components/admin/CreateUserModal';
import EditUserModal from '@/components/admin/EditUserModal';
import { Card, Button, Input, Modal } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { UserTreeNode } from '@/lib/userHierarchy';

type AdminTab = 'users' | 'departments';
type Department = { id: string; name: string; created_at?: string };

export default function AdminUsersPage() {
  const tAdmin = useTranslations('Admin');
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.user_type === 'Admin';

  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [tree, setTree] = useState<UserTreeNode[]>([]);
  const [activeById, setActiveById] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [actioningUserId, setActioningUserId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [isPasswordDisplayOpen, setIsPasswordDisplayOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');

  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchTreeAndStatus = useCallback(async () => {
    try {
      setLoading(true);
      const treeRes = await apiClient.get<UserTreeNode[]>('/admin/users/tree');
      setTree(treeRes.data ?? []);

      const active: Record<string, boolean> = {};
      try {
        const listRes = await apiClient.get('/admin/users', {
          params: { page: 1, page_size: 100 },
        });
        const users = listRes.data?.users ?? [];
        for (const u of users) {
          active[u.id] = u.is_active !== false;
        }
      } catch (listErr) {
        console.error('Failed to load user active status:', listErr);
      }
      setActiveById(active);
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error(tAdmin('loadError'));
    } finally {
      setLoading(false);
    }
  }, [tAdmin]);

  useEffect(() => {
    if (activeTab === 'users') {
      void fetchTreeAndStatus();
    }
  }, [activeTab, fetchTreeAndStatus]);

  useEffect(() => {
    if (activeTab === 'departments' && isAdmin) {
      void fetchDepartments();
    }
  }, [activeTab, isAdmin]);

  const fetchDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      const res = await apiClient.get('/departments');
      const payload = Array.isArray(res.data) ? res.data : (res.data?.departments || []);
      setDepartments(payload);
    } catch (err) {
      console.error('Failed to load departments:', err);
      toast.error('Failed to load departments');
    } finally {
      setDepartmentsLoading(false);
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    try {
      await apiClient.delete(`/departments/${departmentId}`);
      setDepartments((prev) => prev.filter((d) => d.id !== departmentId));
      toast.success('Department deleted successfully');
    } catch {
      toast.error('Failed to delete department');
    }
  };

  const handleUserActivation = async (node: UserTreeNode, shouldActivate: boolean) => {
    try {
      setActioningUserId(node.id);
      await apiClient.patch(`/admin/users/${node.id}/${shouldActivate ? 'activate' : 'deactivate'}`);
      toast.success(tAdmin(shouldActivate ? 'activateSuccess' : 'deactivateSuccess'));
      await fetchTreeAndStatus();
    } catch {
      toast.error(tAdmin('updateError'));
    } finally {
      setActioningUserId(null);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartmentName.trim()) return;
    try {
      await apiClient.post('/departments', { name: newDepartmentName.trim() });
      toast.success('Department created successfully');
      setNewDepartmentName('');
      setIsAddDepartmentOpen(false);
      await fetchDepartments();
    } catch {
      toast.error('Failed to create department');
    }
  };

  const openEdit = (node: UserTreeNode) => {
    setEditUserId(node.id);
    setIsEditOpen(true);
  };

  const openPermissions = (node: UserTreeNode) => {
    setPermissionsTarget({ id: node.id, name: node.full_name });
    setPermissionsModalOpen(true);
  };

  const closePasswordModal = () => {
    setGeneratedPassword('');
    setIsPasswordDisplayOpen(false);
  };

  return (
    <ProtectedLayout>
      <HierarchyManagerRoute>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tAdmin('title')}</h1>
              <p className="text-gray-500">{tAdmin('subtitle')}</p>
            </div>
            {activeTab === 'users' ? (
              <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
                + {tAdmin('createUser')}
              </Button>
            ) : isAdmin ? (
              <Button onClick={() => setIsAddDepartmentOpen(true)} className="w-full sm:w-auto">
                + Add Department
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto border-b border-gray-200">
            <div className="inline-flex flex-wrap items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === 'users'
                    ? 'border-primary-gold text-primary-gold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tAdmin('usersTab')}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('departments')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 ${
                    activeTab === 'departments'
                      ? 'border-primary-gold text-primary-gold'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Departments
                </button>
              )}
              {isAdmin && (
                <Link
                  href="/admin/activity"
                  className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900"
                >
                  Activity Logs
                </Link>
              )}
            </div>
          </div>

          {activeTab === 'users' ? (
            <Card className="p-4 overflow-hidden">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-gold" />
                </div>
              ) : (
                <UserHierarchyTree
                  nodes={tree}
                  activeById={activeById}
                  showPermissions={isAdmin}
                  showDeactivate
                  actioningUserId={actioningUserId}
                  onEdit={openEdit}
                  onPermissions={openPermissions}
                  onToggleActive={handleUserActivation}
                />
              )}
            </Card>
          ) : (
            <AdminRoute>
              <Card className="p-4">
                {departmentsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-gold" />
                  </div>
                ) : departments.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No departments yet.</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {departments.map((department) => (
                        <tr key={department.id}>
                          <td className="px-4 py-3 text-sm text-gray-700">{department.name}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(department.id)}
                              className="text-red-600 hover:text-red-800 bg-red-50 px-3 py-1 rounded"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </AdminRoute>
          )}
        </div>

        <CreateUserModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          tree={tree}
          currentUserType={currentUser?.user_type ?? ''}
          currentUserId={currentUser?.id}
          isAdmin={isAdmin}
          onSuccess={(password) => {
            setGeneratedPassword(password);
            setIsPasswordDisplayOpen(true);
            void fetchTreeAndStatus();
          }}
        />

        <EditUserModal
          isOpen={isEditOpen}
          userId={editUserId}
          tree={tree}
          currentUserType={currentUser?.user_type ?? ''}
          onClose={() => {
            setIsEditOpen(false);
            setEditUserId(null);
          }}
          onSuccess={() => void fetchTreeAndStatus()}
        />

        {permissionsTarget && (
          <PermissionsModal
            userId={permissionsTarget.id}
            userName={permissionsTarget.name}
            isOpen={permissionsModalOpen}
            onClose={() => {
              setPermissionsModalOpen(false);
              setPermissionsTarget(null);
            }}
          />
        )}

        <Modal isOpen={isAddDepartmentOpen} onClose={() => setIsAddDepartmentOpen(false)} title="Add Department">
          <form onSubmit={handleAddDepartment} className="space-y-4">
            <Input
              label="Department Name"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              required
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsAddDepartmentOpen(false)} type="button">
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={isPasswordDisplayOpen} onClose={closePasswordModal} title={tAdmin('passwordGenerated')}>
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-sm text-green-800 mb-2">{tAdmin('newPassword')}</p>
              <div className="text-2xl font-mono font-bold text-gray-900 select-all bg-white p-3 rounded border">
                {generatedPassword}
              </div>
            </div>
            <p className="text-sm text-blue-800 bg-blue-50 p-3 rounded border border-blue-100">
              {tAdmin('passwordCopyWarning')}
            </p>
            <Button onClick={closePasswordModal} className="w-full">
              {tAdmin('passwordCopied')}
            </Button>
          </div>
        </Modal>
      </HierarchyManagerRoute>
    </ProtectedLayout>
  );
}
