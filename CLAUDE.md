# BWC Task Manager — Claude Code Context

## Project Purpose
BWC Task Manager is an internal operations platform for the "Because We Can" organisation. It lets staff manage tasks, projects, contacts, companies, payments, cars, documents, and team chat — all scoped to a strict 5-level user hierarchy. Each user can only see and act on resources within their own branch of the tree. The app has a FastAPI backend, a Next.js 16 static-export frontend, and a PostgreSQL database, all hosted on Render.

## Permanent Product Rules

These rules are non-negotiable product decisions. Do not re-implement, work around, or revert them in any future session.

- **Passwords are admin-controlled only.** Users cannot change their own password under any circumstances. There is no `/change-password` endpoint, no profile-page password section, no "forgot password" flow, no force-change-on-next-login flow. The ONLY way a password is set or changed is:
  1. Admin creates a new user (generates initial password, shown once in the password-display modal)
  2. Admin clicks "Reset Password" on the admin users page (generates new password, shown once)

  The temporary password is communicated to the user out-of-band by the admin. The user uses it as-is going forward. Do NOT add `ChangePasswordRequest` schemas, do NOT add `/me/password` endpoints, do NOT add "change password" UI sections, do NOT re-introduce `force_password_change` columns.

## Repo Layout
```
/
├── backend/          FastAPI API, SQLAlchemy models, Alembic migrations
├── frontend/         Next.js 16 app (static export), Tailwind v4, next-intl
├── PRDS/             Product requirement documents (historical context, do not edit)
├── backups/          PostgreSQL dump taken before DB cutover 2026-04-20
├── migrate.py        One-off data-migration helper script (root level)
└── README.md
```

## Tech Stack

### Backend
- **Python 3.11** (no runtime.txt — pin via Render service settings)
- **FastAPI 0.115.6** + **Uvicorn 0.34.0**
- **SQLAlchemy 2.0.36** (synchronous `Session`, NOT async)
- **Alembic 1.14.0** for migrations
- **Pydantic v2** (`pydantic==2.10.6`, `pydantic-settings==2.7.1`)
- **passlib[bcrypt] 1.7.4** + **bcrypt==4.0.1** for password hashing
- **python-jose[cryptography]** for JWT (HS256)
- **APScheduler 3.10.4** for background jobs (daily call reminders, retention jobs)
- **psycopg2-binary 2.9.10** for PostgreSQL

### Frontend
- **Next.js 16.2.2** (App Router), **React 19.2.3**
- **TypeScript 5**, **Tailwind CSS v4**
- **next-intl 4.9.0** (client-side only — no middleware locale routing)
- **Axios** for API calls, **Sonner** for toasts
- **Recharts** for analytics charts, **Framer Motion** for animations
- **Build output: `export`** (static site — no SSR, no server actions)

### Database
- PostgreSQL (Render Frankfurt region, `bwc_db`)
- All PKs are UUID
- All FKs use `ondelete='RESTRICT'` (no CASCADE deletes anywhere)
- All `DateTime` columns use `timezone=True`
- File references use `document_id` (never `file_id`)

### Hosting
- **Backend**: Render Web Service, root dir `backend`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Frontend**: Render Static Site, root dir `frontend`, build `npm install && npm run build`, publish dir `out`
- No Vercel, no Docker, no render.yaml

## Pinned Versions (CRITICAL — do not change without verification)
- `bcrypt==4.0.1` — bcrypt 5.x is incompatible with passlib 1.7.4 (causes login failures)
- `email-validator==2.2.0` — must be explicit in requirements.txt; pydantic v2 does not pull it automatically
- `pydantic==2.10.6` — pydantic-core binary wheels require Python <3.14; do NOT upgrade Python to 3.12+ without verifying wheel availability
- `psycopg2-binary==2.9.10` — binary wheel; on Render use psycopg2-binary (not psycopg2)
- `groq==1.4.0` — Groq Python SDK; added 2026-05-29 for chatbot feature

## Database State

### Migration heads
- **Local head**: `025_fix_user_permissions_schema` (applied 2026-05-31)
- **Production head**: `023_add_user_parent_hierarchy` (as of 2026-05-31 audit)
- **Pending on production**: `024_add_chatbot` → `025_fix_user_permissions_schema`

