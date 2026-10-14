# BWC Task Manager MCP

A separate, hosted MCP service for the application at **app.becausewecan.gr**.
It calls the existing REST API as each signed-in user. It does not access the
application database, change application authentication, or share an admin account.
The MCP tools also check current module access before task/company operations,
including API routes whose module checks currently exist only in the web UI.

## How company users connect

1. Add the deployed URL, for example `https://YOUR-RENDER-SERVICE.onrender.com/mcp`, to an
   MCP client that supports Streamable HTTP and OAuth.
2. The client opens the BWC MCP sign-in page in a browser. Sign in with your
   existing BWC username/email and password, and explicitly approve that client.
   Never type your password into an agent conversation.
3. Ask the agent to look up people, companies and departments, then create or
   update tasks. Every operation retains the API's account, hierarchy and status rules.

Claude Code can connect with:

```sh
claude mcp add --transport http bwc https://YOUR-RENDER-SERVICE.onrender.com/mcp
```

Use `/mcp` inside Claude Code to authenticate. Claude's web application can use
the same remote URL through its custom connector settings where that feature
is available. Codex and other agents need remote MCP/OAuth support enabled in
their own client. Installing this service does not automatically connect this chat.
Use the default HTTPS address assigned by the separate Render service. The
example is a placeholder; no deployment has been created.

## Initial tools

- `who_am_i`, `get_my_module_permissions`
- `list_tasks`, `get_task`, `create_task`, `update_task`, `update_task_status`
- `search_users`, `list_assignable_users`, `create_user`
- `list_companies`, `list_departments`, `list_teams`
- `get_user_module_permissions`, `set_user_module_permissions`

Resolve UUIDs with lookup tools and use department **names**, such as
`Operations` or `Εκπαίδευση`. Dates use `YYYY-MM-DD`. Task creation requires
exactly one user or team assignee. Updates send only supplied fields, preserving
system-assigned urgency. Invalid input and denied operations become tool errors.

User creation follows the existing hierarchy-manager rules. Newly created users
do not automatically receive module access; an authorized admin can set it with
the permission tool. The backend generates an initial password, but this service
**does not return that password to the model**. An admin must reset and deliver
credentials securely through the existing application. Automated credential
delivery, deletion, password resets, file uploads and other modules are not
included in this first version.

## Installation

Use an isolated environment: the MCP SDK needs newer dependencies than the
FastAPI application's pinned requirements.

```sh
cd mcp_server
python3.12 -m venv .venv
.venv/bin/pip install '.[test]'
.venv/bin/pytest
```

## Deployment

Deploy this directory as a **separate** Python web service on Render or another
host with HTTPS and a persistent private disk. `render.yaml` is a blueprint
template, not a deployment action. A persistent disk requires a compatible paid
Render plan. Run **one worker and one service instance**; the upstream rotating
session locks are process-local. Multiple replicas require a shared database
and distributed refresh locks before they can be enabled.

Set these environment variables in the hosting service:

| Variable | Required value |
| --- | --- |
| `BWC_API_URL` | The actual backend API origin, **not** `app.becausewecan.gr` |
| `BWC_MCP_ISSUER_URL` | Optional on Render: defaults to its supplied `RENDER_EXTERNAL_URL`; otherwise use this service's public HTTPS origin with no path |
| `BWC_MCP_DATABASE_PATH` | Private persistent path, e.g. `/var/data/bwc-mcp/oauth.sqlite3` |
| `BWC_MCP_ENCRYPTION_KEY` | A Fernet key stored as a hosting secret |
| `PORT` | Supplied by the host, default `8001` |

The repository currently documents
`https://bwc-portal-backend-w1qr.onrender.com` as its backend. Confirm that this is
still the API origin configured for the live frontend before using live accounts.
The cloud coding environment could not access either production origin, so
production sign-in and hosted client compatibility have not been validated.

Generate the encryption key on a trusted machine with
`python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'`
and enter it directly into the hosting secret setting. Do not commit or share
the value in chat. Keep the key stable across deployments; losing it makes
stored connections unreadable. Back up the encrypted database and key separately.
Key rotation currently requires disconnecting clients and signing in again.

Start command: `bwc-mcp-remote`. Health check: `GET /health`.
Use Render's assigned `onrender.com` address and confirm HTTPS works. Custom
domains are optional; if added later, explicitly set `BWC_MCP_ISSUER_URL` to the
new origin and reconnect clients because the resource audience changes.
Do not use a public shared admin token or expose the legacy stdio process over HTTP.

After deployment, verify OAuth discovery, connect a regular test account and
confirm its identity with `who_am_i`. Create and update a disposable task, and
confirm another branch cannot access it. Then test authorized user creation as
a hierarchy manager and module-permission changes as an admin. Disconnect the
client and verify the revoked connection cannot call tools.

## Authentication and storage

The service adds an OAuth authorization-code flow with S256 PKCE, registered
redirects, browser-bound CSRF protection and explicit consent. It supports
dynamic client registration, OAuth discovery, resource metadata, refresh and
revocation. OAuth access tokens expire after 15 minutes and refresh tokens after
7 days; refresh rotates both tokens. BWC sessions are bound to the consenting
account and backend origin. MCP tokens cannot be used directly against BWC.

Opaque token lookup keys are hashed. Client secrets and upstream sessions are
encrypted in a SQLite database owned by the service, with a private directory
and database file. The application password is used only for sign-in and is not
persisted. Responses never expose upstream tokens or generated passwords.
MCP tokens are bound to this service's `/mcp` resource, and conflicting resource
parameters are rejected. Keep the OAuth endpoints behind the hosting platform's
rate limits as well as the application's login limiter. Sign-ins through this
broker also share the backend's existing limits for the broker's source IP.

Disconnect through the client's OAuth revocation support (`/revoke`); logging out
of the website alone does not revoke separate MCP authorizations. Deactivated
accounts are rejected by the BWC API. A network failure or server error during
a write is never automatically retried: check whether the record was created
before retrying. Responses containing user-supplied descriptions are data,
not instructions for agents.

## Development validation

Tests use synthetic credentials and mocked BWC HTTP responses. They cover
typed tools, account-specific credentials, denial propagation, code replay,
PKCE, client/resource binding, CSRF and consent, refresh rotation/concurrency,
revocation, encrypted persistence, and the real MCP SDK initialize/list/call flow.
They do not prove the hosted domain, DNS, production API or a specific external
client configuration works. No live tasks or users were created during development.
