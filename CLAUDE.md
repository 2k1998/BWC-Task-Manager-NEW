# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose
BWC Task Manager is an internal operations platform for the "Because We Can" organisation. Staff manage tasks, projects, contacts, companies, payments, cars, documents, and team chat — all scoped to a strict 5-level user hierarchy. Each user can only see and act on resources within their own branch of the tree. FastAPI backend, Next.js 16 static-export frontend, PostgreSQL database, hosted on Render.

---

## Commands

### Backend
```bash
# Start dev server (from backend/)
uvicorn app.main:app --reload

# Run all tests
cd backend && .venv\Scripts\python -m pytest tests/ -v

# Run single test file
cd backend && .venv\Scripts\python -m pytest tests/test_password_admin_only.py -v

# Run single test by name
cd backend && .venv\Scripts\python -m pytest tests/test_file.py::test_function_name -v

# Alembic migrations
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "description"
cd backend && alembic downgrade -1

# Run a backend utility script
cd backend && .venv\Scripts\python scripts/reset_test_agent.py
```

### Frontend
```bash
# Dev server (port 3001 — port 3000 may be occupied by another project)
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev -- --port 3001

# Static build
cd frontend && npm run build

# Lint
cd frontend && npm run lint

# TypeScript type-check
cd frontend && npx tsc --noEmit

# Run all Playwright tests
cd frontend && npx playwright test --reporter=list

# Run a single Playwright spec
cd frontend && npx playwright test tests/task-attachment-download.spec.ts --reporter=list

# View trace on failure
cd frontend && npx playwright show-trace test-results/<dir>/trace.zip
```

---

## Permanent Product Rules

These are non-negotiable decisions. Do not re-implement, work around, or revert them.

- **Passwords are admin-controlled only.** No `/change-password` endpoint, no profile password section, no "forgot password" flow, no `force_password_change` column. Passwords are set only at user creation or via admin "Reset Password". Do NOT add `ChangePasswordRequest` schemas, `/me/password` endpoints, or password UI sections.

---

## Tech Stack

### Backend
- **Python 3.11** (pin via Render service settings — no runtime.txt)
- **FastAPI 0.115.6** + **Uvicorn 0.34.0**
- **SQLAlchemy 2.0.36** (synchronous `Session` — NOT async)
- **Alembic 1.14.0** for migrations
- **Pydantic v2** (`pydantic==2.10.6`, `pydantic-settings==2.7.1`)
- **passlib[bcrypt] 1.7.4** + **bcrypt==4.0.1** for password hashing
- **python-jose[cryptography]** for JWT (HS256)
- **APScheduler 3.10.4** for background jobs
- **psycopg2-binary 2.9.10** for PostgreSQL
- **groq==1.4.0** for chatbot LLM

### Frontend
- **Next.js 16.2.2** (App Router), **React 19.2.3**
- **TypeScript 5**, **Tailwind CSS v4**
- **next-intl 4.9.0** (client-side only — no middleware locale routing)
- **Axios** for API calls, **Sonner** for toasts
- **Recharts** for charts, **Framer Motion** for animations
- **Build output: `export`** (static site — no SSR, no server actions)

### Pinned Versions (do not change without verification)
- `bcrypt==4.0.1` — bcrypt 5.x breaks passlib 1.7.4 (login failures)
- `email-validator==2.2.0` — must be explicit; pydantic v2 doesn't pull it
- `pydantic==2.10.6` — pydantic-core binary wheels require Python <3.14
- `psycopg2-binary==2.9.10` — use binary variant on Render
- `groq==1.4.0` — Groq Python SDK

---

## Architecture

### Backend

**Module structure:** Each feature has its router + handlers in `backend/app/api/<feature>.py`. Models in `app/models/`, schemas in `app/schemas/`. No separate service layer except `app/services/chatbot.py` and scheduled job services.

