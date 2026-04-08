# PRD #8 — Users & Permissions Module (BWC Task Manager)

## TL;DR
This module gives Admins full control over users, hierarchy, and page-level permissions. Permissions are explicit per page and override user-type defaults. All actions are audited.

---

## Problem Statement
Without strict user and permission control, sensitive data is exposed and hierarchy-based workflows break. This module centralizes authority and enforces clarity.

---

## Goals

### Business Goals
- Protect sensitive data
- Enable scalable management
- Enforce hierarchy rules

### User Goals
- Clear understanding of accessible pages
- Predictable behavior across the app

---

## Non-Goals
- No self-service permissions
- No implicit role inheritance
- No SSO at launch

---

## Access Rules
- Admin only
- No read-only access for non-admins

---

## UX
- Users table (name, email, username, type, status)
- User detail panel for editing

---

## Create User
Fields:
- First name
- Last name
- Email (unique)
- Username (unique)
- Temporary password (auto)
- User type
- Manager (optional)

On save:
- Email credentials sent
- Force password change on first login

---

## Edit User
Admin can edit:
- Identity fields
- User type
- Manager (hierarchy)
- Active status
- Page permissions

---

## User Types (Semantic)
- Agent
- Head
- Manager
- Pillar
- Admin

User type does NOT grant permissions automatically.

---

## Page Permissions
For each page:
- No
- Read only
- Full

Stored explicitly.

---

## Hierarchy Rules
- One manager per user
- Unlimited subordinates
- Drives task visibility and analytics

---

## Deactivate User
- Prevents login
- Keeps historical references intact

---

## Audit Logs
Every admin action logged with before/after state.

---

## Database Schema

### user_page_permissions
- id
- user_id
- page_id
- access

### user_audit_logs
- id
- admin_user_id
- target_user_id
- action
- before_json
- after_json
- created_at

---

## API Endpoints
- POST /admin/users
- GET /admin/users
- GET /admin/users/{id}
- PUT /admin/users/{id}
- POST /admin/users/{id}/permissions
- POST /admin/users/{id}/deactivate

---

## Dependencies
- Auth
- Pages seed
- Email notifications
- Audit logging

