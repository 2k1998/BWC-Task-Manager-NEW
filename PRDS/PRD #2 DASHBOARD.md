# PRD #2 — Dashboard Module (BWC Task Manager)

## TL;DR
The Dashboard is the daily command center for every user. It visually surfaces tasks by urgency, deadlines, a unified calendar, birthdays, and notifications. It is consumption-first and read-only for most entities.

---

## Problem Statement
Users need a single place that answers: “What do I need to do today, and how urgent is it?” The Dashboard removes cognitive load and makes priorities visually obvious.

---

## Goals

### Business Goals
- Increase daily engagement
- Reduce overdue tasks
- Improve deadline awareness

### User Goals
- Instantly see tasks by urgency
- View deadlines visually
- See tasks, events, and birthdays in one calendar

---

## Non-Goals
- Creating or editing tasks
- Editing events
- Advanced analytics

---

## Access Rules
- Available to every authenticated user
- Content scoped to the user, their teams, and hierarchy

---

## Layout

### Top Section
- Welcome message: "Welcome back, {First Name}"
- Today’s date indicator

---

## Task Overview (Urgency Boxes)

Five boxes always visible:
1. Red – Urgent & Important
2. Blue – Urgent
3. Green – Important
4. Yellow – Not Urgent & Not Important
5. Orange – Same-Day (auto)

Each box shows:
- Task title
- Deadline
- Status indicator

Clicking a task opens task detail (read-only here) and marks status as `received` if first opened.

Empty state: “No tasks here 🎉”

---

## Orange Box Rules
- Appears only when created date == deadline AND no urgency selected
- Removed if urgency later set

---

## Calendar

### Displays
- Task deadlines (colored by urgency)
- Events
- Colleagues’ birthdays

Clicking an item opens the related entity.

---

## Google Calendar Sync
- One-way sync (BWC → Google)
- Tasks, events, birthdays
- Read-only entries in Google Calendar

---

## Birthdays
- Source: users.birthday
- All-day yearly recurring events

---

## Notifications
- Notification bell visible
- Real-time updates via WebSocket
- Deep-link to entity

---

## Backend APIs
- GET /dashboard/summary
- GET /dashboard/calendar

---

## Performance
- Initial load under 1s
- Calendar lazy-loaded

---

## Success Metrics
- Daily active users
- Tasks opened from dashboard
- Overdue task reduction

---

## Dependencies
- Tasks Module
- Events Module
- Profile Module
- Notifications

---

## Milestones
- XX weeks: urgency boxes
- XX weeks: calendar
- XX weeks: Google sync
- XX weeks: mobile polish

