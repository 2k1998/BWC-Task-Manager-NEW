# BWC Task Manager - Backend

FastAPI backend for the BWC Task Manager application.

## Tech Stack

- **Python**: 3.11+
- **Framework**: FastAPI
- **ORM**: SQLAlchemy 2.x
- **Migrations**: Alembic
- **Database**: PostgreSQL
- **Authentication**: JWT with refresh tokens

## Setup

### 1. Prerequisites

- Python 3.11+
- PostgreSQL database

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Create a `.env` file in the backend directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/bwc_task_manager
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
APP_NAME=BWC Task Manager
DEBUG=False
# Comma-separated. Defaults to https://app.becausewecan.gr when unset.
# For local dev, append the frontend dev server:
CORS_ALLOWED_ORIGINS=https://app.becausewecan.gr,http://localhost:3001
```

### 4. Run Migrations

```bash
alembic upgrade head
```

### 5. Seed Data

```bash
# Seed pages
python scripts/seed_pages.py

# Seed departments
python scripts/seed_departments.py

# Create admin user
python scripts/create_admin.py
```

### 6. Run Server

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

### Production start command

There is no `render.yaml` / `Procfile` in this repo — the start command is set in
the Render dashboard. It **must** include the proxy flags:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"
```

The login/refresh rate limiter buckets clients by the first hop of
`X-Forwarded-For` (see `app/core/rate_limit.py`). Without `--proxy-headers
--forwarded-allow-ips="*"` that header is not trusted/parsed by uvicorn, and the
per-IP buckets become spoofable — any caller can send an arbitrary
`X-Forwarded-For` and get a fresh bucket on every request.

**Rate limiter storage:** slowapi is configured with its default **in-memory**
storage, which is per-process. Counters are not shared across uvicorn workers or
Render instances, and they reset on every deploy or restart. If the app is ever
run with more than one worker or instance, pass a Redis `storage_uri` to the
`Limiter` in `app/core/rate_limit.py` — otherwise the effective limit is
multiplied by the number of processes.

## API Documentation

Once the server is running, visit:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

### Authentication (`/auth`)

| Method | Endpoint                | Description                          | Auth Required |
| ------ | ----------------------- | ------------------------------------ | ------------- |
| POST   | `/auth/login`           | Login with username/email + password | No            |
| POST   | `/auth/refresh`         | Refresh access token                 | No            |
| POST   | `/auth/logout`          | Invalidate refresh token             | Yes           |
| POST   | `/auth/change-password` | Change password                      | Yes           |

### Admin - Users (`/admin/users`)

| Method | Endpoint                        | Description            | Auth Required |
| ------ | ------------------------------- | ---------------------- | ------------- |
| POST   | `/admin/users`                  | Create new user        | Admin only    |
| GET    | `/admin/users`                  | List users (paginated) | Admin only    |
| GET    | `/admin/users/{id}`             | Get user details       | Admin only    |
| PUT    | `/admin/users/{id}`             | Update user            | Admin only    |
| POST   | `/admin/users/{id}/permissions` | Set page permissions   | Admin only    |
| POST   | `/admin/users/{id}/deactivate`  | Deactivate user        | Admin only    |

### Companies (`/companies`, `/admin/companies`)

| Method | Endpoint                | Description                | Auth Required    |
| ------ | ----------------------- | -------------------------- | ---------------- |
| POST   | `/admin/companies`      | Create company             | Admin only       |
| GET    | `/companies`            | List companies (paginated) | Permission-based |
| GET    | `/companies/{id}`       | Get company details        | Permission-based |
| PUT    | `/admin/companies/{id}` | Update company             | Admin only       |

**Note:** Companies cannot be deleted in Phase 2. Deletion will be added in future phases when reference checking can be properly enforced.

### Admin - Departments (`/admin/departments`)

