Phase 10 — System Notifications & Event Messaging
1. Objective

Introduce a structured, auditable, real-time notification system that:

Informs users when relevant actions occur

Respects visibility & hierarchy rules

Does NOT replace activity logs

Does NOT introduce email/SMS (in-app only)

Is strictly event-driven from backend

This is an internal product feature, not a marketing system.

2. Architectural Principles
2.1 Separation of Concerns

Activity Logs → Audit history (PRD #8/#17)

Notifications → User-facing alerts

They are NOT interchangeable.

Notifications must be created explicitly by business events.

2.2 Source of Truth

Notifications MUST:

Be generated only in backend

Never be created client-side

Be derived from strict business rules

Be persisted in DB

2.3 Visibility Rules

A notification is visible ONLY to:

The specific recipient_user_id

OR Admin (optional read-only oversight)

No broadcast notifications.

3. Notification Event Triggers

Notifications are created ONLY for the following events:

3.1 Task Events
Event	Recipient
Task assigned to user	assigned_user_id
Task assigned to team	team head only
Task status changed	task owner
Task transferred	new assignee
Task marked Completed	task owner
Task set to Loose End	task owner
3.2 Project Events
Event	Recipient
Project created	project_manager_user_id
Project status changed	project owner
Project manager changed	new manager
3.3 Event (Calendar) Events
Event	Recipient
Event created	All Admin users
Event updated	All Admin users
Event deleted	All Admin users
3.4 Documents
Event	Recipient
Document uploaded	Admin only
Document deleted	Admin only
4. Database Schema
4.1 Table: notifications
id UUID PRIMARY KEY
recipient_user_id UUID NOT NULL (FK users, RESTRICT)
entity_type TEXT NOT NULL
entity_id UUID NOT NULL
event_type TEXT NOT NULL
title TEXT NOT NULL
message TEXT NOT NULL
is_read BOOLEAN DEFAULT FALSE
created_at TIMESTAMPTZ DEFAULT NOW()

4.2 Indexes

recipient_user_id (indexed)

is_read (indexed)

created_at (indexed)

4.3 No Soft Delete

Notifications are never deleted automatically.
Future archival logic is out of scope.

5. Backend Requirements
5.1 New Model

backend/app/models/notification.py

5.2 Migration

009_phase10_notifications.py

5.3 Utility

notification_service.py

Single function:

create_notification(
    recipient_user_id: UUID,
    entity_type: str,
    entity_id: UUID,
    event_type: str,
    title: str,
    message: str
)


Must:

Validate user exists

Prevent duplicate identical notifications within 1 second

Never crash main transaction

5.4 API Endpoints
GET /notifications

Returns paginated list for current user only.

Supports:

unread_only=true

page

page_size (max 100)

PATCH /notifications/{id}/read

Marks single notification as read.
Must verify ownership.

PATCH /notifications/read-all

Marks all notifications as read for current user.

6. UI Requirements (Phase 10 UI)
6.1 Notification Bell

Located in Header (right side).

Shows:

🔔 icon

Unread count badge (red circle)

Count capped at 99+

6.2 Dropdown Panel

On click:

Shows latest 10 notifications

Scrollable

Click navigates to entity page

Shows:

Title

Message

Time ago

Unread indicator dot

6.3 Notifications Page

/notifications

Full paginated list:

Filter: All / Unread

Mark as Read button

Mark All as Read

Clickable rows

Empty state design required

6.4 Strict UI Rules

No polling every 1s

Use 30s refresh interval OR manual refresh

No animations beyond design system

Use existing Badge component

No new color system

No full background colors

7. Security Rules

Users only see their own notifications.

Admin does NOT automatically see all notifications.

No user can mark another user's notification as read.

entity_type must match existing models only:

Task

Project

Event

Document

8. Non-Goals

❌ No WebSockets
❌ No push notifications
❌ No email
❌ No SMS
❌ No notification preferences
❌ No user-configurable triggers

9. Success Criteria

Creating a Task → assigned user receives notification

Changing status → owner receives notification

Creating Event → Admin receives notification

UI bell updates count

Mark read works

Activity logs unaffected