**Session:** `get_db()` yields a synchronous `sqlalchemy.orm.Session`. All endpoints use `db: Session = Depends(get_db)`.

**Auth dependency chain:**
```python
get_current_user          # Decodes JWT → returns User
require_admin             # Checks user_type == "Admin"
require_hierarchy_manager # Checks Admin/Pillar/Manager/Head
```

**Router registration:** All routers registered in `app/main.py` with `app.include_router(...)`. Prefixes set per-router (e.g. `prefix="/tasks"`).

**Error responses:** Pydantic v2 validation errors return `{ "detail": [{ "msg": "...", "loc": [...] }] }`. Use `extractErrorMessage()` on the frontend to handle both string and array `detail`.

### Frontend

**Static export constraints:** `output: 'export'` in `next.config.ts`. No SSR, no server actions, no API routes. Every dynamic route page must export `generateStaticParams()` — even as an empty stub.

**API client:** `frontend/lib/apiClient.ts` — Axios instance wrapping `getPublicApiBaseUrl()` (from `NEXT_PUBLIC_API_URL`). Global interceptor handles 401 (`window.location.href = '/login'`), 403 (toast), 404 (toast), 500 (toast). Never hardcode localhost — always use `apiClient`.

**Context provider tree** (`app/layout.tsx`):
```
IntlProvider → ErrorBoundary → AuthProvider → PermissionsProvider
  → LanguageProvider → PresenceProvider → NotificationProvider
```
`BranchFilterProvider` wraps page content inside `ProtectedLayout`.

**i18n:** Two locales (`en`, `el`). Locale from `NEXT_LOCALE` cookie, resolved in `components/IntlProvider.tsx`. `LanguageContext` syncs user's profile language on mount and calls `window.location.reload()` **only** when the cookie was already set to a different language — not on first visit (no cookie). This reload-on-mismatch pattern can abort in-flight `page.evaluate` Playwright operations; Playwright tests should inject the `NEXT_LOCALE` cookie or navigate to a stable element before using `evaluate`.

**Routing:** Task clicks open `TaskDetailModal` (right-drawer) — not page navigation. `/tasks/[id]` exists for deep-linking only.

---

## User Hierarchy System

Five roles in strict order: **Admin > Pillar > Manager > Head > Agent**

- `user_type` is a plain `VARCHAR` with a CHECK constraint (not a PG enum).
- `parent_id` on `users` is the canonical hierarchy column (`manager_id` is legacy/unused).
- Non-Admin users see only themselves + all descendants (recursive BFS).
- Admin bypasses all hierarchy checks.

### Visibility vs Assignability (do not confuse)
- **Visibility** (`get_visible_user_ids`): non-Admin sees own + descendants. Controls what DATA a user sees.
- **Assignability** (`get_assignable_user_ids`): everyone sharing the same Admin ancestor. Pillar/Manager/Head structure does NOT restrict assignment. An Agent CAN assign to their Pillar but CANNOT see that Pillar's tasks. Two distinct filters — never collapse them.
- `GET /users/assignable` returns the assignable list for the current user.

### Hierarchy utilities (`backend/app/utils/hierarchy.py`)
- `get_descendant_ids(user_id, db)` — BFS over `parent_id`
- `get_visible_user_ids(actor, db)` — `None` for Admin, `[self.id, ...descendants]` otherwise
- `get_organization_admin(user, db)` — walks `parent_id` up to depth 20 to find Admin root
- `get_assignable_user_ids(user, db)` — `[org_admin.id, ...descendants of org_admin]`
- `validate_creatable_role`, `validate_parent_for_role`, `validate_parent_in_actor_subtree`, `validate_can_manage_target`

---

## Permissions System (two separate systems)

