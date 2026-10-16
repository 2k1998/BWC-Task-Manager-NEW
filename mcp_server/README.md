# BWC Task Manager MCP

OAuth MCP tools for the application at **app.becausewecan.gr**. Company users sign
in with their existing accounts. Operations retain module, hierarchy and ownership
permissions; no shared admin account is used.

## Recommended: share the existing paid backend

The API and MCP can run on the existing paid Render backend service, on one port
and one worker. No second web service or disk is needed. Encrypted OAuth state
uses the existing PostgreSQL database in `bwc_mcp_oauth_records`. Application
Alembic autogeneration excludes this independently managed table.

Existing API, authentication, health, docs and WebSocket routes remain available.
MCP and its OAuth/discovery routes are dispatched to the MCP application. Both
lifespans initialize before the combined service is healthy. Startup fails if
either component cannot initialize.

On the **existing paid backend service**, use:

| Render setting | Value |
| --- | --- |
| Branch | `feat/mcp-server` until merged into your deployment branch |
| Root Directory | `backend` |
| Build Command | `bash ../scripts/build_backend_with_mcp.sh` |
| Start Command | `python -m bwc_mcp.combined` |
| Health Check Path | `/health` |
| Instances/workers | **1** |

Keep all existing API environment variables, including `DATABASE_URL`, JWT and
CORS settings. Add `BWC_MCP_ENCRYPTION_KEY` as a hosting secret. Reuse the key
from the failed standalone deployment if already generated, transferring it
securely inside Render. Do not send it through chat.

To generate a new key on a trusted machine:

```sh
python -m pip install cryptography
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Combined-mode defaults:

| Setting | Default/override |
| --- | --- |
| OAuth database | Existing `DATABASE_URL`; override with `BWC_MCP_DATABASE_URL` for a separate PostgreSQL database |
| Public issuer | Render's `RENDER_EXTERNAL_URL`; optionally set `BWC_MCP_ISSUER_URL` to the paid backend's public HTTPS origin |
| Internal API calls | `http://127.0.0.1:$PORT`; override with `BWC_API_URL` if needed |
| SQLite path | Ignored in combined mode; PostgreSQL is required |

Do not copy an issuer pointing to the old standalone MCP hostname. The issuer
and MCP resource must identify this paid backend. `app.becausewecan.gr` is the
frontend, not the API/MCP origin. The database user must be able to create the
OAuth table and indexes.

The build resolves API and MCP dependencies together. Pydantic is pinned to
**2.11.10**, required by the MCP SDK and verified with backend regressions; other
backend pins are retained. Both components share the paid service's CPU/memory,
so monitor usage after deployment.

After deployment, verify normal API health and website functionality first.
Connect agents to `https://YOUR-EXISTING-BACKEND.onrender.com/mcp`. Confirm
`who_am_i`, test a disposable task, and verify restricted users cannot access
another branch. Suspend the old standalone service only after these checks.

Rollback: restore your previous backend build/start commands and known-good
commit. The OAuth table can remain; normal API startup does not read it. Do not
delete application data to roll back this integration.

## Connect agents

Codex:

```sh
codex mcp add bwc --url https://YOUR-EXISTING-BACKEND.onrender.com/mcp --oauth-client-registration dcr
```

Claude Code:

```sh
claude mcp add --transport http bwc https://YOUR-EXISTING-BACKEND.onrender.com/mcp
```

Use the client's browser sign-in flow and explicitly approve it with your existing
BWC account. Never put passwords into agent conversations. Claude web can use the
same URL in custom connector settings where supported. Other agents need remote
Streamable HTTP/OAuth support; deployment does not automatically connect every
agent or this chat.

## Initial tools

- `who_am_i`, `get_my_module_permissions`
- `list_tasks`, `get_task`, `create_task`, `update_task`, `update_task_status`
- `search_users`, `list_assignable_users`, `create_user`
- `list_companies`, `list_departments`, `list_teams`
- `get_user_module_permissions`, `set_user_module_permissions`

Look up UUIDs before writing; departments use names such as `Operations` and
`Εκπαίδευση`. Dates use `YYYY-MM-DD`. Task creation requires exactly one user/team
assignee. Updates send only supplied fields, preserving automatic urgency.
Tools check fresh module permissions before task/company operations, including
API routes whose module gates currently exist only in the web interface.

User creation follows hierarchy-manager rules. New accounts need module grants;
an authorized admin can set them with the permission tool. Generated passwords
never enter MCP output. An admin must reset/deliver them securely through the
existing application. Password delivery/reset, deletion and uploads are not
included in this version.

## OAuth and storage

Authorization uses registered redirects, S256 PKCE, browser-bound CSRF protection,
explicit consent, discovery, dynamic registration and resource metadata. Access
tokens expire after 15 minutes and refresh tokens after 7 days. Refresh rotates
both tokens. Tokens are bound to this MCP resource and cannot be passed directly
to BWC. Conflicting resource requests are rejected.

Secret lookup keys are hashed. Upstream sessions and confidential client data
are Fernet-encrypted at rest. Application passwords are used only for sign-in,
never persisted or returned to the model. Keep the encryption key stable; back
up it and the database separately. Losing/changing it requires reconnecting users.
PostgreSQL advisory transactions serialize one-time token consumption. One worker
and one instance remain required because upstream refresh locks are process-local.

Backend login limits also apply to the broker's source IP. Disconnect using client
OAuth revocation support (`/revoke`); website logout alone does not revoke separate
MCP connections. Deactivated users are denied by BWC. Network/server failures during
writes are not retried automatically; check for an existing record before retrying.

## Optional standalone service

`render.yaml` creates a separate service; it does not update the existing backend.
Standalone start command: `bwc-mcp-remote`. Choose either PostgreSQL with
`BWC_MCP_DATABASE_URL` and the `postgres` installation extra, or private SQLite
with `BWC_MCP_DATABASE_PATH` and a paid persistent disk. Standalone requires
`BWC_API_URL` and never implicitly uses `DATABASE_URL`. Its issuer defaults to
Render's public URL. A free standalone service may sleep when idle.

## Development checks

From `backend`, using an isolated Python 3.11/3.12 environment:

```sh
bash ../scripts/build_backend_with_mcp.sh
python -m pip install '../mcp_server[test,postgres]'
python -m pytest tests -q
python -m pytest ../mcp_server/tests -q
```

Set `BWC_MCP_TEST_DATABASE_URL` to a **local/test** PostgreSQL database for the
PostgreSQL integration cases. They create/drop unique schemas and require schema
permissions. Without it, those cases are explicitly skipped. Validation includes
real FastAPI routing, WebSockets, lifespan readiness/failure handling, real MCP
protocol calls, permissions, OAuth replay/CSRF/PKCE, encrypted persistence and
concurrency. Local passing tests do not establish a successful Render deployment.
