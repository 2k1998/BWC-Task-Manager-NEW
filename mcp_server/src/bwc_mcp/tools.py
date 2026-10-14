"""Typed BWC tools with live module grants and API hierarchy enforcement."""
from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal
from uuid import UUID

from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations
from pydantic import BaseModel, ConfigDict, Field

from .client import APIError, BwcClient

Status = Literal['New', 'Received', 'On Process', 'Pending', 'Completed', 'Loose End']
Urgency = Literal['Urgent & Important', 'Urgent', 'Important', 'Not Urgent & Not Important']
Role = Literal['Admin', 'Pillar', 'Manager', 'Head', 'Agent']
Module = Literal['tasks', 'contacts', 'companies', 'projects', 'cars', 'analytics', 'payments', 'documents']
AccessLevel = Literal['none', 'view', 'edit', 'delete']
Page = Annotated[int, Field(ge=1)]
PageSize = Annotated[int, Field(ge=1, le=100)]
Title = Annotated[str, Field(min_length=1)]

READ = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=True)
CREATE = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=True)
UPDATE = ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=True)
STATUS_UPDATE = ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=True)


class ModulePermission(BaseModel):
    model_config = ConfigDict(extra='forbid')
    module: Module
    access_level: AccessLevel


def _dates(start: date | None, deadline: date | None) -> None:
    if start is not None and deadline is not None and deadline < start:
        raise ValueError('Deadline cannot be before start date')


def _params(**values: Any) -> dict[str, Any]:
    return {key: str(value) if isinstance(value, (UUID, date)) else value
            for key, value in values.items() if value is not None}


class PermissionCheckedClient:
    """Apply UI module grants before API operations; never cache permission results."""

    def __init__(self, inner: BwcClient):
        self.inner = inner

    async def request(self, method: str, path: str, *, params: dict | None = None,
                      json: dict | None = None) -> dict | list:
        method = method.upper()
        module: str | None = None
        required = 'view'
        if path == '/tasks' or path.startswith('/tasks/'):
            module = 'tasks'
            if method == 'POST' or (method == 'PUT' and not path.endswith('/status')):
                required = 'edit'
        elif (path == '/companies' or path.startswith('/companies/')) and method == 'GET':
            module = 'companies'

        if module is not None:
            result = await self.inner.request('GET', '/auth/me/module-permissions')
            permissions = result.get('permissions') if isinstance(result, dict) else None
            level = permissions.get(module) if isinstance(permissions, dict) else None
            rank = {'none': 0, 'view': 1, 'edit': 2, 'delete': 3}
            if not isinstance(level, str) or level not in rank or rank[level] < rank[required]:
                raise APIError(f'Module access denied: {module} requires {required}', status_code=403)

        return await self.inner.request(method, path, params=params, json=json)


