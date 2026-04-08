# PRD #1 — Tasks Module (BWC Task Manager)

## TL;DR
The Tasks module is the core execution engine of BWC Task Manager. It supports creation, assignment, tracking, transfer, completion, archiving, and deletion of **single tasks only**, strictly following urgency, hierarchy, permission, notification, calendar, and retention rules defined by the business.

---

## Problem Statement
BWC operates across multiple companies and departments. Without a strict task system, ownership becomes unclear, deadlines are missed, urgency is subjective, and management lacks visibility. This module enforces clarity, accountability, and auditability.

---

## Goals

### Business Goals
- Clear task ownership
- Higher on-time completion
- Managerial visibility without micromanagement
- Auditable task history

### User Goals
- Instantly see what to do
- Understand urgency visually
- Update status easily
- Transfer low-priority work when allowed

---

## Non-Goals
- No subtasks or checklists
- No recurring tasks
- No dependencies
- No external assignments
- No bulk editing

---

## Access & Visibility Rules

### Page Permission
- none → no access
- read → view only
- full → create/edit/delete

### Visibility Scope
Users can see tasks:
- Assigned to them
- Created by them
- Assigned to users below them
- Assigned to teams they belong to

---

## Urgency & Color Logic

| Label | Color |
|------|------|
| Urgent & Important | Red |
| Urgent | Blue |
| Important | Green |
| Not Urgent & Not Important | Yellow |
| Same-day (auto) | Orange |

Rules:
- Only one label allowed
- If none selected and deadline == created date → Orange
- Otherwise task cannot be saved

---

## Status Lifecycle
Statuses:
- new
- received (auto)
- on_process
- pending
- completed
- loose_end

Every change creates notifications and history records.

---

## Create Task Flow
Fields:
- Title (required)
- Description (optional)
- Company (required)
- Assigned to (user or team)
- Department (required)
- Priority (required)
- Start Date (required)
- Deadline (required)

Multiple-user assignment forces Team creation.

---

## Ownership & Transfers
- Owner can edit everything
- Assignee can change status
- Yellow tasks only can be transferred down hierarchy

---

## Completed & Deleted Tasks
- Completed → Completed section
- Deleted → Deleted section
- Retention: 90 days
- Admin notified before permanent deletion
- Export generated (CSV)

---

## Calendar Integration
- Tasks shown by deadline
- Colored by urgency
- Click opens task

---

## Notifications
- Task created → assignee
- Status changed → owner
- Transfer → owner + new assignee

---

## Database Schema

### tasks
- id (UUID)
- title
- description
- company_id
- department
- urgency_label
- status
- owner_user_id
- start_date
- deadline_date
- completed_at
- deleted_at
- created_at
- updated_at

### task_assignees
- id
- task_id
- user_id OR team_id (one required)

### task_status_history
- id
- task_id
- old_status
- new_status
- changed_by_user_id
- changed_at

---

## API Endpoints
- POST /tasks
- GET /tasks
- GET /tasks/{id}
- PUT /tasks/{id}
- POST /tasks/{id}/status
- POST /tasks/{id}/transfer
- POST /tasks/{id}/mark-incomplete
- DELETE /tasks/{id}
- DELETE /tasks/{id}/permanent

---

## Success Metrics
- Completion rate
- Overdue count
- Avg lifecycle time

---

## Dependencies
- Users & Permissions
- Teams
- Companies
- Notifications
- Calendar

