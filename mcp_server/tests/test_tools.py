import pytest
from mcp.server.fastmcp import FastMCP

from bwc_mcp.client import APIError
from bwc_mcp.tools import register_tools

TASK_ID = '11111111-2222-4333-8444-555555555555'
USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'


class FakeClient:
    def __init__(self, result=None, error=None, permission_payload="default"):
        self.permission_calls = []
        self.permission_payload = ({"permissions": {"tasks": "edit", "companies": "view"}}
                                   if permission_payload == "default" else permission_payload)
        self.calls = []
        self.result = result if result is not None else {'id': TASK_ID}
        self.error = error
    async def request(self, method, path, **kwargs):
        if path == "/auth/me/module-permissions":
            self.permission_calls.append((method, path, kwargs))
            return self.permission_payload
        self.calls.append((method, path, {key: value for key, value in kwargs.items() if value is not None}))
        if self.error:
            raise self.error
        return self.result


def server_for(client):
    server = FastMCP('test-bwc-tools')
    register_tools(server, client)
    return server


@pytest.mark.asyncio
async def test_changed_deadline_only_is_sent_and_orange_is_not_injected():
    client = FakeClient()
    await server_for(client).call_tool('update_task', {'task_id': TASK_ID, 'deadline': '2026-12-15'})
    assert client.calls == [('PUT', f'/tasks/{TASK_ID}', {'json': {'deadline': '2026-12-15'}})]


@pytest.mark.asyncio
@pytest.mark.parametrize('name,args', [
    ('update_task', {'task_id': 'invalid', 'deadline': '2026-12-15'}),
    ('update_task', {'task_id': TASK_ID, 'deadline': 'invalid'}),
    ('update_task', {'task_id': TASK_ID, 'start_date': '2026-12-20', 'deadline': '2026-12-15'}),
    ('update_task', {'task_id': TASK_ID, 'urgency_label': 'Orange'}),
    ('update_task_status', {'task_id': TASK_ID, 'status': 'Unknown'}),
    ('create_task', {'title': 'Task', 'company_id': USER_ID, 'department': 'Operations',
                     'start_date': '2026-11-01', 'deadline': '2026-12-01', 'urgency_label': 'Important'}),
    ('list_tasks', {'page_size': 10000}),
])
async def test_invalid_tool_input_never_reaches_api(name, args):
    client = FakeClient()
    with pytest.raises(Exception):
        await server_for(client).call_tool(name, args)
    assert client.calls == []
    assert client.permission_calls == []


@pytest.mark.asyncio
async def test_created_user_password_and_unknown_secrets_never_enter_tool_output():
    client = FakeClient(result={'id': USER_ID, 'username': 'synthetic-agent',
        'generated_password': 'synthetic-generated-password', 'access_token': 'synthetic-secret-token',
        'email': 'synthetic@example.test', 'unexpected_sensitive': 'synthetic-sensitive'})
    result = await server_for(client).call_tool('create_user', {
        'username': 'synthetic-agent', 'email': 'synthetic@example.test', 'first_name': 'Synthetic',
        'last_name': 'Agent', 'user_type': 'Agent', 'parent_id': USER_ID,
    })
    output = str(result)
    assert 'synthetic-generated-password' not in output
    assert 'synthetic-secret-token' not in output
    assert 'synthetic-sensitive' not in output
    assert 'credential_unavailable' in output
    assert client.calls[0][0:2] == ('POST', '/admin/users')


@pytest.mark.asyncio
async def test_forbidden_backend_error_is_not_swallowed_by_tool():
    client = FakeClient(error=APIError('You do not have permission for this operation', 403))
    with pytest.raises(Exception, match='permission|Module access'):
        await server_for(client).call_tool('update_task', {'task_id': TASK_ID, 'deadline': '2026-12-15'})
    assert len(client.calls) == 1


@pytest.mark.asyncio
async def test_same_day_task_without_urgency_and_new_department_passes_exact_assignment():
    client = FakeClient()
    await server_for(client).call_tool('create_task', {
        'title': 'Same day', 'company_id': USER_ID, 'department': 'Εκπαίδευση',
        'start_date': '2026-12-01', 'deadline': '2026-12-01', 'assigned_user_id': USER_ID,
    })
    payload = client.calls[0][2]['json']
    assert payload['department'] == 'Εκπαίδευση'
    assert payload['start_date'] == payload['deadline'] == '2026-12-01'
    assert 'urgency_label' not in payload
    assert payload['assigned_user_id'] == USER_ID
    assert 'assigned_team_id' not in payload


@pytest.mark.asyncio
@pytest.mark.parametrize('permissions', [{}, {'permissions': {}}, {'permissions': {'tasks': 'none'}},
    {'permissions': {'tasks': 'invalid'}}, {'permissions': None}, None, []])
async def test_missing_or_malformed_module_access_blocks_task_writes(permissions):
    client = FakeClient(permission_payload=permissions)
    with pytest.raises(Exception, match='permission|Module access'):
        await server_for(client).call_tool('update_task', {'task_id': TASK_ID, 'deadline': '2026-12-15'})
    assert client.calls == []
    assert len(client.permission_calls) == 1


@pytest.mark.asyncio
async def test_view_access_allows_status_but_prevents_metadata_updates():
    client = FakeClient(permission_payload={'permissions': {'tasks': 'view'}})
    server = server_for(client)
    await server.call_tool('update_task_status', {'task_id': TASK_ID, 'status': 'On Process'})
    with pytest.raises(Exception, match='permission|Module access'):
        await server.call_tool('update_task', {'task_id': TASK_ID, 'deadline': '2026-12-15'})
    assert client.calls == [('PUT', f'/tasks/{TASK_ID}/status', {'json': {'status': 'On Process'}})]
    assert len(client.permission_calls) == 2


@pytest.mark.asyncio
async def test_admin_delete_level_allows_metadata_write_and_checks_current_permissions():
    client = FakeClient(permission_payload={'permissions': {'tasks': 'delete'}})
    server = server_for(client)
    await server.call_tool('update_task', {'task_id': TASK_ID, 'deadline': '2026-12-15'})
    client.permission_payload = {'permissions': {'tasks': 'none'}}
    with pytest.raises(Exception, match='permission|Module access'):
        await server.call_tool('list_tasks', {})
    assert len(client.calls) == 1
    assert len(client.permission_calls) == 2


@pytest.mark.asyncio
async def test_company_lookup_requires_company_module_view_access():
    client = FakeClient(permission_payload={'permissions': {'tasks': 'delete', 'companies': 'none'}})
    server = server_for(client)
    with pytest.raises(Exception, match='permission|Module access'):
        await server.call_tool('list_companies', {})
    assert client.calls == []
    client.permission_payload = {'permissions': {'companies': 'view'}}
    await server.call_tool('list_companies', {})
    assert len(client.calls) == 1
    assert client.calls[0][0:2] == ('GET', '/companies')
    assert len(client.permission_calls) == 2
