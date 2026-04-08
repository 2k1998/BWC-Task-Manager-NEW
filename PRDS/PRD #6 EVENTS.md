# PRD #6 — Events Module (BWC Task Manager)

## TL;DR
The Events module allows authorized users to create and manage company-wide events. All users are notified immediately. Events appear on the dashboard calendar and are automatically cleaned up after completion.

---

## Problem Statement
Important company events need a single authoritative source. Without this, users miss meetings and deadlines. This module ensures visibility, notification, and automatic lifecycle management.

---

## Goals

### Business Goals
- Improve company-wide awareness of events
- Reduce missed meetings
- Keep event data short-lived and clean

### User Goals
- See upcoming events clearly
- Get notified immediately
- View events alongside tasks

---

## Non-Goals
- No personal events
- No recurring events
- No RSVP system

---

## Access Rules
- none → page hidden
- read → view events
- full → create/edit/delete events

---

## Events Page
- List of active events
- Completed events section
- Create New Event button (if permitted)

---

## Create Event
Fields:
- Event Title (required)
- Location (required)
- Event Date & Time (required)
- Description (optional)

On save:
- Event created
- All users notified
- Event appears on calendar

---

## Edit / Delete
- Creator or Admin only
- Editing or deleting notifies all users

---

## Lifecycle
- Active until event end time
- Moves to Completed
- Permanently deleted after 3 days

---

## Database Schema

### events
- id
- title
- location
- description
- event_start_at
- created_by_user_id
- created_at
- updated_at
- deleted_at

---

## API Endpoints
- POST /events
- GET /events
- GET /events/{id}
- PUT /events/{id}
- DELETE /events/{id}

---

## Dependencies
- Users
- Notifications
- Dashboard Calendar