### 1. Module Permissions (`user_permissions` table)
Controls access to app modules (tasks, contacts, companies, projects, cars, analytics, payments, documents).
- `access_level` values: `none`, `view`, `edit`, `delete` (ranked 0–3)
- Admin always returns `delete` for all modules (bypasses DB lookup)
- `GET /auth/me/module-permissions` → `{ "permissions": { "tasks": "edit", ... } }`
- Backend: `app/utils/permissions.py` → `user_has_permission()`, `get_user_module_permissions_map()`
- Frontend: `PermissionsContext` + `useHasPermission(module, requiredLevel)` hook
- **Newly provisioned users have no rows → default `none` → denied everywhere**

### 2. Page Permissions (`user_page_permissions` table)
Legacy system for sidebar page visibility (`none`, `read`, `full`). Managed via admin panel.

---

## Task System

- **Soft delete:** `deleted_at = datetime.now(timezone.utc)`. `GET /tasks` filters `deleted_at IS NULL`.
- **`priority` field is GONE** — removed in migration `9820f9a6414a`. Use `urgency_label` only.
- **Status values** (stored title-case): `New → Received → On Process | Pending → Completed | Loose End`. Terminal: `Completed`.
- **Assignment:** exactly one of `assigned_user_id` OR `assigned_team_id` must be set (CHECK constraint).
- **Shared visibility filter:** `build_task_visibility_filter` in `backend/app/utils/visibility.py` — shared between REST API and chatbot tools; do not duplicate.

---

## Document / Attachment System

- Documents table uses `source` column (`"task"`, `"document"`, `"chat"`, `"call_note"`).
- Task attachments: upload via `POST /tasks/{task_id}/documents` (stores a `Document` row with `source="task"` and a `TaskDocument` junction row).
- Download via `GET /documents/{document_id}` — uses the **`document_id`** field from the junction row, NOT the junction row's own `id`.
- Permission check in `backend/app/utils/document_access.py`: task owner or assigned user (by `assigned_user_id` only — team members of `assigned_team_id` are not granted access).
- Frontend component: `components/TaskAttachmentsSection.tsx` — uses `doc.document_id` for download and delete calls.

---

## Database

- All PKs are UUID. All FKs use `ondelete='RESTRICT'`. All `DateTime` columns use `timezone=True`.
- File references always use `document_id` (never `file_id`).

### Migration heads
- **Local head:** `025_fix_user_permissions_schema`
- **Production head:** `023_add_user_parent_hierarchy` (pending: `024_add_chatbot` + `025`)
- Migration `025` is safe to run on production — it detects and skips if schema is already correct.

### Key column facts
- `tasks.deleted_at` — nullable DateTime for soft delete. No `is_deleted` boolean.
- `tasks.priority` — **removed** (migration `9820f9a6414a`); use `urgency_label`
- `users.parent_id` — added in migration `023`; FK `ON DELETE SET NULL`
- `user_permissions` schema: `id`, `user_id`, `module`, `access_level`, `created_at`, `updated_at`

---

## Deployment

- **Backend:** Render Web Service, root dir `backend`, start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Frontend:** Render Static Site, root dir `frontend`, build: `npm install && npm run build`, publish: `out`
- **Production URLs:** Backend: `https://bwc-portal-backend-w1qr.onrender.com` · Frontend: `https://app.becausewecan.gr`
- **Local dev:** set `NEXT_PUBLIC_API_URL=http://localhost:8000` (in `frontend/.env`, not tracked)

### Before next production deploy
1. Add `GROQ_MODEL=openai/gpt-oss-120b` to Render backend env vars
2. Run `alembic upgrade head` on production DB (applies `024` + `025`; `025` will no-op)
3. Verify `GET /chatbot/conversations` returns 200 with admin JWT

---

## Chatbot System (Phases 1–3 complete)

