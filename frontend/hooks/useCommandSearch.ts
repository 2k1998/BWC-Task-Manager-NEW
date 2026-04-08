import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchSearchIndex } from '@/lib/searchIndex';
import { useAuth } from '@/context/AuthContext';

// Define the structure of a generic search result item
export interface CommandResult {
  id: string; // Unique identifier for React keys
  type: 'action' | 'task' | 'project' | 'event' | 'document' | 'company' | 'contact' | 'payment' | 'car';
  title: string;
  subtitle?: string; // Optional metadata like due date, location, etc.
  link: string; // The URL to navigate to
  iconType?: string; // For differentiating visual icons
  badge?: string; // Optional status/urgency badge
  badgeColor?: string;
}

export function useCommandSearch() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommandResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Data index caches
  const [index, setIndex] = useState<{
    tasks: any[];
    projects: any[];
    events: any[];
    documents: any[];
    companies: any[];
    contacts: any[];
    payments: any[];
    cars: any[];
    hasFetched: boolean;
  }>({
    tasks: [],
    projects: [],
    events: [],
    documents: [],
    companies: [],
    contacts: [],
    payments: [],
    cars: [],
    hasFetched: false,
  });

  // Global Key Listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Fetch index data exactly once when first opened
  useEffect(() => {
    if (isOpen && !index.hasFetched && user) {
      const loadIndex = async () => {
        const data = await fetchSearchIndex();
        setIndex({
          tasks: data.tasks,
          projects: data.projects,
          events: data.events,
          documents: data.documents,
          companies: data.companies,
          contacts: data.contacts,
          payments: data.payments,
          cars: data.cars,
          hasFetched: true
        });
      };
      loadIndex();
    }
  }, [isOpen, index.hasFetched, user]);

  const baseActions: CommandResult[] = useMemo(() => {
    const defaultActions: CommandResult[] = [
      { id: 'go_dashboard', type: 'action', title: 'Go to Dashboard', link: '/dashboard', iconType: 'template' },
      { id: 'go_tasks', type: 'action', title: 'Go to Tasks', link: '/tasks', iconType: 'collection' },
      { id: 'go_projects', type: 'action', title: 'Go to Projects', link: '/projects', iconType: 'template' },
      { id: 'go_events', type: 'action', title: 'Go to Events', link: '/events', iconType: 'calendar' },
      { id: 'go_docs', type: 'action', title: 'Go to Documents', link: '/documents', iconType: 'document' },
      { id: 'go_companies', type: 'action', title: 'Go to Companies', link: '/companies', iconType: 'template' },
      { id: 'go_contacts', type: 'action', title: 'Go to Contacts', link: '/contacts', iconType: 'users' },
      { id: 'go_payments', type: 'action', title: 'Go to Payments', link: '/payments', iconType: 'template' },
      { id: 'go_cars', type: 'action', title: 'Go to Cars', link: '/cars', iconType: 'template' },
      { id: 'go_notifications', type: 'action', title: 'Open Notifications', link: '/notifications', iconType: 'bell' },
      { id: 'create_task', type: 'action', title: 'Create Task', link: '/tasks?action=new', iconType: 'plus' },
      { id: 'create_project', type: 'action', title: 'Create Project', link: '/projects?action=new', iconType: 'plus' },
      { id: 'create_event', type: 'action', title: 'Create Event', link: '/events?action=new', iconType: 'plus' },
    ];

    if (user?.user_type === 'Admin') {
      defaultActions.push(
        { id: 'admin_users', type: 'action', title: 'Manage Users', link: '/admin/users', iconType: 'users' },
        { id: 'admin_activity', type: 'action', title: 'View Activity Logs', link: '/admin/activity', iconType: 'clock' }
      );
    }
    
    return defaultActions;
  }, [user]);

  // Debounced Search Execution
  useEffect(() => {
    if (!isOpen) return;
    
    setIsSearching(true);
    
    const handler = setTimeout(() => {
      const lowerQuery = query.toLowerCase().trim();
      
      if (!lowerQuery) {
        setResults(baseActions);
        setIsSearching(false);
        return;
      }

      // Filter strict fields only
      const filteredActions = baseActions.filter(a => a.title.toLowerCase().includes(lowerQuery));
      
      const filteredTasks: CommandResult[] = index.tasks
        .filter(t => t.title?.toLowerCase().includes(lowerQuery))
        .map(t => ({ id: `task_${t.id}`, type: 'task', title: t.title, link: `/tasks`, badge: t.status, iconType: 'check-circle' }));

      const filteredProjects: CommandResult[] = index.projects
        .filter(p => p.name?.toLowerCase().includes(lowerQuery))
        .map(p => ({ id: `proj_${p.id}`, type: 'project', title: p.name, link: `/projects`, badge: p.status, iconType: 'template' }));

      const filteredEvents: CommandResult[] = index.events
        .filter(e => e.title?.toLowerCase().includes(lowerQuery) || e.location?.toLowerCase().includes(lowerQuery))
        .map(e => ({ id: `evt_${e.id}`, type: 'event', title: e.title, subtitle: e.location, link: `/events`, iconType: 'calendar' }));

      const filteredDocs: CommandResult[] = index.documents
        .filter(d => d.original_filename?.toLowerCase().includes(lowerQuery))
        .map(d => ({ id: `doc_${d.id}`, type: 'document', title: d.original_filename, link: `/documents`, iconType: 'document' }));

      const filteredCompanies: CommandResult[] = index.companies
        .filter(c => c.name?.toLowerCase().includes(lowerQuery))
        .map(c => ({ id: `company_${c.id}`, type: 'company', title: c.name, link: '/companies', iconType: 'template' }));

      const filteredContacts: CommandResult[] = index.contacts
        .filter(c => `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(lowerQuery) || c.company_name?.toLowerCase().includes(lowerQuery))
        .map(c => ({ id: `contact_${c.id}`, type: 'contact', title: `${c.first_name || ''} ${c.last_name || ''}`.trim(), subtitle: c.company_name || c.phone, link: '/contacts', iconType: 'users' }));

      const filteredPayments: CommandResult[] = index.payments
        .filter(p => p.reference_code?.toLowerCase().includes(lowerQuery) || p.vendor_name?.toLowerCase().includes(lowerQuery))
        .map(p => ({ id: `payment_${p.id}`, type: 'payment', title: p.reference_code || 'Payment', subtitle: p.vendor_name || p.status, link: '/payments', iconType: 'template' }));

      const filteredCars: CommandResult[] = index.cars
        .filter(c => c.plate_number?.toLowerCase().includes(lowerQuery) || c.make?.toLowerCase().includes(lowerQuery) || c.model?.toLowerCase().includes(lowerQuery))
        .map(c => ({ id: `car_${c.id}`, type: 'car', title: c.plate_number || `${c.make || ''} ${c.model || ''}`.trim(), subtitle: `${c.make || ''} ${c.model || ''}`.trim(), link: '/cars', iconType: 'template' }));

      const allResults = [
        ...filteredActions,
        ...filteredTasks,
        ...filteredProjects,
        ...filteredEvents,
        ...filteredDocs,
        ...filteredCompanies,
        ...filteredContacts,
        ...filteredPayments,
        ...filteredCars,
      ];
      setResults(allResults.slice(0, 20)); // Max results: 20
      setIsSearching(false);
    }, 200); // 200ms debounce

    return () => clearTimeout(handler);
  }, [query, isOpen, baseActions, index]);

  const toggle = useCallback(() => setIsOpen(o => !o), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  return {
    isOpen,
    toggle,
    close,
    query,
    setQuery,
    results,
    isSearching
  };
}
