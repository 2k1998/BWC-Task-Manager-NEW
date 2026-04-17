'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import AdminRoute from '@/components/AdminRoute';
import { Card, Badge, Button, Input, Modal } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { User } from '@/lib/types';

type AdminTab = 'users' | 'departments';
type Department = { id: string; name: string };

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [actioningUserId, setActioningUserId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isPasswordDisplayOpen, setIsPasswordDisplayOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    user_type: 'Agent',
    manager_id: ''
  });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/users', { params: { page: 1, page_size: 100 } });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      const res = await apiClient.get('/departments');
      setDepartments(res.data?.departments || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
      toast.error('Failed to load departments');
    } finally {
      setDepartmentsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, string> = { ...formData };
      if (!payload.manager_id) delete payload.manager_id;

      const res = await apiClient.post('/admin/users', payload);
      setGeneratedPassword(res.data.generated_password);
      setIsCreateOpen(false);
      setIsPasswordDisplayOpen(true);
      fetchUsers();
      setFormData({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        user_type: 'Agent',
        manager_id: ''
      });
    } catch (err) {
      console.error('Failed to create user:', err);
      toast.error('Failed to create user. Please check inputs.');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    try {
      const res = await apiClient.post(`/admin/users/${selectedUser.id}/reset-password`);
      setGeneratedPassword(res.data.generated_password);
      setIsResetOpen(false);
      setIsPasswordDisplayOpen(true);
    } catch (err) {
      console.error('Failed to reset password:', err);
      toast.error('Failed to reset password.');
    }
  };

  const handleUserActivation = async (user: User, shouldActivate: boolean) => {
    try {
      setActioningUserId(user.id);
      await apiClient.patch(`/admin/users/${user.id}/${shouldActivate ? 'activate' : 'deactivate'}`);
      toast.success(`User ${shouldActivate ? 'activated' : 'deactivated'} successfully`);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to update user status:', err);
      toast.error(`Failed to ${shouldActivate ? 'activate' : 'deactivate'} user`);
    } finally {
      setActioningUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      setActioningUserId(selectedUser.id);
      await apiClient.delete(`/admin/users/${selectedUser.id}`);
      toast.success('User deleted successfully');
      setIsDeleteOpen(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error('Failed to delete user');
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
    } catch (err) {
      console.error('Failed to create department:', err);
      toast.error('Failed to create department');
    }
  };

  const closePasswordModal = () => {
    setGeneratedPassword('');
    setIsPasswordDisplayOpen(false);
  };

  return (
    <ProtectedLayout>
      <AdminRoute>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-500">Manage system users and permissions</p>
            </div>
            {activeTab === 'users' ? (
              <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
                + Create User
              </Button>
            ) : (
              <Button onClick={() => setIsAddDepartmentOpen(true)} className="w-full sm:w-auto">
                + Add Department
              </Button>
            )}
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
                Users
              </button>
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
              <Link href="/admin/activity" className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900">
                Activity Logs
              </Link>
            </div>
          </div>

          {activeTab === 'users' ? (
            <Card className="p-4 sm:p-0 overflow-hidden">
              <div className="block sm:hidden">
                {users.map((user) => (
                  <div key={user.id} className={`bg-white border border-gray-200 rounded-lg p-4 mb-3 ${user.is_active ? '' : 'opacity-60'}`}>
                    <div className="font-semibold text-gray-900">{user.first_name} {user.last_name}</div>
                    <div className="mt-2 text-sm text-gray-700"><span className="font-medium">Role: </span>{user.user_type}</div>
                    <div className="mt-1 text-sm text-gray-700"><span className="font-medium">Email: </span>{user.email}</div>
                    <div className="mt-1 text-sm text-gray-700 flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      <span className="font-medium">{user.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="secondary" className="w-full" onClick={() => { setSelectedUser(user); setIsResetOpen(true); }}>
                        Reset Password
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full bg-white"
                        onClick={() => handleUserActivation(user, !user.is_active)}
                        disabled={actioningUserId === user.id}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => { setSelectedUser(user); setIsDeleteOpen(true); }}
                        disabled={actioningUserId === user.id}
                      >
                        Delete User
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block w-full overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${user.is_active ? '' : 'opacity-60'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                              {user.first_name[0]}{user.last_name[0]}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</div>
                              <div className="text-sm text-gray-500">@{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant="status"
                            color={user.user_type === 'Admin' ? 'red' : user.user_type === 'Manager' ? 'blue' : 'gray'}
                          >
                            {user.user_type}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="inline-flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            <span>{user.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setSelectedUser(user); setIsResetOpen(true); }}
                              className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100 transition-colors"
                            >
                              Reset Password
                            </button>
                            <button
                              onClick={() => handleUserActivation(user, !user.is_active)}
                              disabled={actioningUserId === user.id}
                              className="text-gray-700 hover:text-gray-900 bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => { setSelectedUser(user); setIsDeleteOpen(true); }}
                              disabled={actioningUserId === user.id}
                              className="text-red-600 hover:text-red-800 bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              Delete User
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && !loading && (
                <div className="p-8 text-center text-gray-500">No users found.</div>
              )}
            </Card>
          ) : (
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Departments</h2>
                <Button onClick={() => setIsAddDepartmentOpen(true)}>+ Add Department</Button>
              </div>
              {departmentsLoading ? (
                <p className="text-sm text-gray-500">Loading departments...</p>
              ) : departments.length === 0 ? (
                <p className="text-sm text-gray-500">No departments found.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {departments.map((department) => (
                        <tr key={department.id}>
                          <td className="px-4 py-3 text-sm text-gray-700">{department.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>

        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New User"
        >
          <form onSubmit={handleCreateUser} className="space-y-4 pb-24 sm:pb-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <Input required value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <Input required value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <Input required value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                value={formData.user_type}
                onChange={(e) => setFormData({...formData, user_type: e.target.value})}
              >
                <option value="Agent">Agent</option>
                <option value="Head">Head</option>
                <option value="Manager">Manager</option>
                <option value="Pillar">Pillar</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manager ID (UUID, Optional)</label>
              <Input
                value={formData.manager_id}
                onChange={(e) => setFormData({...formData, manager_id: e.target.value})}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>

            <div className="fixed inset-x-0 bottom-0 p-4 bg-white border-t border-gray-100 flex justify-end gap-3 sm:static sm:p-0 sm:pt-4 sm:border-0">
              <Button variant="secondary" onClick={() => setIsCreateOpen(false)} type="button">Cancel</Button>
              <Button type="submit">Create User</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} title="Reset Password">
          <div className="space-y-4 pb-24 sm:pb-0">
            <p className="text-gray-600">
              Are you sure you want to reset the password for <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>?
            </p>
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
              Warning: The current password will be invalidated immediately.
            </p>
            <div className="fixed inset-x-0 bottom-0 p-4 bg-white border-t border-gray-100 flex justify-end gap-3 sm:static sm:p-0 sm:pt-2 sm:border-0">
              <Button variant="secondary" onClick={() => setIsResetOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleResetPassword}>Reset Password</Button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Delete User">
          <div className="space-y-4 pb-24 sm:pb-0">
            <p className="text-gray-700">
              Are you sure you want to permanently delete <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>?
            </p>
            <div className="fixed inset-x-0 bottom-0 p-4 bg-white border-t border-gray-100 flex justify-end gap-3 sm:static sm:p-0 sm:pt-2 sm:border-0">
              <Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteUser} disabled={!!actioningUserId}>
                Delete User
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isAddDepartmentOpen}
          onClose={() => setIsAddDepartmentOpen(false)}
          title="Add Department"
        >
          <form onSubmit={handleAddDepartment} className="space-y-4">
            <Input
              label="Department Name"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              required
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsAddDepartmentOpen(false)} type="button">Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={isPasswordDisplayOpen}
          onClose={closePasswordModal}
          title="Password Generated"
        >
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-sm text-green-800 mb-2">New Password:</p>
              <div className="text-2xl font-mono font-bold text-gray-900 select-all bg-white p-3 rounded border border-gray-200">
                {generatedPassword}
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 text-blue-800 rounded-md text-sm border border-blue-100">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              <p>
                <strong>Important:</strong> Copy this password now. It will <u>not</u> be shown again.
                It is NOT stored in the system and cannot be retrieved later.
              </p>
            </div>

            <div className="flex justify-center">
              <Button onClick={closePasswordModal} className="w-full">
                I have copied the password
              </Button>
            </div>
          </div>
        </Modal>
      </AdminRoute>
    </ProtectedLayout>
  );
}
