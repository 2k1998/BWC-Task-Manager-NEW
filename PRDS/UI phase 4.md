# UI Phase 4 — Product Experience & Interaction Model (PXS)
**Status:** FROZEN / AUTHORITATIVE  
**Type:** Product Experience Spec (interaction + IA, not backend)  
**Depends On:** UI Phase 1–3 + existing backend APIs (NO backend changes)  
**Out of Scope:** New pages, new features, backend changes, schema changes, visual redesign

---

## 1. Purpose
UI Phase 4 defines **how the product behaves** and how users work day-to-day.
This phase eliminates the remaining “CRUD/admin panel” feeling by enforcing:
- Clear mental models
- Action-first workflows
- Interaction hierarchy
- Progressive disclosure

**Success:** Users always know what matters and what to do next.

---

## 2. Core Product Philosophy

### 2.1 Primary Mental Model
**Tasks are the primary object.** Everything else supports tasks.

- Tasks = work
- Projects = context containers
- Documents = reference utility
- Events = time anchors
- Dashboard = action surface

### 2.2 Interaction Principles
- Default to **doing**, not browsing
- Use **boards** where state matters
- Reduce visible actions to what matters **now**
- Secondary info is hidden by default (progressive disclosure)
- One dominant interaction per screen

---

## 3. Global Experience Rules

### 3.1 Default Views
| Area | Default Experience |
|---|---|
| Tasks | **Board view (mandatory default)** |
| Projects | Contextual detail view |
| Dashboard | Action-first workspace |
| Documents | Utility list |
| Events | Chronological timeline |

### 3.2 Progressive Disclosure
**Show by default**
- Title
- Status / urgency
- Due / date

**Hide by default**
- IDs
- secondary timestamps
- low-frequency metadata

Reveal via hover, expand, secondary panels.

### 3.3 Action Visibility
- Show only actions user can do **right now**
- Forbidden actions: hide (preferred) or disable with explanation
- Never rely on backend errors to “explain” UX

---

## 4. Dashboard Experience Specification

### 4.1 Dashboard Job Statement
**“What requires my attention today or soon?”**

### 4.2 Dashboard Structure (fixed)
1) **Active Tasks by Urgency**
- Group by urgency_label (from backend)
- Order: Red → Orange → Blue → Green → Yellow

2) **Time-sensitive**
- Due Today
- Overdue
- Upcoming (next 7 days)

3) **Context Awareness**
- Upcoming events (next 5, read-only)
- Mini calendar (navigation only)

**Non-goals:** No charts, no totals, no analytics.

---

## 5. Tasks Experience (Core)

### 5.1 Default Tasks View: Board-first
Board columns map 1:1 to Task statuses. Fixed order:
1. New
2. Received
3. On Process
4. Pending
5. Loose End
6. Completed (collapsed by default)

### 5.2 Task Cards (strict)
Cards show ONLY:
- Title
- Urgency badge
- Due date (if any)

No description, no owner, no company, no metadata clutter.
Cards must be scannable in < 1 second.

### 5.3 Status Transitions
UI must show ONLY valid next statuses (client-side guardrails), backend validates final.

Allowed transitions:
- New → Received
- Received → On Process | Pending
- On Process → Pending | Completed | Loose End
- Pending → On Process | Completed | Loose End
- Loose End → On Process | Pending
- Completed → (terminal)

### 5.4 Task Detail Page Role
Task detail is a **decision + update surface**:
- Clear header (identity + state)
- Minimal action cluster (only what’s allowed)
- Metadata grouped and visually secondary
- Completed tasks read-only

### 5.5 Transfer Rules
Transfer is rare and constrained:
- ONLY if urgency_label == “Not Urgent & Not Important” (Yellow)
- ONLY to subordinates (user.manager_id == current_user.id)
- Confirmation required
- Explain why transfer is restricted

---

## 6. Projects Experience

### 6.1 Project Job Statement
**“Is this on track, and who owns it?”**

### 6.2 Rules
- Emphasize status, timeline, ownership, manager
- De-emphasize raw fields
- Timeline is visual first
- No task behavior on project page

---

## 7. Documents Experience
Documents are utilities:
- Flat list
- Minimal chrome
- Fast upload/download
- No hierarchy, no previews by default

---

## 8. Events Experience
Events are time anchors:
- Chronological
- Date-driven
- Read-only emphasis
- No artificial status labels

---

## 9. Navigation & Layout Behavior

### Sidebar
- Quiet, stable, highlights current section only
- No nested navigation in this phase

### Page hierarchy test
Every page must answer in < 3 seconds:
1) Where am I?
2) What matters?
3) What can I do next?

---

## 10. Explicit Non-Goals
UI Phase 4 does NOT include:
- Backend work or new endpoints
- New pages/modules
- Analytics dashboards
- AI features

---

## 11. Acceptance Criteria
Phase 4 is complete when:
- Tasks feel board-first (primary workflow)
- Dashboard feels actionable (not informational)
- Progressive disclosure reduces clutter
- Product stops feeling like “admin CRUD”

---
