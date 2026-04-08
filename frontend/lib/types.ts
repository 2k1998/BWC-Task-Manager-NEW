// API Response Types (response-scoped, not full domain models)

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action_type: string; // CREATE, UPDATE, DELETE, STATUS_CHANGE, TRANSFER, METADATA_UPDATE
  performed_by_user_id: string;
  perform_by_user_name?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  created_at: string;
}

export interface ActivityLogListResponse {
  logs: ActivityLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  user_type: string;
  is_active: boolean;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
  language?: "en" | "el";
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  status: string;
  urgency: string;
  assigned_to_user_id: string | null;
  assigned_to_team_id: string | null;
  company_id: string;
  /** Present on task API responses; used for permissions and display. */
  owner_user_id?: string;
  created_at: string;
  updated_at: string;
}

/** GET/POST /tasks/{id}/comments — matches backend TaskCommentResponse */
export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  user_full_name: string;
  body: string;
  created_at: string;
}

/** GET /tasks/{id}/documents — matches backend TaskDocumentAttachmentItem */
export interface TaskDocumentAttachment {
  id: string;
  document_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  page_size: number;
}

export interface Project {
  id: string;
  name: string;
  project_type: string;
  company_id: string;
  priority: string;
  description: string | null;
  budget_amount: number | null;
  project_manager_user_id: string;
  location_address: string | null;
  location_postcode: string | null;
  start_date: string;
  expected_completion_date: string;
  status: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  page_size: number;
}

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  uploaded_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page: number;
  page_size: number;
}

export interface Event {
  id: string;
  title: string;
  location: string;
  event_datetime: string;
  description: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface EventListResponse {
  events: Event[];
  total: number;
  page: number;
  page_size: number;
}

export interface Company {
  id: string;
  name: string;
  vat_number: string | null;
  occupation: string | null;
  creation_date: string | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyListResponse {
  companies: Company[];
  total: number;
  page: number;
  page_size: number;
}

// Phase 12 — Contacts & Daily Calls
export interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string | null;
  company_name?: string | null;
  company_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  page_size: number;
}

export interface DailyCall {
  id: string;
  contact_id: string;
  user_id: string;
  next_call_at?: string | null;
  reminder_30min_sent: boolean;
  reminder_5min_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyCallListResponse {
  daily_calls: DailyCall[];
  total: number;
  page: number;
  page_size: number;
}

// Best-effort typing for call notes payloads.
// Backend endpoints may evolve; keep optional fields to avoid breaking the UI.
export interface CallNoteFile {
  id?: string; // call_notes_files.id
  file_id?: string; // documents.id
  document_id?: string; // alias sometimes used
  expires_at?: string; // call_notes_files.expires_at
  original_filename?: string; // documents.original_filename
  filename?: string; // fallback
}

export interface CallNotesResponse {
  // Some implementations may return `{ files: [...] }` or directly `files`.
  files?: CallNoteFile[];
  call_notes_files?: CallNoteFile[];
}

// Phase 13 — Payments
export interface Payment {
  id: string;
  title: string;
  description?: string | null;
  amount: number | string;
  currency: string;
  payment_type: string;
  payment_category?: string | null;
  payment_date: string;
  is_income: boolean;
  employee_user_id?: string | null;
  company_id: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentListResponse {
  payments: Payment[];
  total: number;
  page: number;
  page_size: number;
}

// Phase 14 — Messaging, Chat, Approvals
export interface ProfileMeResponse {
  user_id?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  user_type?: string;
  bio?: string | null;
  birthday?: string | null;
  profile_photo_url?: string | null;
  profile_photo_file_id?: string | null;
  language?: "en" | "el";
}

export interface PresenceEntry {
  user_id: string;
  name: string;
  username?: string | null;
  profile_photo_url?: string | null;
  is_online: boolean;
  last_seen_at?: string | null;
}

export interface ChatThread {
  id: string;
  other_user_id?: string | null;
  other_user_name?: string | null;
  other_user_username?: string | null;
  other_user_photo_url?: string | null;
  last_message_text?: string | null;
  last_message_created_at?: string | null;
  unread_count?: number;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_user_id: string;
  message_text?: string | null;
  file_id?: string | null;
  is_read?: boolean;
  created_at: string;
}

export interface ChatThreadsResponse {
  threads: ChatThread[];
}

export interface ApprovalRequest {
  id: string;
  requester_user_id: string;
  receiver_user_id: string;
  requester_name?: string | null;
  receiver_name?: string | null;
  request_type: 'General' | 'Expenses' | 'Task' | 'Project' | 'Purchase' | string;
  title: string;
  description?: string | null;
  status: 'pending' | 'approved' | 'denied' | string;
  resolved_at?: string | null;
  created_at: string;
}

export interface ApprovalsResponse {
  approvals: ApprovalRequest[];
}

export interface UserSearchResult {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  profile_photo_url?: string | null;
}

export interface UserSearchResponse {
  users: UserSearchResult[];
}

// Phase 15 — Cars / Fleet Management
export type CarStatus = 'available' | 'rented' | 'sold';
export type CarIncomeType = 'rental' | 'sale';

export interface Car {
  id: string;
  make: string;
  model: string;
  license_plate: string;
  year: number;
  purchase_date?: string | null;
  purchase_price?: number | string | null;
  status: CarStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CarListResponse {
  cars: Car[];
  total?: number;
  page?: number;
  page_size?: number;
}

export interface CarMaintenance {
  id?: string;
  car_id?: string;
  last_service_date?: string | null;
  next_service_date?: string | null;
  last_kteo_date?: string | null;
  next_kteo_date?: string | null;
  last_tyre_change_date?: string | null;
  updated_at?: string;
}

export interface CarIncome {
  id: string;
  car_id: string;
  customer_name: string;
  amount: number | string;
  income_type: CarIncomeType;
  transaction_date: string;
  description?: string | null;
  created_at?: string;
}

export interface CarExpense {
  id: string;
  car_id: string;
  expense_type: string;
  amount: number | string;
  transaction_date: string;
  description?: string | null;
  created_at?: string;
}

export interface CarFinancialsResponse {
  incomes: CarIncome[];
  expenses: CarExpense[];
  total_income: number | string;
  total_expenses: number | string;
  profit: number | string;
  // Backward-compat alias in case older API payloads still return it.
  profit_loss?: number | string;
}

