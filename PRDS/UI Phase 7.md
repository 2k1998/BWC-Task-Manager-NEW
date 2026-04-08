📘 UI PHASE 7 PRD
Audit Surfaces & Operational Transparency
1️⃣ Overview

Goal:
Expose the Phase 8 backend Activity Logging system in the UI.

This phase makes the system transparent, traceable, and enterprise-grade.

We are NOT adding new backend logic.
We are NOT modifying logging behavior.
We are building UI surfaces on top of existing activity_logs.

2️⃣ Authoritative References

UI Phase 7 MUST comply with:

PRD #0 — System Rules

UUID primary keys

UTC timestamps

No client authority over ownership

Backend is source of truth

PRD #1 — Tasks

Strict status lifecycle

Transfer rules

Ownership logic

PRD #2 — Projects

Owner / Manager separation

Status transitions

PRD #6 — Events

Public visibility

Hard delete logic

PRD #7 — Documents

Admin-only delete

Public visibility

PRD #8 — System Hardening

activity_logs table

old_value / new_value JSONB

performed_by_user_id

action_type

entity_type

entity_id

3️⃣ Scope
✅ INCLUDED

Global Activity Log (Admin-only page)

Entity History Timeline (Task, Project, Event, Document)

Structured diff rendering (old → new)

Clean timeline UI consistent with Phase 3 Design System

Pagination support

❌ EXCLUDED

No log editing

No log deletion

No log filtering by arbitrary fields (only supported backend filters)

No export functionality

No analytics dashboard

No backend changes

No real-time websockets

4️⃣ Feature Breakdown
A. Admin Global Activity Log
Route
/admin/activity

Access

Admin only (use AdminRoute)

API

GET /admin/activity-logs

Columns

Timestamp

Entity Type (Task / Project / Event / Document)

Entity ID (clickable)

Action Type (create, update, status_change, transfer, delete)

Performed By (User name)

UX Rules

Paginated (default 20 per page)

Sorted by newest first

No full JSON blobs shown in table

Clicking row → opens detail modal

B. Entity History Timeline
Location

Task Detail Page

Project Detail Page

Event Detail Page

Document Detail (if exists)

Placement

Below main content, separated by border.

Title
Activity History

Timeline Structure

Each entry:

●  Status Changed
   By: John Smith
   12 Oct 2026, 14:32
   From: "New"
   To:   "Received"


For metadata updates:

●  Metadata Updated
   Fields Changed:
   - deadline: 2023-10-27 → 2023-10-30
   - priority: Medium → High


For delete:

●  Deleted
   Full snapshot archived

5️⃣ Rendering Rules
Strict Diff Logic

Compare old_value and new_value

Only show changed fields

Never render password or sensitive fields

JSON must be prettified, not raw

6️⃣ Visual Rules (Phase 3 Compliance)

No heavy colors

Left border indicator only

Neutral surfaces

15px body text

Timestamp in small gray text

Subtle vertical timeline connector line

No shadows

7️⃣ Pagination Rules

Page size: 20

No infinite scroll

Page numbers or Next/Prev buttons only

8️⃣ Security Rules

Admin-only access for global logs

Entity timeline respects existing visibility rules

You cannot see logs for a Task you cannot see

No log mutation endpoints

No localStorage trust

🧱 Strict Implementation Rules

NO backend modifications.

NO hardcoded mock data.

NO client-side log simulation.

Use existing /admin/activity-logs.

Use existing entity detail APIs.

Respect AdminRoute architecture from Phase 6.

Use AuthContext for identity.

Follow Phase 3 design system components only.

Do not introduce new design tokens.

Do not introduce new state libraries.

🧠 UX Philosophy

This is not a “debug log”.

It is a:

Human-readable operational history.