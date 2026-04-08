# PRD #3 — Teams (Groups) Module (BWC Task Manager)

## TL;DR
The Teams module enables authorized users to create and manage groups of users for task assignment and execution. Each team has exactly one Head and one or more members. Teams are first-class assignment targets for tasks.

---

## Problem Statement
Work is often executed by groups rather than individuals. Teams provide a structured way to assign tasks, manage responsibility, and give managers visibility into group execution without duplication or confusion.

---

## Goals

### Business Goals
- Enable scalable delegation
- Reduce task assignment friction
- Support hierarchical accountability

### User Goals
- Belong to clear teams
- See tasks assigned to my team
- Allow Heads to manage execution

---

## Non-Goals
- No nested teams
- No cross-team permissions
- No team chat at launch
- No external members

---

## Access Rules

### Page Permission
- none → page hidden
- read → view only
- full → create/edit/delete

### Visibility
- Users see only teams they belong to
- Team Head sees all members and team tasks
- Admin sees all teams

---

## Team Structure
- One Head per team
- One or more members
- Head gains Head capabilities automatically

---

## Create Team Flow

Fields:
- Team Name (unique, required)
- Team Head (single user)
- Team Members (multi-select)

Triggered from Teams page or forced from Tasks when multiple assignees are selected.

---

## Edit / Delete Rules
- Editable by Head, Creator, or Admin
- Cannot delete if active tasks exist

---

## Team Detail View
- Team info
- Members list
- Active team tasks
- "Create Task for Team" button (Head/Admin)

---

## Tasks Integration
- Task can be assigned to one team
- Visible to all members
- Status updated by any member

---

## Notifications
- Member added/removed
- Head changed
- Task assigned to team

---

## Database Schema

### teams
- id
- name (unique)
- head_user_id
- created_by_user_id
- created_at
- updated_at
- deleted_at

### team_members
- id
- team_id
- user_id
- role (head/member)

---

## API Endpoints
- POST /teams
- GET /teams
- GET /teams/{id}
- PUT /teams/{id}
- DELETE /teams/{id}

---

## Success Metrics
- Tasks assigned to teams
- Team task completion rate

---

## Dependencies
- Users & Permissions
- Tasks Module
- Notifications