### Migration chain (local)
```
... → 9820f9a6414a → 20260430_add_user_permissions → 023_add_user_parent_hierarchy
    → 024_add_chatbot → 025_fix_user_permissions_schema   ← local head
```

### Migration 025 — LOCAL-ONLY conditional fix
Migration `025_fix_user_permissions_schema` is **safe to run on production** (no-op if schema is already correct). It checks for the legacy `permission_name` column before acting:
- **Local dev only**: the `user_permissions` table had legacy columns (`permission_name`, `granted_at`). The upgrade drops and recreates with `module`/`access_level` columns.
- **Production**: table already has correct schema from `20260430`. The upgrade detects this and skips. No data at risk.

### Key tables
users, tasks, projects, companies, contacts, daily_calls, call_notes_files, documents, task_documents, task_comments, events, teams, team_members, departments, payments, cars, car_expenses, car_incomes, car_maintenances, chat_threads, chat_thread_members, chat_messages, notifications, activity_logs, user_permissions, user_page_permissions, pages, approval_requests, audit_logs (user_audit_logs), user_profiles, chatbot_conversations, chatbot_messages, chatbot_knowledge, user_onboarding_progress

### Notable column facts
- **Soft delete**: `tasks` uses `deleted_at` (nullable DateTime). No `is_deleted` boolean on tasks — the filter helper checks both for backwards safety.
- **`priority` column removed** from `tasks` table (migration `9820f9a6414a`). Use `urgency_label` only.
- **`parent_id`** added to `users` (migration `023`); FK `ON DELETE SET NULL`.
- **`user_permissions`** schema: `id`, `user_id`, `module` (varchar), `access_level` (varchar), `created_at`, `updated_at`. Production has 16 real rows.
- **Chatbot tables** added (migration `024`): `chatbot_conversations`, `chatbot_messages`, `chatbot_knowledge`, `user_onboarding_progress`. `chatbot_knowledge` is currently EMPTY — KB searches return "No matching articles found."

### Production DB audit finding (2026-05-31)
- Production `user_permissions` already has new schema (`module`/`access_level`). 16 real rows.
- Production timestamps are `WITHOUT time zone` (from `20260430`); local is `WITH time zone` (from `025`). Benign drift — both work.

## User Hierarchy System
Five roles in strict order: **Admin > Pillar > Manager > Head > Agent**

- `user_type` is a plain `VARCHAR` column with a CHECK constraint (not a PG enum).
- `parent_id` on `users` is the canonical hierarchy column (`manager_id` exists but is legacy/unused).
- Branch isolation: non-Admin users see only themselves + all descendants (recursive BFS).
- Admin sees everything; Admin bypasses all hierarchy checks.

### Who can create whom (ROLE_CREATION_MAP)
| Actor   | Can create                      |
|---------|---------------------------------|
| Admin   | Pillar, Manager, Head, Agent    |
| Pillar  | Manager, Head, Agent            |
| Manager | Head, Agent                     |
| Head    | Agent                           |
| Agent   | (nobody)                        |

### Valid parent roles (VALID_PARENT_ROLES_MAP)
| Role    | Valid parents                        |
|---------|--------------------------------------|
| Pillar  | Admin                                |
| Manager | Admin, Pillar                        |
| Head    | Admin, Pillar, Manager               |
| Agent   | Admin, Pillar, Manager, Head         |

Admin has no parent. Pillar's `parent_id` must point to an Admin.

### Hierarchy utility: `backend/app/utils/hierarchy.py`
- `get_descendant_ids(user_id, db)` — BFS over `parent_id`; returns `list[UUID]`
- `get_visible_user_ids(actor, db)` — returns `None` (Admin sees all) or `[self.id, ...descendants]`
- `validate_creatable_role(actor_type, new_type)` — raises 400 if not allowed
- `validate_parent_for_role(child_role, parent_id, db)` — raises 400/403 on bad parent
- `validate_parent_in_actor_subtree(actor, parent_id, db)` — non-Admin: parent must be in actor's branch
- `validate_can_manage_target(actor, target_id, db)` — 403 if target not in actor's branch
- `HIERARCHY_MANAGER_TYPES = ("Admin", "Pillar", "Manager", "Head")` — used by `require_hierarchy_manager` dep and chatbot `get_team_workload` role gate

## Permissions System
There are **two separate permission systems** — do not confuse them:

