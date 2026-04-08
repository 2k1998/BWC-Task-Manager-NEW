# PRD #12 — Cars / Fleet Management Module (BWC Task Manager)

## TL;DR
The Cars module manages company vehicles, rentals, sales, maintenance schedules, and car-specific income/expenses. All financial data here is isolated from global Payment Management.

---

## Problem Statement
Without a dedicated fleet system, vehicle maintenance, rentals, and profitability become fragmented and error-prone. This module centralizes fleet operations in one place.

---

## Goals

### Business Goals
- Track fleet assets accurately
- Prevent missed maintenance and KTEO deadlines
- Understand profitability per vehicle

### User Goals
- Register and manage cars easily
- Know when service is due
- Track car income and expenses

---

## Non-Goals
- No insurance policy management
- No GPS tracking
- No depreciation logic
- No inclusion in global payments

---

## Access Rules
- none → page hidden
- read → view only
- full → manage cars and finances

Admin override applies.

---

## Cars Page UX
- List/grid of cars
- Shows: make, model, plate, status
- Click opens car detail view

---

## Register Car

Fields:
- Make
- Model
- License Plate (unique)
- Year
- Purchase Date
- Purchase Price
- Status (available / rented / sold)
- Notes (optional)

---

## Car Detail View

### Maintenance
- Last Service Date
- Next Service Date
- Last KTEO Date
- Next KTEO Date
- Last Tyre Change Date

### Actions
- Add Income
- Add Expense

---

## Car Income

Fields:
- Customer Name
- Amount (EUR)
- Transaction Date
- Income Type (rental / sale)
- Description (optional)

---

## Car Expense

Fields:
- Expense Type
- Amount (EUR)
- Transaction Date
- Description (optional)

---

## Isolation Rule
- Car financials are stored separately
- Never appear in Payment Management

---

## Database Schema

### cars
- id
- make
- model
- license_plate
- year
- purchase_date
- purchase_price
- status
- notes
- created_at
- updated_at

### car_maintenance
- id
- car_id
- last_service_date
- next_service_date
- last_kteo_date
- next_kteo_date
- last_tyre_change_date
- updated_at

### car_incomes
- id
- car_id
- customer_name
- amount
- income_type
- transaction_date
- description
- created_at

### car_expenses
- id
- car_id
- expense_type
- amount
- transaction_date
- description
- created_at

---

## API Endpoints
- POST /cars
- GET /cars
- GET /cars/{id}
- PUT /cars/{id}
- DELETE /cars/{id}
- PUT /cars/{id}/maintenance
- POST /cars/{id}/income
- POST /cars/{id}/expense
- GET /cars/{id}/financials

---

## Dependencies
- Users
- Permissions