def register_tools(server: FastMCP, client: BwcClient) -> None:
    client = PermissionCheckedClient(client)
    @server.tool(annotations=READ)
    async def who_am_i() -> Any:
        """Return the authenticated account without tokens or credentials."""
        return await client.request('GET', '/auth/me')

    @server.tool(annotations=READ)
    async def list_tasks(page: Page = 1, page_size: PageSize = 50,
                         status_filter: Status | None = None,
                         urgency_filter: Literal['Urgent & Important', 'Urgent', 'Important', 'Not Urgent & Not Important', 'Orange'] | None = None,
                         company_filter: UUID | None = None, assigned_user_filter: UUID | None = None,
                         branch_user_id: UUID | None = None) -> Any:
        """List visible tasks. Branch filtering is available to admins only."""
        return await client.request('GET', '/tasks', params=_params(
            page=page, page_size=page_size, status_filter=status_filter, urgency_filter=urgency_filter,
            company_filter=company_filter, assigned_user_filter=assigned_user_filter, branch_user_id=branch_user_id))

    @server.tool(annotations=READ)
    async def get_task(task_id: UUID) -> Any:
        """Get a visible task by UUID without marking it as viewed."""
        return await client.request('GET', f'/tasks/{task_id}')

    @server.tool(annotations=CREATE)
    async def create_task(title: Title, company_id: UUID, department: Title,
                          start_date: date, deadline: date, description: str | None = None,
                          urgency_label: Urgency | None = None, assigned_user_id: UUID | None = None,
                          assigned_team_id: UUID | None = None) -> Any:
        """Create a task with a department name and exactly one assignee. Same-day tasks may omit urgency."""
        _dates(start_date, deadline)
        if (assigned_user_id is None) == (assigned_team_id is None):
            raise ValueError('Provide exactly one assigned_user_id or assigned_team_id')
        if urgency_label is None and start_date != deadline:
            raise ValueError('Urgency is required when start date and deadline differ')
        payload = _params(title=title, company_id=company_id, department=department, start_date=start_date,
                          deadline=deadline, description=description, urgency_label=urgency_label,
                          assigned_user_id=assigned_user_id, assigned_team_id=assigned_team_id)
        return await client.request('POST', '/tasks', json=payload)

    @server.tool(annotations=UPDATE)
    async def update_task(task_id: UUID, title: Title | None = None, description: str | None = None,
                          company_id: UUID | None = None, department: Title | None = None,
                          urgency_label: Urgency | None = None, start_date: date | None = None,
                          deadline: date | None = None, assigned_user_id: UUID | None = None,
                          assigned_team_id: UUID | None = None) -> Any:
        """Update only supplied task metadata as owner/admin. Omit unchanged fields; completed tasks cannot be edited."""
        _dates(start_date, deadline)
        if assigned_user_id is not None and assigned_team_id is not None:
            raise ValueError('Cannot assign to both a user and a team')
        payload = _params(title=title, description=description, company_id=company_id, department=department,
                          urgency_label=urgency_label, start_date=start_date, deadline=deadline,
                          assigned_user_id=assigned_user_id, assigned_team_id=assigned_team_id)
        if not payload:
            raise ValueError('Provide at least one field to update')
        return await client.request('PUT', f'/tasks/{task_id}', json=payload)

    @server.tool(annotations=STATUS_UPDATE)
    async def update_task_status(task_id: UUID, status: Status) -> Any:
        """Advance status as assignee, team head, or admin. The API validates the transition."""
        return await client.request('PUT', f'/tasks/{task_id}/status', json={'status': status})

    @server.tool(annotations=READ)
    async def search_users(query: Annotated[str, Field(max_length=100)] = '',
                           limit: PageSize = 20) -> Any:
        """Search visible active users; excludes your account. Use assignable users for task assignment."""
        return await client.request('GET', '/users', params={'query': query, 'limit': limit})

    @server.tool(annotations=READ)
    async def list_assignable_users() -> Any:
        """List active task assignees in your organization, including your account."""
        return await client.request('GET', '/users/assignable')

    @server.tool(annotations=READ)
    async def list_companies(page: Page = 1, page_size: PageSize = 50,
                             name_search: str | None = None, branch_user_id: UUID | None = None) -> Any:
        """List company IDs and names. Branch filtering is admin-only."""
        return await client.request('GET', '/companies', params=_params(
            page=page, page_size=page_size, name_search=name_search, branch_user_id=branch_user_id))

    @server.tool(annotations=READ)
    async def list_departments() -> Any:
        """List department names to use when creating or updating tasks."""
        return await client.request('GET', '/departments')

    @server.tool(annotations=READ)
    async def list_teams(page: Page = 1, page_size: PageSize = 50) -> Any:
        """List your teams; admins can list all teams."""
        return await client.request('GET', '/teams', params={'page': page, 'page_size': page_size})

    @server.tool(annotations=CREATE)
    async def create_user(email: Annotated[str, Field(min_length=3, max_length=254)],
                           username: Annotated[str, Field(min_length=3, max_length=50)],
                           first_name: Annotated[str, Field(min_length=1, max_length=100)],
                           last_name: Annotated[str, Field(min_length=1, max_length=100)],
                           user_type: Role, parent_id: UUID | None = None) -> dict[str, Any]:
        """Create a hierarchy account without exposing its password. An admin must securely reset/deliver credentials separately."""
        result = await client.request('POST', '/admin/users', json=_params(
            email=email, username=username, first_name=first_name, last_name=last_name,
            user_type=user_type, parent_id=parent_id))
        if not isinstance(result, dict):
            raise ValueError('Unexpected account response')
        safe = {key: result[key] for key in ('user_id', 'email', 'username', 'first_name', 'last_name',
                                           'user_type', 'is_active', 'parent_id') if key in result}
        safe['credential_unavailable'] = True
        safe['credential_delivery'] = 'An admin must securely reset and deliver the password outside MCP.'
        return safe

    @server.tool(annotations=READ)
    async def get_my_module_permissions() -> Any:
        """Get your effective module access levels."""
        return await client.request('GET', '/auth/me/module-permissions')

    @server.tool(annotations=READ)
    async def get_user_module_permissions(user_id: UUID) -> Any:
        """Get another account's module permissions as admin."""
        return await client.request('GET', f'/admin/users/{user_id}/permissions')

    @server.tool(annotations=UPDATE)
    async def set_user_module_permissions(user_id: UUID,
                                           permissions: Annotated[list[ModulePermission], Field(min_length=1, max_length=8)]) -> Any:
        """Set supplied module access levels as admin; unspecified modules remain unchanged."""
        if len({permission.module for permission in permissions}) != len(permissions):
            raise ValueError('Each module may appear only once')
        return await client.request('PATCH', f'/admin/users/{user_id}/permissions',
                                    json={'permissions': [permission.model_dump() for permission in permissions]})
