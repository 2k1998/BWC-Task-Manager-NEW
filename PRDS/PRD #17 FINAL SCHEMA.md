# PRD #17 — Schema Freeze & Final Review (BWC Task Manager)

## Purpose
This document defines the **final schema freeze** before coding begins. After this point, schema changes are NOT allowed unless a blocking error is discovered.

---

## Why Schema Freeze Is Mandatory

Without a freeze:
- Migration breaks
- Frontend/backend drift
- AI agent re‑writes tables

This freeze protects correctness.

---

## Tables (FINAL)

### Core
- users
- auth_refresh_tokens
- pages
- user_page_permissions
- user_audit_logs
- notifications
- activity_feed_events
- files

---

### Tasks
- tasks
- task_assignees
- task_status_history

---

### Teams
- teams
- team_members

---

### Companies
- companies

---

### Contacts
- contacts
- daily_calls
- call_notes_files

---

### Events
- events

---

### Documents
- documents

---

### Payments
- payments

---

### Cars
- cars
- car_maintenance
- car_incomes
- car_expenses

---

### Chat & Approvals
- user_profiles
- chat_threads
- chat_messages
- approval_requests

---

## Enum Freeze

No new enum values allowed for:
- task.status
- task.urgency
- payment.payment_type
- user.user_type
- car.status
- approval.status

---

## Relationship Freeze

- users.id referenced everywhere
- companies.id referenced everywhere
- No cascading deletes
- All FK deletes = RESTRICT

---

## Allowed Changes After Freeze

ONLY:
- Index additions
- Query optimization
- Non‑breaking defaults

NOT allowed:
- Column rename
- Column delete
- Enum change

---

## Pre‑Coding Checklist

Admin must confirm:
- All PRDs approved
- All tables listed above exist
- Migration PRD approved
- Execution order approved

---

## Final Rule

>Once coding starts, the schema is **locked**.

