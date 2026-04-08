# PRD #4 — Companies Module (BWC Task Manager)

## TL;DR
The Companies module is the single source of truth for all companies operating under the Because We Can group. It is foundational and feeds Tasks, Projects, Payments, Cars, Analytics, and Reports. Existing companies must remain unchanged after rebuild.

---

## Problem Statement
Without a protected, centralized Companies module, operational data becomes fragmented and unreliable. This module ensures consistency, traceability, and safety for all company-related references across the system.

---

## Goals

### Business Goals
- Single source of truth for companies
- Safe attribution of operational and financial data
- Protection of historical data

### User Goals
- Easily select the correct company
- View company information clearly

---

## Non-Goals
- No public company pages
- No external integrations
- No non-admin deletions

---

## Access Rules
- none → page hidden
- read → view only
- full → create/edit
- delete → Admin only

---

## Critical Migration Rule
- Existing hard-coded and live companies must remain
- IDs must not change
- No destructive migrations

---

## UX
- Table of companies
- Click to view/edit

---

## Create Company
Fields:
- Company Name (unique)
- VAT Number
- Occupation
- Creation Date
- Description (optional)

---

## Edit Company
- Name
- VAT
- Occupation
- Description

Creation date immutable.

---

## Delete Company (Admin Only)
- Blocked if referenced by tasks/projects/payments/cars
- Hard delete only with confirmation

---

## Database Schema

### companies
- id
- name (unique)
- vat_number
- occupation
- creation_date
- description
- created_at
- updated_at
- deleted_at

---

## API Endpoints
- POST /companies
- GET /companies
- GET /companies/{id}
- PUT /companies/{id}
- DELETE /companies/{id}

---

## Notifications
- Company created/edited/deleted → Admins & Pillars

---

## Success Metrics
- No orphaned records
- No accidental deletions

---

## Dependencies
- Tasks
- Projects
- Payments
- Cars