### 1. Module Permissions (`user_permissions` table)
Used to control access to app modules (tasks, contacts, etc.).
- **access_level values**: `none`, `view`, `edit`, `delete` (ordered by rank 0-3)
- **Modules**: `tasks`, `contacts`, `companies`, `projects`, `cars`, `analytics`, `payments`, `documents`
- Admin always returns `delete` for all modules (bypasses DB lookup)
- Endpoint: `GET /auth/me/module-permissions` → `{ "permissions": { "tasks": "edit", ... } }`
- Backend helper: `app/utils/permissions.py` → `user_has_permission()`, `get_user_module_permissions_map()`
- Frontend: `PermissionsContext` + `useHasPermission(module, requiredLevel)` hook
- **Chatbot tools**: chatbot data tools check module permissions via `ChatbotToolContext.no_module_access_message()`. Users with no rows in `user_permissions` for a module default to `"none"` access and are refused. Newly provisioned users need explicit permission rows.

### 2. Page Permissions (`user_page_permissions` table)
Legacy system for sidebar page visibility (access: `none`, `read`, `full`). Managed via admin panel.

## Backend Patterns

### Session
`get_db()` yields a synchronous `sqlalchemy.orm.Session` (not async). All endpoints use `db: Session = Depends(get_db)`.

### Auth dependency chain
```python
get_current_user          # Decodes JWT Bearer token → returns User
require_admin             # Wraps get_current_user, checks user_type == "Admin"
require_hierarchy_manager # Wraps get_current_user, checks Admin/Pillar/Manager/Head
```

### Module structure pattern
Each feature lives in `backend/app/api/<feature>.py` (router + inline handlers). Models in `app/models/`, schemas in `app/schemas/`. No separate service layer for most features — exception: `app/services/chatbot.py` (chatbot LLM loop) and `app/services/` for scheduled background jobs.

### Shared visibility filters — `backend/app/utils/visibility.py`
Task and project visibility filters live here and are shared between the REST API (`tasks.py`) and chatbot data tools. Do not duplicate this logic:
- `build_task_visibility_filter(user, db, branch_ids)` — Admin: all or branch-scoped; non-Admin: own + descendants + team assignments
- `build_project_visibility_filter(user)` — Admin: all; others: owner or project_manager
- `task_not_soft_deleted_filter()` — excludes `deleted_at IS NOT NULL`

### Router registration
All routers registered in `app/main.py` with `app.include_router(...)`. No prefix in the router itself for most; prefix set per-router (e.g. `prefix="/tasks"`, `tags=["Tasks"]`).

### Error responses
Pydantic v2 validation errors return `{ "detail": [{ "msg": "...", "loc": [...] }] }` (array). Use `extractErrorMessage()` utility on the frontend to handle both string and array detail.

## Frontend Patterns

### Static export constraints
- `output: 'export'` in `next.config.ts` — no SSR, no server actions, no API routes
- **Every dynamic route page must export `generateStaticParams()`** — even as an empty stub:
  ```ts
  export function generateStaticParams() { return []; }
  ```
- next-intl middleware is **removed** — locale detection is client-side only via `IntlProvider` + `LanguageContext`

### API client
- `frontend/lib/apiClient.ts` — Axios instance wrapping `getPublicApiBaseUrl()` (from `NEXT_PUBLIC_API_URL` env var)
- Global interceptor handles 401 (force logout), 403 (toast), 404 (toast), 500 (toast)
- **Never hardcode localhost** in call sites — always use `apiClient` or `getPublicApiBaseUrl()`
- **Local dev requires `NEXT_PUBLIC_API_URL=http://localhost:8000`** — there is no `.env` file in the repo; set it inline when starting the dev server: `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev -- --port 3001`

### Context provider tree (in order, `app/layout.tsx`)
```
IntlProvider → ErrorBoundary → AuthProvider → PermissionsProvider
  → LanguageProvider → PresenceProvider → NotificationProvider
```
`BranchFilterProvider` wraps page content inside `ProtectedLayout`.

### Context locations
- `frontend/context/AuthContext.tsx` — user, login, logout, refreshUser (**DO NOT TOUCH**)
- `frontend/context/LanguageContext.tsx` — language state, persists to cookie + backend profile
- `frontend/context/PermissionsContext.tsx` — module permissions map
- `frontend/context/BranchFilterContext.tsx` — Admin-only branch selector for scoped views
- `frontend/context/NotificationContext.tsx` — notification state
- `frontend/context/PresenceContext.tsx` — WebSocket presence
- `frontend/context/ChatbotContext.tsx` — chatbot open/close, conversation list, message send

