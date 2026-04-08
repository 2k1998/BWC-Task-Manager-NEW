# PRD #0 — Core Architecture & System Rules (BWC Task Manager)

## TL;DR
PRD #0 defines the **non‑negotiable architectural decisions and system‑wide rules** for the BWC Task Manager. All other PRDs depend on this document. If a conflict exists between PRD #0 and any other PRD, **PRD #0 always wins**.

This document is frozen before coding begins.

---

## 1. Technology Stack (LOCKED)

### Backend
- Language: **Python 3.11+**
- Framework: **FastAPI**
- ORM: **SQLAlchemy 2.x (explicit models, no magic)**
- Migrations: **Alembic**
- Async only where necessary (no premature async)

### Database
- **PostgreSQL** (Render-managed)
- UUID primary keys everywhere
- Timezone-aware timestamps (UTC)

### Frontend
- **Next.js (App Router)**
- TypeScript mandatory
- TailwindCSS for styling
- Responsive by default (desktop + mobile)

### Realtime
- WebSockets (FastAPI + frontend WS client)
- Used for:
  - Presence
  - Chat
  - Live notifications

### File Storage
- S3-compatible storage (preferred)
- Render disk as fallback
- Files never served directly; always proxied

---

## 2. Global System Rules (NON‑NEGOTIABLE)

1. **Backend is the single source of truth**
2. No business logic in the frontend
3. No client-side permission decisions
4. UUIDs are never regenerated
5. No cascading deletes
6. Foreign keys use `RESTRICT` on delete
7. Soft deletes only when explicitly defined
8. No implicit defaults (everything explicit)

---

## 3. Authentication & Authorization

### Authentication
- JWT access tokens
- Refresh tokens stored server-side
- Forced password change on first login

### Authorization
- Page-based permissions only:
  - `none`
  - `read`
  - `full`
- User type (Agent, Head, Manager, Pillar, Admin) is **semantic only**
- Permissions are evaluated:
  1. Admin override
  2. Explicit page permission
  3. Hierarchy scope (if applicable)

---

## 4. Hierarchy Rules (GLOBAL)

- Each user can have **one manager**
- A manager can have **many subordinates**
- Hierarchy affects:
  - Task visibility
  - Task transfer
  - Filters
  - Analytics scope

Hierarchy NEVER grants edit permissions by itself.

---

## 5. Data Ownership Rules

### Tasks
- Always have an **owner** (creator)
- May have:
  - One user assignee OR
  - One team assignee

### Teams
- Exactly one Head
- Head does not own tasks unless assigned

### Companies
- Are global, immutable by default
- Referenced everywhere

---

## 6. Notifications & Activity Feed

### Notifications
- Created by backend only
- Delivered via WebSocket + stored
- Clicking notification deep-links to entity

### Activity Feed
- Logs important events only
- Immutable
- No deletion or editing

---

## 7. Retention & Cleanup Rules

- Tasks (completed/deleted): 90 days
- Events (completed): 3 days
- Call notes files: 7 days
- Chat messages: permanent

Retention handled by background jobs only.

---

## 8. Migration Constraints (CRITICAL)

- Existing production data has priority
- IDs must be preserved
- No destructive migrations
- Migration scripts must be idempotent

---

## 9. Error Handling & Logging

- All errors logged server-side
- No sensitive data in logs
- Frontend receives sanitized messages only

---

## 10. Performance & Safety

- No N+1 queries
- Index foreign keys
- Rate-limit admin endpoints
- Validate all user input

---

## 11. Final Authority Rule

If a question arises during implementation and:
- PRD #1–17 do not explicitly answer it
- PRD #0 defines a principle

➡️ **PRD #0 must be followed**.

---

## SCHEMA FREEZE NOTICE

PRD #0 is frozen once coding begins.
Any change requires full review and migration impact analysis.