### Files
| File | Purpose |
|------|---------|
| `backend/app/api/chatbot.py` | Router (`prefix="/chatbot"`) — 4 endpoints |
| `backend/app/services/chatbot.py` | LLM loop, conversation/message CRUD |
| `backend/app/utils/chatbot_tools.py` | 7 tool definitions + `execute_tool()` dispatcher |
| `backend/app/utils/chatbot_data_tools.py` | 6 data tool functions |
| `backend/app/utils/chatbot_context.py` | `ChatbotToolContext` — caches hierarchy + permission lookups per request |
| `backend/app/utils/chatbot_system_prompt.py` | `build_system_prompt(user)` — language-aware, role-aware |
| `frontend/components/chatbot/` | All chatbot UI components |
| `frontend/context/ChatbotContext.tsx` | Chatbot state management |

### LLM configuration (`backend/.env`)
```
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b
```
- **Do NOT use `llama-3.3-70b-versatile` for tool calls** — it generates Llama's `<function=name>` XML format that Groq rejects with HTTP 400 `tool_use_failed`.
- Default in `app/core/config.py` is `llama-3.3-70b-versatile`; the env var overrides it.

### Tool loop behaviour
1. User message saved → LLM called with all 7 tool definitions
2. `tool_calls` in response → execute each → save result rows → loop (max 5 iterations)
3. Plain text response → save as assistant message → return
4. On `LLMProviderError`: error message prefixed `⚠️` saved and returned

### Known gaps
- `chatbot_knowledge` table is **empty** — KB searches return no content
- `user_onboarding_progress` logic not implemented
- Urgency label alignment: model sometimes passes `"Urgent"` instead of `"Urgent & Important"` to `get_my_tasks` filter (exact-match column)

---

## Design System

- Gold: `#D1AE62` · Black: `#000000` (sidebar bg — NOT `#111827`) · Brown: `#342C19` · Silver: `#D9D9D9`
- Body font: Arial/Helvetica — **not Inter**. Base font size: `15px`.
- `overflow-x: hidden` on `html` and `body` — no horizontal scroll anywhere.
- `shadow-xl` on modals only; prefer borders over box shadows for cards.
- Urgency colors: Urgent & Important → red · Urgent → blue · Important → green · Not Urgent & Not Important → yellow · Same-day auto → orange. Use `getUrgencyColors(urgencyLabel)` from `frontend/lib/urgencyMapping.ts`.

---

## Local Development

### Credentials
- **Local admin:** `kabaniskostas1998@gmail.com` / `Administrator`
- **Test agent:** `phase8_test@example.com` / `TestAgent123`
- **Production admin:** `kabaniskostas1998@gmail.com` / `Administrator`
- Login field: `username_or_email` (NOT `email`) — `POST /auth/login`

### Playwright / automation login pattern
The login form's `router.push('/dashboard')` has a race with `fetchUser()`. For automation, inject tokens directly:
```typescript
const tokens = await page.evaluate(async () => {
  const r = await fetch('http://localhost:8000/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username_or_email:'...', password:'...'})
  });
  return r.json();
});
await page.evaluate(t => {
  localStorage.setItem('access_token', t.access_token);
  localStorage.setItem('refresh_token', t.refresh_token);
}, tokens);
await page.goto('/dashboard', {waitUntil:'domcontentloaded'});
```

### Backend utility scripts (run from `backend/`)
| Script | Purpose |
|--------|---------|
| `scripts/reset_test_agent.py` | Reset first Agent user password to `TestAgent123` |
| `scripts/branch_isolation_check.py` | DB ground-truth verification of branch isolation |
| `scripts/seed_chatbot_knowledge.py` | Seed 20 KB articles (EN/EL) into `chatbot_knowledge` |
| `scripts/create_admin.py` | Idempotent admin user creation |

---

## DO NOT TOUCH
- `frontend/context/AuthContext.tsx` — fragile; do not refactor
- `frontend/lib/apiClient.ts` — interceptors and base URL logic are final
- `frontend/app/login/page.tsx` — stable; do not restructure

## When Reverting
```bash
git reset --hard <commit-hash> && git push origin main --force
```