### Error message utility
```ts
import { extractErrorMessage } from '@/lib/utils';
// Handles string detail, array detail [{msg}], or plain message
```

### Routing
Task clicks open `TaskDetailModal` (right drawer, `components/TaskDetailModal.tsx`) — not page navigation. The `/tasks/[id]` route exists for deep-linking but the primary UX is the modal.

## Design System

### Brand palette
- Gold: `#D1AE62` (`brand.gold`, `primary.gold`)
- Black: `#000000` (`brand.black`, sidebar bg)
- Brown: `#342C19` (`brand.brown`)
- Silver: `#D9D9D9` (`brand.silver`)

### Sidebar
- Background: `#000000` (pure black, NOT `#111827`)
- Text: `#D9D9D9`, active: `#D1AE62`, hover: `#342C19`

### Typography & spacing
- Body font: Arial/Helvetica (globals.css) — **not Inter**
- Base font size: `15px` (0.9375rem, configured in tailwind.config.ts)
- `overflow-x: hidden` enforced on `html` and `body` — **no horizontal scroll allowed anywhere**
- `shadow-xl` on modals only; prefer borders over box shadows for cards

### Urgency label colors (Tailwind utility classes)
| Label                       | Tailwind color | Hex approx |
|-----------------------------|----------------|------------|
| Urgent & Important          | red-*          | #EF4444    |
| Urgent                      | blue-*         | #3B82F6    |
| Important                   | green-*        | #22C55E    |
| Not Urgent & Not Important  | yellow-*       | #EAB308    |
| Same-day auto               | orange-*       | #F97316    |

Use `getUrgencyColors(urgencyLabel)` from `frontend/lib/urgencyMapping.ts` for CSS classes.
Transfer is only allowed for "Not Urgent & Not Important" tasks (`isTransferable()`).

## i18n
- Two locales: `en`, `el`
- Message files: `frontend/messages/en.json`, `frontend/messages/el.json`
- `i18n.ts` always returns locale `"en"` at build time (static export requirement)
- Runtime locale from `NEXT_LOCALE` cookie, resolved in `components/IntlProvider.tsx`
- `LanguageContext` persists selection to `/profile/me` (backend) and reloads page on change
- `timeZone: 'Europe/Athens'` — apply when formatting dates in Greek context
- No `middleware.ts` for locale routing — it was removed

## Task System
- **Soft delete**: set `deleted_at = datetime.now(timezone.utc)`. `GET /tasks` filters `deleted_at IS NULL`.
- **`priority` field is GONE** — do not add it back. Use `urgency_label` only.
- **Status values** (title-case, stored as-is in DB):
  - `New` → `Received` → `On Process` or `Pending` → `Completed` or `Loose End`
  - Terminal state: `Completed` (no further transitions)
- Task assignment: exactly one of `assigned_user_id` OR `assigned_team_id` must be set (CHECK constraint).
- Task visibility: owner, assigned user, assigned team member, or descendant of assigned user can view.
- Branch filter: `BranchFilterContext` + `branchQueryParams()` from `lib/branchFilter.ts` — Admin can filter by branch head; non-Admin automatically scoped.

## Deployment
- **Backend**: Render Web Service, root dir `backend`, Python 3.11 (set in Render dashboard)
- **Frontend**: Render Static Site, root dir `frontend`, build `npm install && npm run build`, publish dir `out`
- **Database**: PostgreSQL on Render Frankfurt region (`bwc_db`)
- **Custom domain**: `app.becausewecan.gr`
- **Production URLs**:
  - Backend: `https://bwc-portal-backend-w1qr.onrender.com`
  - Frontend: `https://app.becausewecan.gr`
- Local dev: `NEXT_PUBLIC_API_URL=http://localhost:8000` (in `frontend/.env` — not tracked in git)

### Pre-production deploy checklist (next deploy)
1. Add `GROQ_MODEL=openai/gpt-oss-120b` to Render backend environment variables
2. Run `alembic upgrade head` on production DB — applies `024_add_chatbot` + `025_fix_user_permissions_schema` (025 will no-op since production already has new schema)
3. Verify `GET /chatbot/conversations` returns 200 with admin JWT