| Method | Endpoint                  | Description                  | Auth Required |
| ------ | ------------------------- | ---------------------------- | ------------- |
| POST   | `/admin/departments`      | Create department            | Admin only    |
| GET    | `/admin/departments`      | List departments (paginated) | Admin only    |
| GET    | `/admin/departments/{id}` | Get department details       | Admin only    |
| PUT    | `/admin/departments/{id}` | Update department            | Admin only    |

**Note:** Departments cannot be deleted in Phase 2. Deletion will be added in future phases when reference checking can be properly enforced.

### Teams (`/teams`)

| Method | Endpoint                        | Description            | Auth Required                              |
| ------ | ------------------------------- | ---------------------- | ------------------------------------------ |
| POST   | `/teams`                        | Create team            | Admin only                                 |
| GET    | `/teams`                        | List teams (paginated) | User sees only their teams, admin sees all |
| GET    | `/teams/{id}`                   | Get team details       | Team member or admin                       |
| PUT    | `/teams/{id}`                   | Update team            | Team head or admin                         |
| POST   | `/teams/{id}/members`           | Add team members       | Team head or admin                         |
| DELETE | `/teams/{id}/members/{user_id}` | Remove team member     | Team head or admin                         |

**Key Features:**

- Each team has exactly one head
- Head is automatically added as team member with role 'head'
- Users only see teams they belong to (admin sees all)
- Only admin or team head can modify team
- Cannot remove team head (must change head first)

## Architecture

### Database Models

**Phase 1:**

- `users` - User accounts with hierarchy
- `auth_refresh_tokens` - Server-side refresh token storage
- `pages` - System pages for permissions
- `user_page_permissions` - Page-level access control
- `user_audit_logs` - Audit trail for admin actions

**Phase 2:**

- `companies` - BWC group companies (with soft delete)
- `departments` - Department management

**Phase 3:**

- `teams` - Team management with head
- `team_members` - Team membership junction table

### Key Features

- **JWT Authentication**: Access tokens + server-side refresh tokens
- **Page-level Permissions**: `none`, `read`, `full` access levels
- **User Hierarchy**: Manager-subordinate relationships
- **Audit Logging**: All admin actions tracked with before/after states
- **Soft Delete**: Companies support soft deletion
- **Admin-only Operations**: User management, company/department CRUD

### Design Principles

- UUID primary keys everywhere
- Timezone-aware UTC timestamps
- Foreign keys use `RESTRICT` on delete (no cascading)
- No implicit defaults
- Backend is single source of truth

## Initial Admin Account

`create_admin.py` has no default password. Set `ADMIN_INITIAL_PASSWORD`
(minimum 10 characters) in the environment before running it; the script exits
with an error if the variable is unset or too short, and never echoes the value.

```bash
ADMIN_INITIAL_PASSWORD='<choose-a-strong-password>' python scripts/create_admin.py
```

```
Username: admin
Email: admin@bwc.com
Password: whatever you passed via ADMIN_INITIAL_PASSWORD
```

Passwords are admin-controlled only — there is no self-service change-password
flow. See the permanent product rules in the repo-root `CLAUDE.md`.

## Development

### Running Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

### Project Structure

```
backend/
├── alembic/              # Database migrations
├── app/
│   ├── api/             # API route handlers
│   ├── core/            # Core utilities (config, database, security)
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic schemas
│   └── utils/           # Helper utilities
├── scripts/             # Seed and utility scripts
├── .env                 # Environment variables (not in git)
├── .env.example         # Environment template
├── alembic.ini          # Alembic configuration
└── requirements.txt     # Python dependencies
```

## Security

- Passwords hashed with bcrypt
- JWT access tokens (configurable expiry via env var)
- All user management actions are audited

## Audit Logging

All admin actions on users are logged in `user_audit_logs` with:

- Admin user ID
- Target user ID
- Action performed
- Before state (JSON)
- After state (JSON)
- Timestamp

Audit logs are immutable and cannot be deleted.
