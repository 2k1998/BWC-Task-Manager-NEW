PRD_008_Phase_8_System_Hardening.md
PHASE 8 — SYSTEM HARDENING & ADMIN AUTHORITY

Version: 1.0
Status: Locked
Type: Backend Only

1️⃣ OBJECTIVE

Transform the system into:

Enterprise-safe

Fully auditable

Strictly permissioned

Admin-controlled identity lifecycle

Backend-enforced business rules

NO new business modules.
NO UI work.
NO scope expansion.

2️⃣ SCOPE OVERVIEW

Phase 8 includes:

Activity Logging System

Strict Status Transition Enforcement

Strict Transfer Rule Enforcement

Permission Hardening Audit

Performance Index Optimization

Admin-Controlled User Lifecycle

Removal of Public Registration & Self Password Changes

3️⃣ ADMIN-CONTROLLED IDENTITY MODEL (MANDATORY)
3.1 No Public Registration

There must be:

❌ NO /auth/register

❌ NO public user creation endpoint

❌ NO open signup flow

Authentication is LOGIN ONLY.

3.2 Admin-Only User Creation
Endpoint

POST /admin/users

Access

Admin only.

Request Body
{
  "email": "user@email.com",
  "username": "username",
  "first_name": "John",
  "last_name": "Doe",
  "user_type": "Admin | Manager | Employee",
  "manager_id": "uuid | null"
}

Behavior

Backend must:

Generate secure random password (12–16 characters)

Hash password

Store hash only

Return plaintext password ONCE in response

Response
{
  "user_id": "uuid",
  "generated_password": "randomSecurePassword123"
}


Plaintext password must not be logged.

3.3 Users Cannot Change Password

Remove / disable:

Any /change-password

Any /reset-password for users

Any self-service password change logic

3.4 Admin Password Reset
Endpoint

POST /admin/users/{id}/reset-password

Access

Admin only.

Behavior

Generate new secure password

Hash and store

Return plaintext password ONCE

Response
{
  "generated_password": "newSecurePassword456"
}


No email sending required in this phase.

4️⃣ ACTIVITY LOGGING SYSTEM

Create table:

activity_logs
Field	Type
id	UUID PK
entity_type	TEXT
entity_id	UUID
action_type	TEXT
performed_by_user_id	FK users (RESTRICT)
old_value	JSONB nullable
new_value	JSONB nullable
created_at	TIMESTAMPTZ
Log Required Events
Tasks

Create

Status Change

Transfer

Metadata Update

Projects

Create

Status Change

Metadata Update

Events

Create

Update

Delete

Documents

Upload

Delete

Every mutation must create a log entry.

5️⃣ STRICT STATUS TRANSITION ENFORCEMENT

Backend must enforce lifecycle:

New → Received
Received → On Process | Pending
On Process → Pending | Completed | Loose End
Pending → On Process | Completed | Loose End
Loose End → On Process | Pending
Completed → (terminal)


Invalid transitions must return HTTP 400.

Frontend cannot override.

6️⃣ STRICT TRANSFER RULE ENFORCEMENT

Backend must validate:

urgency_label == "Not Urgent & Not Important"

New assignee is subordinate of current owner

XOR rule maintained (assigned_user_id OR assigned_team_id)

Ownership logic preserved

Invalid transfer must return HTTP 403.

7️⃣ PERMISSION HARDENING

Verify and enforce:

Only assignee / team head / admin can change status

Only owner / admin can update metadata

Only admin can create users

Only admin can reset passwords

No privilege escalation paths exist

8️⃣ PERFORMANCE INDEXING

Add indexes:

Tasks

status

urgency_label

assigned_user_id

assigned_team_id

owner_user_id

Projects

status

project_manager_user_id

owner_user_id

Events

event_datetime

Documents

uploaded_by_user_id

9️⃣ INTEGRITY RULES

All PK must be UUID

All FK must be RESTRICT

No cascade deletes

No database enums

TEXT fields validated in application layer

No silent defaults

Backend is source of truth

🔟 MIGRATION

Create migration:

008_phase8_hardening.py

Must include:

activity_logs table

all required indexes

removal of disallowed endpoints if applicable

11️⃣ ACCEPTANCE CRITERIA

Phase 8 is accepted ONLY IF:

❌ No public registration endpoint exists

❌ No self-password change endpoint exists

✅ Admin can create users

✅ Admin can reset passwords

✅ Invalid status transitions return 400

✅ Invalid transfers return 403

✅ All mutations generate activity logs

✅ Indexes created

✅ No cascade deletes

✅ All FK are RESTRICT