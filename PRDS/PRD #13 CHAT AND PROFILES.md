# PRD #13 — Profile, Presence, Chat & Approvals Module (BWC Task Manager)

## TL;DR
This module adds the human and communication layer to BWC Task Manager: user profiles, real-time presence, 1:1 chat, notifications UI, and approval workflows. It centralizes communication and approvals inside the platform.

---

## Problem Statement
Work coordination breaks down when communication and approvals happen outside the system. This module brings messaging, presence, and approvals directly into BWC Task Manager, keeping context and accountability intact.

---

## Goals

### Business Goals
- Reduce reliance on external chat tools
- Centralize approvals
- Improve traceability and accountability

### User Goals
- Communicate easily
- See who is online
- Request and approve actions quickly

---

## Non-Goals
- No group chat
- No voice/video calls
- No external chat integrations

---

## Profile Page

### Editable
- Profile picture
- Birthday
- Bio / description

### Read-only
- Name
- Username
- Email
- User type

---

## Presence (Right Sidebar)

- Shows online/offline users
- Online = active WebSocket connection
- Offline = last seen timestamp

---

## Chat

### Scope
- 1:1 messaging only

### Features
- Real-time messages
- Read receipts
- Typing indicators
- File uploads

---

## Notifications UI

- Facebook-like notification bell
- Unread badge count
- Deep links to entities

---

## Approval Requests

### Request Form
- Type (General, Expenses, Task, Project, Purchase)
- Title
- Description

### Flow
- Sent via message notification
- Receiver can Approve, Deny, or Discuss
- Resolution is permanent

---

## Database Schema

### user_profiles
- user_id
- bio
- birthday
- profile_photo_url
- updated_at

### chat_threads
- id
- user_one_id
- user_two_id
- created_at

### chat_messages
- id
- thread_id
- sender_user_id
- message_text
- file_id
- is_read
- created_at

### approval_requests
- id
- requester_user_id
- receiver_user_id
- request_type
- title
- description
- status
- resolved_at
- created_at

---

## API Endpoints
- GET /profile/me
- PUT /profile/me
- GET /chat/threads
- GET /chat/threads/{id}
- POST /chat/messages
- POST /approvals
- POST /approvals/{id}/approve
- POST /approvals/{id}/deny

---

## Dependencies
- Users
- Notifications
- Files
- WebSockets