## Working Workflow
- Solo developer: **Kostas**
- Claude (chat) → produces targeted prompts → Kostas runs in Cursor or Claude Code → pastes output back
- Kostas prefers **one clear path forward** — no option lists, no conceptual explanations when a command suffices, no repetitive questions
- Backend and frontend Cursor sessions kept separate
- All schema changes go through Alembic — never alter the DB directly
- Production DB operations: use the full Render PostgreSQL connection string from the Render dashboard

## DO NOT TOUCH
- `frontend/context/AuthContext.tsx` — was broken in past sessions; do not refactor
- `frontend/lib/apiClient.ts` — interceptors and base URL logic are final
- `frontend/app/login/page.tsx` — login page is stable; do not restructure

## When Reverting
```bash
git reset --hard <commit-hash> && git push origin main --force
```

## Local Development Credentials
- **Local admin**: `kabaniskostas1998@gmail.com` / `Administrator`
- **Local system admin** (seeded): `admin@bwc.com` / password unknown locally — use kabaniskostas1998@gmail.com instead
- **Test agent** (provisioned for isolation testing): `phase8_test@example.com` / `TestAgent123`
- **Production admin** (Render DB): `kabaniskostas1998@gmail.com` / `Administrator`
- Top-level user (root of production hierarchy): `kyriakosmadakis@gmail.com`
- Login field name: `username_or_email` (NOT `email`) — `POST /auth/login`

### Local dev login quirk (Playwright / automation)
The login form's `router.push('/dashboard')` has a race condition with `fetchUser()` in AuthContext. For automation, inject tokens directly:
```typescript
// 1. Fetch token via evaluate (avoids form submit race)
const tokens = await page.evaluate(async () => {
  const r = await fetch('http://localhost:8000/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username_or_email:'...', password:'...'})
  });
  return r.json();
});
// 2. Inject into localStorage and navigate directly
await page.evaluate(t => {
  localStorage.setItem('access_token', t.access_token);
  localStorage.setItem('refresh_token', t.refresh_token);
}, tokens);
await page.goto('/dashboard', {waitUntil:'domcontentloaded'});
```

## Backend Scripts
| Script | Purpose |
|--------|---------|
| `backend/scripts/reset_test_agent.py` | Resets the first Agent user's password to `TestAgent123`; prints their stats (task counts, descendants, contacts) |
| `backend/scripts/branch_isolation_check.py` | Direct DB ground-truth verification of branch isolation — compares task/contact/project counts for a given agent_id vs admin |

Run both from the `backend/` directory with `.venv\Scripts\python scripts/<name>.py [args]`.

## E2E Tests (Playwright)
- Config: `frontend/playwright.config.ts` — baseURL `http://localhost:3001`, headless Chromium
- Spec: `frontend/tests/chatbot.e2e.spec.ts` — 13 checks (a–m) for chatbot Phase 2 frontend
- Run: `cd frontend && npx playwright test --reporter=list`
- **Port note**: port 3000 may be occupied by another project. Start BWT frontend on 3001:
  ```bash
  NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev -- --port 3001
  ```
- All 13 checks passed as of 2026-05-31 (button visible, panel open/close, Greek replies, KB graceful, markdown rendering, history, conversation switch, mobile viewport, no horizontal scroll)

## Chatbot System (Phases 1–3 — complete as of 2026-05-31)

### Status summary
| Phase | What | Status |
|-------|------|--------|
| 1 | Backend LLM loop, 4 tools, knowledge base | ✅ Complete |
| 2 | Frontend chatbot widget (button, panel, messages, history) | ✅ Complete, verified by Playwright |
| 3 Batch 1 | Data tools verified: get_my_tasks, get_my_projects, get_my_contacts | ✅ Complete |
| 3 Batch 2 | New tools verified: get_team_members, get_team_workload, get_app_stats | ✅ Complete |
| KB content | chatbot_knowledge population with how-to articles | ⏳ Not started |
| Onboarding | user_onboarding_progress logic | ⏳ Not started |

