# PRD #14 — Data Migration & Cutover Plan (BWC Task Manager)

## TL;DR
This PRD defines exactly **what data must be migrated**, **what must not**, and **how** to safely move existing production data into the rebuilt BWC Task Manager without loss, duplication, or corruption.

Migration is **data-only**. No legacy code is reused.

---

## Why Migration Exists (Context)
The system is a total rebuild, but:
- The app is live
- Real users exist
- Companies already exist
- Operational data has business value

Therefore, data must be translated into the new schema.

---

## Migration Principles (Hard Rules)

1. No data loss
2. No ID changes where references exist
3. No destructive operations on source DB
4. Migration must be repeatable (idempotent)
5. Validation after every phase

---

## What MUST Be Migrated (Explicit)

### 1. Users
Reason: Existing accounts must continue to work.

Fields to migrate:
- id (preserve UUID)
- email
- username
- first_name
- last_name
- birthday (if exists)
- profile photo (if exists)
- is_active

Derived / new fields:
- user_type (mapped)
- manager_id (mapped if hierarchy exists)

---

### 2. Admin User(s)
Reason: System access continuity.

Rules:
- Admin UUID must remain unchanged
- Password reset required post-migration

---

### 3. Companies
Reason: Referenced everywhere.

Rules:
- IDs must not change
- Names must not change
- Hard-coded + DB companies must merge cleanly

Fields:
- id
- name
- vat_number
- occupation
- creation_date
- description

---

### 4. Tasks
Reason: Operational history and accountability.

Fields:
- id
- title
- description
- company_id
- department
- urgency
- status
- owner
- assignee(s)
- start_date
- deadline
- timestamps

Rules:
- Status history preserved where possible
- Completed/deleted flags mapped correctly

---

### 5. Teams
Reason: Task assignment integrity.

Fields:
- id
- name
- head
- members

---

### 6. Payments
Reason: Financial traceability.

Fields:
- id
- title
- amount
- currency
- type
- date
- company
- employee

---

### 7. Cars & Fleet Data
Reason: Asset tracking.

Fields:
- cars
- maintenance dates
- car incomes
- car expenses

---

## What MUST NOT Be Migrated

- Notifications
- Activity feed events
- WebSocket presence data
- Sessions / tokens
- Temporary files

These are ephemeral and regenerated.

---

## Field Mapping Strategy

- One mapping file per table
- Explicit old_field → new_field mapping
- No implicit assumptions

---

## Migration Phases

### Phase 1 — Read-Only Snapshot
- Freeze writes (maintenance window)
- Export source data

---

### Phase 2 — Transform
- Normalize values
- Map enums
- Validate foreign keys

---

### Phase 3 — Load
- Insert into new DB
- Preserve IDs
- Disable triggers during load

---

### Phase 4 — Validate

Checks:
- Record counts match
- Foreign keys valid
- Spot-check critical users/tasks

---

### Phase 5 — Cutover
- Point frontend to new backend
- Enable writes
- Monitor errors

---

## Rollback Plan

If validation fails:
- Do not cut over
- Fix scripts
- Re-run migration

Old system remains untouched.

---

## Tooling

- Python migration scripts
- SQLAlchemy Core
- CSV/JSON exports for backup

---

## Success Criteria

- All users can log in
- All companies appear correctly
- Tasks retain ownership and deadlines
- No orphaned records

---

## Deliverables

- Migration scripts repo
- Mapping documentation
- Validation checklist

---

## Final Note
Migration is a **one-time business-critical operation**. It must be boring, explicit, and verified.

