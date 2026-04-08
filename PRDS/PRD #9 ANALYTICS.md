# PRD #9 — Analytics & Reports Module (BWC Task Manager)

## TL;DR
The Analytics & Reports module provides real-time, read-only insights into task execution across users, teams, and companies. It is used by Admins, Managers, and Pillars to monitor workload, performance, and bottlenecks.

---

## Problem Statement
Without analytics, leadership operates blindly. This module converts operational task data into trustworthy, decision-ready visibility.

---

## Goals

### Business Goals
- Monitor execution health
- Identify workload imbalance
- Support data-driven decisions

### User Goals
- Quickly understand system status
- Filter by company, user, date, status

---

## Non-Goals
- No predictive analytics
- No AI recommendations
- No financial reporting

---

## Access Rules
- none → page hidden
- read → view analytics
- full → same as read

Scope:
- Admin → all data
- Pillar → all companies
- Manager → self + downline

---

## UX Layout
- Global filters
- KPI cards
- Charts
- Data tables

---

## Filters
- Company
- User (self + downline)
- Date range (default last 30 days)
- Task status

---

## Core Metrics
- Active tasks per company
- Active tasks per user
- Completed tasks (past month)
- Tasks created per user
- Overdue tasks

---

## Charts
- Bar: tasks per company
- Bar: tasks per user
- Line: completed tasks over time
- Pie: task status distribution

---

## Tables
Columns:
- Title
- Company
- Assignee
- Owner
- Status
- Urgency
- Deadline

---

## Backend Rules
- Server-side aggregation only
- Cached max 60s
- WebSocket refresh on task updates

---

## API Endpoints
- GET /analytics/summary
- GET /analytics/tasks
- GET /analytics/tasks-per-company
- GET /analytics/tasks-per-user
- GET /analytics/completed

---

## Dependencies
- Tasks
- Users & Hierarchy
- Companies
- Permissions

