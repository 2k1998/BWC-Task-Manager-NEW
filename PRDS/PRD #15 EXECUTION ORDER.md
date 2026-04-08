# PRD #15 — Execution Order & Build Plan (BWC Task Manager)

## TL;DR
This document defines the **exact execution order** for building the BWC Task Manager using a coding AI agent. The order minimizes rework, prevents circular dependencies, and ensures every module is built on stable foundations.

This is not about speed. It is about **correctness and safety**.

---

## Core Principles for Execution

1. Build **in dependency order**, not feature order
2. Backend foundations always come before frontend polish
3. Auth, permissions, and schema freeze early
4. Migration happens only after schemas are final
5. No UI work before APIs are stable

---

## Phase 0 — Repository & Environment Setup (MANDATORY FIRST)

### Backend
- Initialize FastAPI project
- Configure PostgreSQL connection
- Set up SQLAlchemy + Alembic
- Create base project structure
- Add logging, settings, env handling

### Frontend
- Initialize Next.js app
- Global layout, theme, Tailwind config
- Auth routing skeleton (login/logout)

🚫 Do NOT build features yet.

---

## Phase 1 — Auth, Users & Permissions (PRD #8)

### Backend
- Users table
- Auth (JWT + refresh)
- Pages seed
- user_page_permissions
- Hierarchy (manager_id)
- Admin-only endpoints

### Frontend
- Login flow
- Auth guard
- Permission-based routing
- Admin → Users page (basic CRUD)

📌 Nothing else proceeds until this works.

---

## Phase 2 — Core Reference Data

### Companies (PRD #4)
- Companies CRUD
- Hard constraints (no deletion if referenced)

### Departments (PRD #10)
- Departments CRUD
- Seed default departments

📌 These must be stable before Tasks.

---

## Phase 3 — Teams (PRD #3)

### Backend
- Teams
- Team members
- Permissions enforcement

### Frontend
- Teams list
- Team detail
- Create/edit team

📌 Required before Tasks assignment logic.

---

## Phase 4 — Tasks (PRD #1)

### Backend
- Tasks
- Task assignees
- Status lifecycle
- Transfers
- Retention logic (flags only, no cron yet)

### Frontend
- Tasks list
- Create task
- Status update
- Filters

📌 This is the system backbone.

---

## Phase 5 — Dashboard (PRD #2)

### Backend
- Dashboard summary endpoints
- Calendar aggregation

### Frontend
- Urgency boxes
- Calendar UI
- Task click-through

📌 Depends entirely on Tasks.

---

## Phase 6 — Notifications & Activity Feed (Core + PRD #13)

### Backend
- Notifications table
- Activity feed events
- Trigger hooks from Tasks

### Frontend
- Notification bell
- Activity sidebar (basic)

📌 Needed before chat & approvals.

---

## Phase 7 — Events (PRD #6)

### Backend
- Events CRUD
- Auto-expiry logic

### Frontend
- Events page
- Calendar integration

---

## Phase 8 — Documents (PRD #7)

### Backend
- File upload
- Storage adapter
- Document records

### Frontend
- Documents page
- Upload/download UI

---

## Phase 9 — Payments (PRD #11)

### Backend
- Payments CRUD
- Filters
- Aggregations

### Frontend
- Payments page
- Summary totals

---

## Phase 10 — Cars / Fleet (PRD #12)

### Backend
- Cars
- Maintenance
- Car incomes/expenses

### Frontend
- Cars list
- Car detail modal
- Financial forms

---

## Phase 11 — Analytics & Reports (PRD #9)

### Backend
- Aggregation endpoints
- Scope enforcement

### Frontend
- KPI cards
- Charts
- Tables

---

## Phase 12 — Profile, Presence, Chat & Approvals (PRD #13)

### Backend
- Profiles
- WebSockets
- Chat threads/messages
- Approval requests

### Frontend
- Profile page
- Presence sidebar
- Chat UI
- Approval cards

📌 Build LAST due to cross-cutting dependencies.

---

## Phase 13 — Retention Jobs & Cleanup

- Task retention (90 days)
- Event cleanup
- Call notes cleanup

---

## Phase 14 — Migration Execution (PRD #14)

### Order
1. Users
2. Companies
3. Teams
4. Tasks
5. Payments
6. Cars

Validation after each step.

---

## Phase 15 — Final Hardening

- Permission audits
- Security review
- Mobile UX pass
- Performance tuning

---

## Phase 16 — Cutover

- Freeze old system
- Run migration
- Switch frontend
- Monitor

---

## Final Rule for the Coding Agent

> **Never jump phases.**
> If a dependency is not complete, the next phase must not start.

This execution order is non-negotiable if you want a safe launch.

