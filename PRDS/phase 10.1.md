PHASE 10.1 — Backend Hardening Patch
Notifications Schema & Contract Enforcement
1️⃣ Purpose

Phase 10 introduced the Notification system.

However:

notification_type is currently str without validation

read_status is currently str without validation

No strict Pydantic enforcement exists

Database layer allows arbitrary values

Silent schema drift is possible

This violates:

PRD #0 (Backend as Source of Truth)

Hardening philosophy from Phase 8

State machine rigor applied to Tasks & Projects

2️⃣ Scope

This phase:

✅ Adds strict schema validation
✅ Enforces allowed values at API layer
✅ Adds DB-level CHECK constraints
✅ Prevents silent corruption
✅ Maintains backward compatibility

This phase does NOT:

❌ Add new features
❌ Modify notification behavior
❌ Add new triggers
❌ Change UI

3️⃣ Architectural Rules (Non-Negotiable)
3.1 Backend Is Source of Truth

Frontend must not enforce allowed notification types.

Backend must reject invalid values.

3.2 No Enums at Database Level

Per PRD #0:

No PostgreSQL ENUM types allowed.

We will enforce using:

TEXT columns

CHECK constraints

Pydantic validation

3.3 Allowed Values — FINAL CONTRACT
notification_type

Allowed:

"ASSIGNMENT"

"STATUS_CHANGE"

Reserved (not allowed yet):

"MENTION"

"DEADLINE"

If backend tries to insert these → 400 error.

read_status

Allowed:

"Unread"

"Read"

Case-sensitive.

4️⃣ Schema Hardening Changes
File: backend/app/models/notification.py
Add CHECK Constraints
__table_args__ = (
    CheckConstraint(
        "notification_type IN ('ASSIGNMENT', 'STATUS_CHANGE')",
        name="ck_notification_type_valid"
    ),
    CheckConstraint(
        "read_status IN ('Unread', 'Read')",
        name="ck_notification_read_status_valid"
    ),
    Index("ix_notifications_recipient_read", "recipient_user_id", "read_status"),
    Index("ix_notifications_created_at", "created_at"),
)

5️⃣ Pydantic Validation Enforcement
File: backend/app/schemas/notification.py

Replace loose string types with:

from enum import Enum

class NotificationType(str, Enum):
    ASSIGNMENT = "ASSIGNMENT"
    STATUS_CHANGE = "STATUS_CHANGE"

class ReadStatus(str, Enum):
    Unread = "Unread"
    Read = "Read"


Then update schema:

notification_type: NotificationType
read_status: ReadStatus

6️⃣ Service Layer Enforcement
File: backend/app/utils/notification_service.py

Before insert:

if notification_type not in {"ASSIGNMENT", "STATUS_CHANGE"}:
    raise ValueError("Invalid notification_type")


Never allow silent fallback.

7️⃣ Migration Requirements

Create:

alembic/versions/010_phase10_1_notification_constraints.py


Migration must:

Add CHECK constraints

Validate existing rows before applying

Fail migration if invalid data exists

Validation step example:

SELECT DISTINCT notification_type FROM notifications;


If any unexpected values exist → STOP.

8️⃣ Backward Compatibility Handling

If database already contains:

"MENTION"

"DEADLINE"

Migration must:

Option A (Preferred):

Convert them to STATUS_CHANGE

Option B:

Abort migration and require manual cleanup

9️⃣ API Contract Freeze

After Phase 10.1:

These values are frozen:

{
  "notification_type": "ASSIGNMENT" | "STATUS_CHANGE",
  "read_status": "Unread" | "Read"
}


No new values allowed without new PRD.

🔟 Testing Requirements

Manual Tests:

Attempt to insert invalid notification_type → 400

Attempt to update read_status to invalid → 400

Verify CHECK constraint blocks direct SQL corruption

Verify existing notifications still load

1️⃣1️⃣ Security Impact

This prevents:

Silent schema drift

Accidental typos

Corrupted notification history

Frontend mismatch

Data analytics inconsistency

1️⃣2️⃣ Phase Completion Criteria

Phase 10.1 is complete when:

CHECK constraints exist in Postgres

Pydantic Enums validate API

No invalid values possible

Migration verified

All tests pass

1️⃣3️⃣ What Happens After This?

Then:

👉 UI Phase 8 can be implemented safely
👉 Frontend can rely on strict contract
👉 Polling system becomes stable
👉 Notification icons can be deterministic