### Files
| File | Purpose |
|------|---------|
| `backend/app/api/chatbot.py` | Router (`prefix="/chatbot"`) — 4 endpoints |
| `backend/app/services/chatbot.py` | LLM loop, conversation/message CRUD |
| `backend/app/models/chatbot.py` | ChatbotConversation, ChatbotMessage, ChatbotKnowledge, UserOnboardingProgress |
| `backend/app/schemas/chatbot.py` | Pydantic schemas for API |
| `backend/app/utils/llm_provider.py` | Abstract LLMProvider base class, LLMMessage, LLMResponse, LLMProviderError |
| `backend/app/utils/groq_provider.py` | GroqProvider (concrete), `get_llm_provider()` singleton |
| `backend/app/utils/chatbot_tools.py` | 7 tool definitions + `execute_tool()` dispatcher |
| `backend/app/utils/chatbot_data_tools.py` | 6 data tool functions (see tool table below) |
| `backend/app/utils/chatbot_knowledge.py` | `search_knowledge_base()` — queries `chatbot_knowledge` table |
| `backend/app/utils/chatbot_system_prompt.py` | `build_system_prompt(user)` — language-aware, role-aware |
| `backend/app/utils/chatbot_context.py` | `ChatbotToolContext` — caches hierarchy + permission lookups per request |
| `frontend/components/chatbot/` | ChatbotButton, ChatbotPanel, ChatbotHeader, ChatbotMessages, ChatbotMessage, ChatbotInput, ChatbotConversationList |
| `frontend/context/ChatbotContext.tsx` | Chatbot state, open/close, conversation management, message sending |
| `frontend/lib/chatbotApi.ts` | Typed API wrappers for chatbot endpoints |

### API endpoints
```
POST /chatbot/conversations                          → 201 ConversationRead
GET  /chatbot/conversations                          → list[ConversationListItem]
GET  /chatbot/conversations/{id}/messages            → list[MessageRead]
POST /chatbot/conversations/{id}/messages            → MessageRead (triggers LLM)
```
All endpoints require Bearer JWT. Router registered in `app/main.py`.

### 7 registered tools
| Tool | Role gate | Module needed | Description |
|------|-----------|---------------|-------------|
| `search_knowledge_base` | none | none | Searches `chatbot_knowledge` table; returns empty when KB unpopulated |
| `get_my_tasks` | none | tasks ≥ view | Branch-scoped task list with status/urgency/deadline filters |
| `get_my_projects` | none | projects ≥ view | Owner or project_manager visibility |
| `get_my_contacts` | none | contacts ≥ view | Private per-user contacts (Contact.user_id == actor) |
| `get_team_members` | none | none | Admin: all non-Admin; others: direct reports or full branch |
| `get_team_workload` | **Head+** | tasks ≥ view | Per-member open/overdue/completed counts; refused for Agent with exact message |
| `get_app_stats` | none | tasks ≥ view | Personal: open, overdue, due today, due this week, completed recently, projects |

`get_team_workload` refusal message (exact string returned to LLM):
> "You need to be a team leader (Head, Manager, Pillar, or Admin) to view team workload."

### LLM configuration (backend/.env)
```
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b
```
- **Do NOT use `llama-3.3-70b-versatile`** for tool calls — it generates Llama's native `<function=name {...}>` XML format which Groq rejects with HTTP 400 `tool_use_failed`. `openai/gpt-oss-120b` produces correct OpenAI JSON tool_calls format.
- The default in `app/core/config.py` remains `llama-3.3-70b-versatile`; the env var overrides it. **Before deploying to production, add `GROQ_MODEL=openai/gpt-oss-120b` to Render environment variables.**

### Settings fields (app/core/config.py)
```python
GROQ_API_KEY: str = ""
GROQ_MODEL: str = "llama-3.3-70b-versatile"   # override via .env
CHATBOT_MAX_TOOL_ITERATIONS: int = 5
CHATBOT_MAX_HISTORY_MESSAGES: int = 20
CHATBOT_MAX_USER_MESSAGE_CHARS: int = 4000
CHATBOT_REQUEST_TIMEOUT_SECONDS: float = 30.0
```

### Tool loop behaviour
1. User message saved → LLM called with all 7 tool definitions
2. If model returns tool_calls → execute each → save tool result rows → loop (iter+1)
3. If model returns plain text → save as assistant message → return
4. Max iterations: 5. On exhaustion: fallback message saved.
5. On `LLMProviderError` (e.g. rate limit, timeout): error message prefixed with `⚠️` saved and returned.

