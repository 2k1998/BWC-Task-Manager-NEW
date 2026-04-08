# PRD #10 — Admin Panel Module (BWC Task Manager)

## TL;DR
The Admin Panel is the system control tower. It allows Admin users to manage users, departments, and high-level system configuration without developer involvement.

---

## Problem Statement
Without a centralized admin area, configuration becomes hard-coded and fragile. This module enables safe, auditable system control.

---

## Goals

### Business Goals
- Centralize system control
- Reduce dependency on developers
- Enable safe configuration changes

### Admin Goals
- Create and manage users
- Configure departments
- Monitor system state

---

## Non-Goals
- Analytics
- Financial operations
- Task/project management

---

## Access Rules
- Admin only
- No read-only mode

---

## UX Sections
- Users (shortcut)
- Departments
- System Overview
- System Settings (future)

---

## System Overview
Read-only KPIs:
- Total users
- Active users
- Total tasks
- Overdue tasks
- Total companies

---

## Departments Management

### Create Department
- Name (unique)

### Edit Department
- Name only

### Delete Department
- Blocked if referenced

---

## Database Schema

### departments
- id
- name (unique)
- created_at

---

## API Endpoints
- GET /admin/overview
- POST /admin/departments
- GET /admin/departments
- PUT /admin/departments/{id}
- DELETE /admin/departments/{id}

---

## Audit Rules
- All admin actions logged

---

## Dependencies
- Users & Permissions
- Audit logging
