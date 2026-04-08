import apiClient from '@/lib/apiClient';

const PAGE_SIZE = 50;

export async function fetchSearchIndex(): Promise<{
  tasks: any[];
  projects: any[];
  events: any[];
  documents: any[];
  companies: any[];
  contacts: any[];
  payments: any[];
  cars: any[];
}> {
  try {
    const params = { page: 1, page_size: PAGE_SIZE };

    // Fetch the first page of each resource up to the maximum cap of 50
    const [tasksRes, projectsRes, eventsRes, docsRes, companiesRes, contactsRes, paymentsRes, carsRes] = await Promise.allSettled([
      apiClient.get('/tasks', { params }),
      apiClient.get('/projects', { params }),
      apiClient.get('/events', { params }),
      apiClient.get('/documents', { params }),
      apiClient.get('/companies', { params }),
      apiClient.get('/contacts', { params }),
      apiClient.get('/payments', { params }),
      apiClient.get('/cars', { params }),
    ]);

    return {
      tasks: tasksRes.status === 'fulfilled' ? tasksRes.value.data.tasks || [] : [],
      projects: projectsRes.status === 'fulfilled' ? projectsRes.value.data.projects || [] : [],
      events: eventsRes.status === 'fulfilled' ? eventsRes.value.data.events || [] : [],
      documents: docsRes.status === 'fulfilled' ? docsRes.value.data.documents || [] : [],
      companies: companiesRes.status === 'fulfilled' ? companiesRes.value.data.companies || [] : [],
      contacts: contactsRes.status === 'fulfilled' ? contactsRes.value.data.contacts || [] : [],
      payments: paymentsRes.status === 'fulfilled' ? paymentsRes.value.data.payments || [] : [],
      cars: carsRes.status === 'fulfilled' ? carsRes.value.data.cars || [] : [],
    };
  } catch (error) {
    console.error('Failed to pre-fetch command palette index', error);
    return { tasks: [], projects: [], events: [], documents: [], companies: [], contacts: [], payments: [], cars: [] };
  }
}
