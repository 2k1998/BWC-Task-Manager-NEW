# PRD #11 — Payment Management Module (BWC Task Manager)

## TL;DR
The Payment Management module tracks operational financial movements (expenses, income, salaries, commissions, bonuses). It provides visibility and filtering, not accounting or compliance.

---

## Problem Statement
Operational money flows are currently fragmented. This module centralizes visibility across companies and employees while remaining simple and auditable.

---

## Goals

### Business Goals
- Centralize operational finance data
- Improve transparency
- Support basic reporting

### User Goals
- Add expenses/income quickly
- Filter and understand totals

---

## Non-Goals
- No tax/payroll compliance
- No bank integrations
- No invoicing

---

## Access Rules
- none → hidden
- read → view only
- full → add/edit/delete
- Admin override applies

---

## UX

### Summary
- Total expenses
- Total income
- Net balance

### Filters
- Date range
- Company
- Employee
- Payment type
- Category
- Currency

---

## Payment Types (Fixed)
- salary
- commission
- bonus
- rent
- bill
- purchase
- service

---

## Add Expense / Income

Fields:
- Title (required)
- Description (optional)
- Amount (decimal)
- Currency
- Payment type
- Payment date
- Employee (optional)
- Company (required)
- Payment category
- Notes (optional)

Income is marked via `is_income = true`.

---

## Edit / Delete
- Edit: creator or Admin
- Delete: Admin only
- All changes audited

---

## Database Schema

### payments
- id
- title
- description
- amount
- currency
- payment_type
- payment_category
- payment_date
- is_income
- employee_user_id
- company_id
- created_by_user_id
- created_at
- updated_at

---

## API Endpoints
- POST /payments
- GET /payments
- PUT /payments/{id}
- DELETE /payments/{id}

---

## Dependencies
- Users
- Companies
- Permissions
- Departments