### tool_use_failed fallback (groq_provider.py)
If Groq returns HTTP 400 with code `tool_use_failed`, `GroqProvider.chat_completion` automatically retries the same request WITHOUT the `tools` parameter so the model answers from its own context. The fallback fires silently (logged as WARNING). In practice not needed with `openai/gpt-oss-120b`.

### System prompt & language
- `build_system_prompt(user)` in `app/utils/chatbot_system_prompt.py`
- Reads `getattr(user, "language", None) or "el"` — `language` lives on `UserProfile`, not `User`, so `getattr` returns `None` for users without a profile; defaults to `"el"` (Greek).
- Always replies in the user's preferred language regardless of what language the user writes in.
- Scope: BWC Task Manager questions only. Greetings/introductions are explicitly in-scope (do not refuse).
- Contains hierarchy, urgency labels, task statuses inline — answers from system prompt even when KB is empty.

### Urgency label LLM alignment note
The model occasionally passes `"Urgent"` to `get_my_tasks(urgency_label=...)` when the DB stores `"Urgent & Important"`. The tool uses exact-match `Task.urgency_label == value`, so this returns 0 rows. This is a model/prompt alignment gap — the system prompt should enumerate the exact label strings. Known issue, not a tool bug.

### ChatbotToolContext security boundary
`backend/app/utils/chatbot_context.py` — one instance per request; caches:
- `visible_user_ids()` — calls `get_visible_user_ids()` once; Admin returns None (no filter)
- `module_access_level(module)` — reads `user_permissions` table once per request
- `can_view(module)` — Admin always True; others check `user_has_permission()`
- `is_hierarchy_manager()` — delegates to `hierarchy.is_hierarchy_manager(user_type)`

### Branch isolation — verified results (2026-05-31)
Ground truth and chatbot tool output match for test agent (`phase8_test@example.com`, Agent, 0 descendants):

| Metric | Agent (DB) | Agent (chatbot) | Admin (DB) | Admin (chatbot) |
|--------|-----------|-----------------|-----------|-----------------|
| Tasks  | 0         | 0               | 63        | 25 (cap)        |
| Contacts | 0       | 0               | 0         | 0               |
| Projects | 0       | 0               | 0         | 0               |

### Frontend chatbot UI — component guide
- **Launcher button**: `fixed bottom-6 right-6 z-50`, `aria-label="Open assistant"` / `"Close assistant"`
- **Panel**: `motion.aside` with `aria-label="BWC Assistant chat panel"`, slides in from right, `w-full md:w-[420px]`
- **Header**: title "BWC Assistant", tagline, conversation list button (`aria-label="Conversations"`), new conversation button (`aria-label="New conversation"`), close button (`aria-label="Close assistant"`)
- **Messages area**: empty state shows "How can I help you today?"; thinking indicator has `aria-label="Thinking…"`; assistant messages rendered with `<ReactMarkdown remarkPlugins={[remarkGfm]}>` inside `.prose` div
- **Input**: `<textarea placeholder="Type your message…">`, Enter to send (Shift+Enter for newline), 4000 char cap

### Logging
`logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")` in `app/main.py`. `httpx` and `httpcore` silenced to WARNING. Per-request log line: `"Chatbot LLM call: conv=X iter=N history_msgs=M"`.

### Known gaps
- `chatbot_knowledge` table is **empty** — populate with how-to articles so KB searches return real content.
- `user_onboarding_progress` table exists but no onboarding logic implemented yet.
- Urgency label string alignment: model sometimes passes `"Urgent"` instead of `"Urgent & Important"` to the filter.
- WebSocket presence (`ws://localhost:8000/ws/presence`) returns 403 in Playwright/headless contexts — not a chatbot issue.

## Currently In Progress (as of 2026-05-31)
- **Chatbot Phases 1–3**: COMPLETE. Backend + frontend verified. 7 tools registered and tested. Branch isolation confirmed.
- **Chat feature**: real-time department-based chat using WebSockets (`/api/chat`, `presence` router). Already shipped.
- **Next up**: Populate `chatbot_knowledge` with BWC how-to articles (KB currently empty).
- **Before next production deploy**: add `GROQ_MODEL=openai/gpt-oss-120b` to Render env vars; run `alembic upgrade head` (applies 024 + 025, 025 will no-op).
