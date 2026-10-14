import { test, expect, type Page } from '@playwright/test';

const taskId = '11111111-2222-4333-8444-555555555555';
const ownerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const assigneeId = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const title = 'Existing task deadline regression';

// Stateful API fixtures verify what the browser saves and subsequently reads.
async function mockTasks(page: Page, mode: 'owner' | 'admin' | 'assignee' | 'completed' | 'orange' = 'owner') {
  let task = {
    id: taskId, title, description: 'Keep this description', department: 'Operations',
    urgency_label: mode === 'orange' ? 'Orange' : 'Important', status: mode === 'completed' ? 'Completed' : 'Received',
    owner_user_id: ownerId, assigned_user_id: assigneeId, assigned_team_id: null,
    start_date: '2026-10-14T00:00:00Z', deadline: mode === 'orange' ? '2026-10-14T00:00:00Z' : '2026-10-20T00:00:00Z',
    created_at: '2026-10-14T08:00:00Z', assigned_user_name: 'Assigned User', created_by_name: 'Owner User',
  };
  const updates: Record<string, unknown>[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'deadline-test-token');
    localStorage.setItem('refresh_token', 'deadline-test-refresh');
    document.cookie = 'NEXT_LOCALE=en;path=/';
  });
  await page.route('**/*', async route => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue();
    const url = new URL(route.request().url());
    if (url.port !== '8000') return route.continue();
    const path = url.pathname.replace(/\/$/, '');
    let body: unknown;
    if (path.endsWith(`/tasks/${taskId}`)) {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON();
        updates.push(payload);
        if (payload.urgency_label === 'Orange') {
          await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid urgency label' }) });
          return;
        }
        task = { ...task, ...payload };
      }
      body = task;
    } else if (path.endsWith('/auth/me/module-permissions')) {
      body = { permissions: { tasks: 'edit' } };
    } else if (path.endsWith('/auth/me')) {
      body = { id: mode === 'owner' || mode === 'completed' || mode === 'orange' ? ownerId : assigneeId,
        username: 'deadline-test', email: 'deadline@example.test', first_name: 'Test', last_name: 'User',
        user_type: mode === 'admin' ? 'Admin' : 'Agent', is_active: true };
    } else if (path.endsWith('/profile/me')) body = { language: 'en' };
    else if (path.endsWith('/tasks')) body = { tasks: [task], total: 1, page: 1, page_size: 100 };
    else if (path.endsWith('/teams')) body = { teams: [] };
    else if (path.endsWith('/departments')) body = [{ id: '1', name: 'Operations' }, { id: '2', name: 'Εκπαίδευση' }];
    else if (path.endsWith('/companies')) body = { companies: [{ id: '1', name: 'BWC' }] };
    else if (path.endsWith('/users/assignable')) body = [{ id: assigneeId, first_name: 'Assigned', last_name: 'User' }];
    else if (path.endsWith('/documents') || path.endsWith('/comments') || path.endsWith('/admin/branch-heads')) body = [];
    else if (path.endsWith('/activity-logs')) body = { logs: [], total: 0 };
    else if (path.endsWith('/notifications/unread-count')) body = { unread_count: 0 };
    else if (path.endsWith('/presence')) body = { users: [] };
    else return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return updates;
}

async function openTask(page: Page) {
  await page.getByText(title, { exact: true }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Task details' });
  await expect(dialog.getByRole('heading', { name: title })).toBeVisible();
  return dialog;
}

for (const mode of ['owner', 'admin', 'orange'] as const) {
  test(`${mode} can update only the deadline and see it after reopening`, async ({ page }) => {
    const updates = await mockTasks(page, mode);
    await page.goto('/tasks/');
    const dialog = await openTask(page);
    if (mode === 'orange') await expect(dialog.getByText('Orange', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(dialog.getByLabel('Due date')).toHaveValue(mode === 'orange' ? '2026-10-14' : '2026-10-20');
    await dialog.getByLabel('Due date').fill('2026-11-05');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    expect(updates).toEqual([{ deadline: '2026-11-05' }]);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await openTask(page);
    await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(dialog.getByLabel('Due date')).toHaveValue('2026-11-05');
  });
}

test('invalid dates do not save; cancel restores the persisted deadline', async ({ page }) => {
  const updates = await mockTasks(page);
  await page.goto('/tasks/');
  const dialog = await openTask(page);
  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.getByLabel('Due date').fill('');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Due date is required', { exact: true })).toBeVisible();
  await dialog.getByLabel('Due date').fill('2026-10-13');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Deadline cannot be before start date', { exact: true })).toBeVisible();
  expect(updates).toEqual([]);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(dialog.getByLabel('Due date')).toHaveValue('2026-10-20');
});

test('assignee may edit status but cannot edit the deadline', async ({ page }) => {
  const updates = await mockTasks(page, 'assignee');
  await page.goto('/tasks/');
  const dialog = await openTask(page);
  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(dialog.locator('select')).toHaveCount(1);
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
  expect(updates).toEqual([]);
});

test('completed task does not expose editing controls', async ({ page }) => {
  await mockTasks(page, 'completed');
  await page.goto('/tasks/');
  const dialog = await openTask(page);
  await expect(dialog.getByText('This task is completed and cannot be edited.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
});

test('task creation department dropdown offers both added departments', async ({ page }) => {
  await mockTasks(page);
  await page.goto('/tasks/?action=new');
  const department = page.locator('select').filter({ has: page.locator('option', { hasText: /^Operations$/ }) });
  await expect(department).toBeVisible();
  await department.selectOption({ label: 'Operations' });
  await expect(department).toHaveValue('Operations');
  await department.selectOption({ label: 'Εκπαίδευση' });
  await expect(department).toHaveValue('Εκπαίδευση');
});
