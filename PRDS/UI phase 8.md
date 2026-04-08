UI Phase 8 PRD — Notifications UI (Strict)
TL;DR

Add a production-grade in-app notifications UI to the existing Next.js app:

Header bell with unread badge

Dropdown preview (latest notifications)

Notifications page with pagination + filters

Mark-read actions

Polling-based refresh (no WebSockets)

Goals
Business Goals

Reduce “silent failure” in task/project workflows

Increase response speed to assignments + status changes

Make the system feel alive and operational

User Goals

Know when I’m assigned something

Know when something I own changes

Easily review what changed recently

Clear my notification state (read/unread)

Non-Goals

No WebSockets / realtime streams

No email / SMS / push

No user preferences

No admin global notification feed

No notifications generated in UI

No redesign of existing pages beyond adding notification UI surfaces

Authoritative PRD References (Must Follow)

Backend Phase 10 PRD (Notifications System): schema + endpoints + trigger semantics

PRD #0 / System Rules: backend is source of truth, no implicit defaults

UI Phase 3 Design System: typography, spacing, colors frozen (#D1AE62), sidebar rules

UI Phase 6 AuthContext Hardening: user identity comes from /auth/me, not localStorage user objects

Backend Phase 8 Hardening: no signup; admin-only user management (relevant only for UI behavior)

UX Surfaces
1) Header Notification Bell (Global)

Location: Header right side (next to user/profile/logout)

Elements

Bell icon

Unread badge:

Hidden when unread_count = 0

Display “99+” cap when >99

Badge color: semantic danger red (small, minimal)

Behavior

Clicking bell opens dropdown

Bell click also triggers a refresh fetch

2) Notification Dropdown (Preview Panel)

Contents

Latest 10 notifications (most recent first)

Each row shows:

Title (single line)

Message (max 2 lines, truncation)

Timestamp (“2m ago”, “3h ago”, “Yesterday”)

Unread indicator (small dot or left gold border)

Actions

Clicking a notification:

Marks it read (API call)

Navigates to notification.link

“View all” link navigates to /notifications

Empty state: “You’re all caught up.”

Constraints

No infinite scroll here

No complex grouping

No client-side mutation beyond reflecting API response

3) Notifications Page /notifications

Primary content

Full list (paginated)

Filter toggle:

All

Unread only

Pagination controls:

Next/Prev or numbered (simple is fine)

Row actions:

“Mark as read” per item

“Mark all as read” at top

Row click behavior

Same as dropdown: mark read then navigate

Empty states

All empty: “No notifications yet.”

Unread filter empty: “No unread notifications.”

Polling Architecture Rules (Strict)
Endpoints

GET /notifications/unread-count is polled

GET /notifications?limit=10 is fetched:

on bell open

on notifications page load

after mark-read / mark-all-read

Poll Interval

Default: 30 seconds

Pause polling when:

tab is not visible (document.visibilityState !== "visible")

user is logged out

Resume on visibility regain

Network Rules

Never poll the full list every 30 seconds

Poll unread-count only

Use AbortController or axios cancel token to prevent overlapping requests

Error Handling

If unread-count fails:

do not spam toasts every 30s

show silent fallback (badge frozen)

log only once per session (optional)

UI Interaction Constraints (Strict)
Authority & Identity

Must use AuthContext to determine authenticated state

Must not read user object from localStorage

Tokens can remain in localStorage (as you already do)

Data Rules

No mock notifications

No client-generated notifications

UI renders only what API returns

Mark-as-read Rules

Must wait for API success before updating unread badge

No optimistic update unless the agent implements rollback on failure (avoid)

Navigation Rules

Notification rows use notification.link as source of truth

If link 404s (entity deleted), UI shows an error state on the destination page; notification remains

Styling Rules

Must follow Phase 3 Design System:

Gold is frozen: #D1AE62

No full background urgency colors

Use left border + subtle badge for unread

15px body font

No new design language introduced in this phase

Acceptance Criteria

✅ Bell appears on all authenticated pages
✅ Unread badge updates within 30 seconds
✅ Dropdown shows latest 10 with correct read/unread styling
✅ Clicking notification marks read and navigates
✅ /notifications page supports unread filter + pagination
✅ Mark all read works
✅ Poll pauses when tab hidden
✅ No backend changes required
✅ No console logs containing sensitive data