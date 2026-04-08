Title: UI Phase 6 — Admin & Authority Surfaces
Scope: Frontend Only
Type: Non-Destructive
Backend Dependency: Phase 8 Required

UI PHASE 6 PRD
Admin Authority & Role-Based Surfaces
1️⃣ Purpose

UI Phase 6 implements the frontend layer required to reflect:

Phase 8 backend hardening

Admin-only user creation

Admin-only password reset

Strict role-based UI enforcement

This phase ensures:

Authority hierarchy is visible in the UI

Admin capabilities are usable

Non-admin users cannot see restricted controls

Backend 403 errors are prevented through UI logic

2️⃣ Authoritative Backend References (MANDATORY)

The agent MUST align with:

🔐 PRD #0 — System Rules

Backend is source of truth

No client spoofing

Owner derived from session

No client authority override

🔐 PRD #4 — Authentication

No registration

No self-password change

JWT-based session

🔐 PRD #8 — System Hardening & Admin Authority

Admin-only user creation

Admin-only password reset

user_type cannot be modified by non-admin

No public signup endpoints

🔐 PRD #15 — Permissions & Visibility

Role-based visibility enforcement

Admin sees all

Others restricted by role

🔐 PRD #17 — Naming & Schema Consistency

Field names must EXACTLY match backend schema

No frontend renaming

3️⃣ Functional Scope
A. Admin User Management Page
Route:
/admin/users

Visibility:

Only accessible if:

current_user.user_type === "Admin"


Non-admin behavior:

Redirect to /dashboard

OR render 403 Forbidden page

Page Sections
1. Users Table

Columns:

First Name

Last Name

Username

Email

User Type (Admin / Manager / Employee)

Created At

Actions

Actions:

Reset Password (Admin Only)

NO:

Delete user (unless backend supports it)

Edit role (unless backend supports it)

2. Create User Modal

Fields:

First Name (required)

Last Name (required)

Username (required)

Email (required)

user_type (Admin / Manager / Employee)

manager_id (optional)

Submit:
POST /admin/users

Response:

{
  "user_id": "...",
  "generated_password": "plaintext_password"
}


After creation:

Show generated password in secure modal

Show warning: “Copy this password. It will not be shown again.”

Do NOT log it

Do NOT store it in state

3. Reset Password Flow

Button → Confirmation Modal → POST /admin/users/{id}/reset-password

Response:

{
  "generated_password": "plaintext_password"
}


After reset:

Show secure password modal

No logging

No storage

No toast containing password

B. Role-Based Navigation Enforcement

Sidebar MUST:

Show “Admin” section only if user_type === "Admin"

Hide Admin links for all other users

No disabled ghost items

C. Permission-Based Button Rendering

Instead of allowing click → 403:

The UI must:

Hide forbidden buttons entirely

Not render transfer if forbidden

Not render edit if forbidden

Not render reset if not admin

Backend remains final enforcement.

D. Header Authority Display

Header must show:

Full Name (First + Last)

Role badge (Admin / Manager / Employee)

Badge style subtle (not decorative)

E. Route Guards

Create reusable component:

<AdminRoute>


Behavior:

If not admin → redirect to /dashboard

4️⃣ Visual System Alignment

Must follow Phase 3 Design System:

Frozen Gold: #D1AE62

15px body font

Borders over shadows

No saturated backgrounds

Modal shadow-xl only

No decorative gradients

Calm hierarchy

5️⃣ Non-Goals

This phase does NOT:

Add analytics

Add notifications

Add chat

Modify backend

Add delete user

Add edit role (unless backend supports it)

Add user self profile editing

6️⃣ Security Rules (STRICT)

Passwords NEVER logged

Passwords NEVER stored in state beyond modal

No console.log of password

No retry showing old password

No fallback passwords

No default user_type

7️⃣ Completion Criteria

UI Phase 6 is complete when:

Admin can create user

Admin can reset password

Non-admin cannot see admin UI

Sidebar is role-aware

No forbidden UI visible

Password only shown once

No backend changes required