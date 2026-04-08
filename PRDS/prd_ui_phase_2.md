# UI PHASE 2 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Product:** BWC Task Manager  
**Phase:** UI Phase 2 — UX Depth & Product Maturity  
**Status:** Exported & Frozen  
**Depends On:** UI Phase 1 (Completed)

---

## 1. TL;DR
UI Phase 2 transforms the existing frontend from *functional* to *professional*.

This phase deepens user experience, clarity, and confidence **without introducing new modules or backend changes**.

---

## 2. Problem Statement
UI Phase 1 validated system correctness and API integration. However:

- The dashboard is informational, not operational
- Tasks allow user confusion (too many visible actions, unclear permissions)
- Permission errors rely on backend responses instead of UX clarity
- The interface lacks the maturity expected for daily internal usage

---

## 3. Goals

### 3.1 Business Goals
- Increase daily active usage
- Reduce user mistakes
- Reduce support questions
- Increase perceived system quality and trust

### 3.2 User Goals
- Instantly understand what matters today
- Clearly know what actions are allowed
- Move faster with fewer clicks
- Feel confident using the system daily

### 3.3 Non‑Goals
- No new backend endpoints
- No new modules (Cars, Payments, Analytics, Chat)
- No authentication model changes
- No visual rebranding

---

## 4. Scope Overview

### Included
- Dashboard UX deepening
- Tasks UX refinement
- Projects UX refinement
- Permission & error handling UX
- Global UI infrastructure
- Mobile responsiveness polish

### Excluded
- New pages or routes
- Backend changes
- Data model changes

---

## 5. Dashboard — Command Center

### 5.1 Task Overview by Urgency
Display active tasks grouped by urgency:

- Red — Urgent & Important
- Blue — Urgent
- Green — Important
- Yellow — Not Urgent & Not Important
- Orange — Same‑day

Rules:
- Source: GET /tasks
- Exclude completed tasks
- Click navigates to task detail
- Responsive layout

---

### 5.2 Due Today & Overdue
Two explicit sections:

- Due Today
- Overdue

Rules:
- Based on deadline
- Overdue visually emphasized

---

### 5.3 Upcoming Events
- Next 5 events
- Sorted by event_datetime
- Read‑only
- Click navigates to Events page

---

### 5.4 Mini Calendar (Read‑only)
- Monthly view
- Shows task deadlines and events
- Navigation only (no edits)

---

## 6. Tasks — UX Deepening

### 6.1 Status Transitions
- UI shows **only valid next statuses**
- Current status disabled
- Backend remains source of truth

---

### 6.2 Ownership & Assignment Clarity
Each task clearly displays:
- Owner (creator)
- Assignment (User or Team)
- Current user role (Owner / Assignee / Viewer)

---

### 6.3 Transfer Task Flow
- Replace dropdown with modal
- Explain rules (Yellow only, subordinates only)
- Disabled state with tooltip if not allowed

---

### 6.4 Completed Tasks
- Separate read‑only section
- Clear explanation why editing is disabled

---

## 7. Projects — UX Refinement

### 7.1 Status Visualization
- Colored status badge
- Simple timeline header

---

### 7.2 Role Clarity
Clearly show:
- Project Owner
- Project Manager
- Allowed actions for current user

Forbidden actions are hidden, not error‑triggered.

---

## 8. Permissions & Error States

### 8.1 Permission Denied UX
- Friendly inline explanations
- Explicit reason (role‑based)

---

### 8.2 Empty States
All lists include:
- Friendly empty message
- Contextual guidance

---

## 9. Global UI Infrastructure

### 9.1 Loading Skeletons
Replace spinners with skeleton loaders for:
- Dashboard widgets
- Task lists
- Project lists

---

### 9.2 Toast Notifications
Global toasts for:
- Success
- Validation errors
- Permission errors
- Network failures

---

### 9.3 Error Boundary
- Global error boundary
- Prevents white screens
- Fallback UI with recovery option

---

## 10. Mobile & Responsiveness

- Sidebar collapses or slides on mobile
- Dashboard cards stack vertically
- Task detail usable on mobile

---

## 11. Success Metrics
- Fewer backend 403s caused by UI actions
- Faster task completion
- Positive internal user feedback

---

## 12. Acceptance Criteria
UI Phase 2 is complete when:
- Dashboard provides real operational value
- Tasks are hard to misuse
- Permission boundaries are obvious
- UI feels stable, intentional, and professional
- No new modules added

---

## 13. Status
**UI Phase 2 PRD — ACCEPTED & FROZEN**

