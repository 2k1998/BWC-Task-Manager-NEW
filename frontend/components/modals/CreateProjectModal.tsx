'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { Button } from '@/components/ui';

interface CreateProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// EXACT STRINGS - DO NOT MODIFY
const PROJECT_TYPES = [
  "Renovation",
  "Expansion",
  "New Store",
  "Maintenance",
  "Other"
];

const PRIORITIES = ["Low", "Medium", "High", "Critical"];

export default function CreateProjectModal({ onClose, onSuccess }: CreateProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Data Sources
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    project_type: '', // NO DEFAULT - User must select
    company_id: '',   // Fetched dynamically
    priority: '',     // NO DEFAULT - User must select
    description: '',
    budget_amount: '',  
    project_manager_user_id: '',
    location_address: '',
    location_postcode: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_completion_date: '',
  });

  useEffect(() => {
    fetchDependencies();
  }, []);

  const fetchDependencies = async () => {
    try {
      const [companiesRes, usersRes] = await Promise.all([
        apiClient.get('/admin/companies'),
        apiClient.get('/admin/users'),
      ]);

      setCompanies(companiesRes.data.companies || []);
      setUsers(usersRes.data.users || []);

      if (companiesRes.data.companies?.length > 0) {
        setFormData(prev => ({ ...prev, company_id: companiesRes.data.companies[0].id }));
      }
    } catch (err) {
      console.error('Failed to fetch dependencies:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name) {
        toast.error('Project Name is required');
        return;
    }
    if (!formData.company_id) {
        toast.error('Company ID is missing (System Error)');
        return;
    }
    if (!formData.project_manager_user_id) {
        toast.error('Project Manager is required');
        return;
    }
    if (!formData.start_date || !formData.expected_completion_date) {
        toast.error('Start and Expected Completion dates are required');
        return;
    }
    // Date Validation
    if (new Date(formData.expected_completion_date) < new Date(formData.start_date)) {
        toast.error('Completion date cannot be before start date');
        return;
    }

    // MANDATORY SELECTION VALIDATION
    if (!formData.project_type) {
        toast.error('Please select a Project Type');
        return;
    }
    if (!formData.priority) {
        toast.error('Please select a Priority');
        return;
    }

    try {
      setLoading(true);
      
      const payload = {
          name: formData.name,
          project_type: formData.project_type,
          company_id: formData.company_id,
          priority: formData.priority,
          description: formData.description,
          budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : null,
          project_manager_user_id: formData.project_manager_user_id,
          location_address: formData.location_address,
          location_postcode: formData.location_postcode,
          start_date: formData.start_date,
          expected_completion_date: formData.expected_completion_date,
          // STATUS is NOT sent. Backend defaults to "Planning".
          // NO owner_user_id sent
      };

      await apiClient.post('/projects', payload);
      toast.success('Project created successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-6 shadow-xl">
                  <div className="animate-spin h-6 w-6 border-2 border-primary-gold border-t-transparent rounded-full"></div>
              </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
            
            {companies.length === 0 && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                    Warning: No companies found. Project creation may fail. Contact admin.
                </div>
            )}

            {/* Name */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Downtown Store Renovation"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Type - STRICT NO DEFAULT */}
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Project Type *</label>
                     <select
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all bg-white"
                        value={formData.project_type}
                        onChange={e => setFormData({...formData, project_type: e.target.value})}
                     >
                        <option value="" disabled>Select Type...</option>
                        {PROJECT_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                     </select>
                </div>

                {/* Priority - STRICT NO DEFAULT */}
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
                     <select
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all bg-white"
                        value={formData.priority}
                        onChange={e => setFormData({...formData, priority: e.target.value})}
                     >
                        <option value="" disabled>Select Priority...</option>
                        {PRIORITIES.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                     </select>
                </div>
            </div>

            {/* Manager - Mandatory */}
            <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Project Manager *</label>
                 <select
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all bg-white"
                    value={formData.project_manager_user_id}
                    onChange={e => setFormData({...formData, project_manager_user_id: e.target.value})}
                 >
                    <option value="">Select Manager...</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.username})</option>
                    ))}
                 </select>
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="High level overview..."
                />
            </div>

            {/* Budget */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Amount</label>
                <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                        type="number"
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                        value={formData.budget_amount}
                        onChange={e => setFormData({...formData, budget_amount: e.target.value})}
                        placeholder="0.00"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Start Date */}
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                        type="date"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                        value={formData.start_date}
                        onChange={e => setFormData({...formData, start_date: e.target.value})}
                    />
                </div>

                {/* Completion Date */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Completion *</label>
                    <input
                        type="date"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                        value={formData.expected_completion_date}
                        onChange={e => setFormData({...formData, expected_completion_date: e.target.value})}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Location */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location Address</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                        value={formData.location_address}
                        onChange={e => setFormData({...formData, location_address: e.target.value})}
                        placeholder="Street Address"
                    />
                </div>
                 {/* Postcode */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                        value={formData.location_postcode}
                        onChange={e => setFormData({...formData, location_postcode: e.target.value})}
                        placeholder="Zip/Postcode"
                    />
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-xl z-10">
            <Button variant="outline" onClick={onClose} type="button">
                Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={loading} type="submit">
                {loading ? 'Creating...' : 'Create Project'}
            </Button>
        </div>

      </div>
    </div>
  );
}
