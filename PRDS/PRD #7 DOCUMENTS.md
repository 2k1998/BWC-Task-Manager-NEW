# PRD #7 — Documents Module (BWC Task Manager)

## TL;DR
The Documents module provides a controlled internal repository for uploading, viewing, downloading, and deleting documents. Access is strictly permission-based and documents are referenced by other modules.

---

## Problem Statement
Internal documents are often scattered across emails and chats. This module centralizes files with clear access control and auditability.

---

## Goals

### Business Goals
- Centralize internal documents
- Enforce access control

### User Goals
- Upload and retrieve documents easily
- Avoid accidental deletion

---

## Non-Goals
- No collaborative editing
- No public sharing
- No versioning UI

---

## Access Rules
- none → page hidden
- read → view & download
- full → upload & delete

---

## UX
- Table/grid view
- Upload button (if permitted)

---

## Upload Rules
- Max size: 20MB (configurable)
- Allowed types: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, images, ZIP

---

## Delete Rules
- Only uploader or Admin
- Hard delete

---

## Database Schema

### documents
- id
- file_id
- uploaded_by_user_id
- original_file_name
- mime_type
- size_bytes
- created_at

---

## API Endpoints
- POST /documents
- GET /documents
- GET /documents/{id}/download
- DELETE /documents/{id}

---

## Dependencies
- Users
- Files
- Permissions

