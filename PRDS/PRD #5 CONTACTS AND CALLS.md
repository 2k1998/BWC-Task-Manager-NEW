# PRD #5 — Contacts & Daily Calls Module (BWC Task Manager)

## TL;DR
The Contacts module allows each user to manage a strictly private contact list. Contacts can be optionally added to Daily Calls, enabling scheduled reminders and short-lived call notes stored as downloadable documents.

---

## Problem Statement
Users frequently communicate with external contacts. Without structure, follow-ups are missed and information is lost. This module provides lightweight, private contact and call reminder management without becoming a full CRM.

---

## Goals

### Business Goals
- Improve consistency of follow-ups
- Reduce missed calls
- Keep contact management lightweight

### User Goals
- Store contacts easily
- Schedule frequent call reminders
- Save short call notes temporarily

---

## Non-Goals
- No shared contacts
- No hierarchy access
- No analytics or reporting

---

## Access Rules
- Available to every user
- Users can ONLY see their own contacts
- Admin has no override access

---

## Contacts Page
Sections:
- All Contacts
- Daily Calls

---

## Create Contact

Manual Entry (Google Contacts–like):
- First Name (required)
- Last Name (required)
- Phone (required)
- Email (optional)
- Company Name (optional)
- Notes (optional)

---

## CSV Import
- User warned about Greek encoding
- Must explicitly confirm

---

## Contact Actions
- Edit
- Delete
- Add to Daily Calls

---

## Daily Calls

### Scheduling
- User sets next call date/time
- Popup reminders:
  - 30 minutes before
  - 5 minutes before

### After Call
- User must set next call
- User must add call description
- Notes saved as .doc
- Files deleted after 7 days

---

## Database Schema

### contacts
- id
- user_id
- first_name
- last_name
- phone
- email
- company_name
- notes
- created_at
- updated_at

### daily_calls
- id
- contact_id
- user_id
- next_call_at
- created_at
- updated_at

### call_notes_files
- id
- daily_call_id
- file_id
- expires_at
- created_at

---

## API Endpoints

### Contacts
- POST /contacts
- GET /contacts
- GET /contacts/{id}
- PUT /contacts/{id}
- DELETE /contacts/{id}
- POST /contacts/import-csv

### Daily Calls
- POST /daily-calls
- PUT /daily-calls/{id}
- DELETE /daily-calls/{id}

---

## Retention
- Call notes auto-deleted after 7 days

---

## Dependencies
- Users
- Files
- Popup notification system

