import { test, expect, type Page } from '@playwright/test';

// Run against the production export; development mode conceals missing static routes:
// NEXT_PUBLIC_API_URL=http://localhost:8000 npm run build
// python -m http.server 3001 --directory out
// npx playwright test tests/event-detail.spec.ts
const id = '11111111-2222-4333-8444-555555555555';
const event = {
  id, title: 'Static export event regression', location: 'Athens meeting room',
  description: 'Created after the frontend deployment.', event_datetime: '2026-10-20T10:30:00Z',
  owner_user_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  created_at: '2026-10-13T08:00:00Z', updated_at: '2026-10-13T08:00:00Z',
};
const detailUrl = `/events/detail/?id=${id}`;

async function mockSession(page: Page, role: 'Admin' | 'Agent', status = 200) {
  const requests: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'event-regression-token');
    localStorage.setItem('refresh_token', 'event-regression-refresh-token');
    document.cookie = 'NEXT_LOCALE=en;path=/';
  });
  await page.route('**/*', async (route) => {
    // Mock the API origin only; exported RSC files are genuine routing inputs.
    if (new URL(route.request().url()).origin !== 'http://localhost:8000') {
      return route.continue();
    }
    const corsHeaders = {
      'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    };
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue();
    const path = new URL(route.request().url()).pathname.replace(/\/$/, '');
    let body: unknown;
    let code = 200;
    if (path.endsWith('/auth/me')) {
      body = { id: event.owner_user_id, username: 'event-tester', email: 'events@example.test',
        first_name: 'Event', last_name: 'Tester', user_type: role, is_active: true };
    } else if (path.endsWith('/auth/me/module-permissions')) {
      body = { permissions: { tasks: 'view', events: 'view' } };
    } else if (path.endsWith('/profile/me')) {
      body = { language: 'en' };
    } else if (path.endsWith('/events')) {
      body = { events: [event], total: 1, page: 1, page_size: 50 };
    } else if (/\/events\/[^/]+$/.test(path) && !path.endsWith('/events/detail')) {
      requests.push(path);
      code = status;
      body = status === 200 ? event : { detail: status === 403 ? 'You do not have access to this event' : 'Event not found' };
    } else if (path.endsWith('/activity-logs')) {
      body = { logs: [], total: 0, page: 1, page_size: 20 };
    } else if (path.endsWith('/notifications/unread-count')) {
      body = { unread_count: 0 };
    } else if (path.endsWith('/presence')) {
      body = { users: [] };
    } else if (['/admin/branch-heads', '/presence/online', '/departments', '/teams'].some((suffix) => path.endsWith(suffix))) {
      body = [];
    } else {
      // Keep exported RSC and other frontend assets real.
      if (route.request().headers()['rsc'] === '1' || !/^\/(?:auth|profile|presence|notifications|admin|chatbot)(?:\/|$)/.test(path)) {
        return route.continue();
      }
      body = { notifications: [], conversations: [], users: [], messages: [], items: [], total: 0, unread_count: 0 };
    }
    await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(body), headers: corsHeaders });
  });
  return requests;
}

async function expectDetails(page: Page) {
  await expect(page.getByRole('heading', { name: event.title, exact: true })).toBeVisible();
  await expect(page.getByText(event.location, { exact: false })).toBeVisible();
  await expect(page.getByText(event.description, { exact: true })).toBeVisible();
}

async function backToEvents(page: Page) {
  await page.getByRole('button', { name: /Back to Events/ }).click();
  await expect(page).toHaveURL(/\/events\/$/);
  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible();
}

for (const role of ['Admin', 'Agent'] as const) {
  test(`${role} opens an event from the list and can refresh`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const requests = await mockSession(page, role);
    await page.goto('/events/');
    await page.getByRole('heading', { name: event.title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/events/detail/\\?id=${id}$`));
    await expectDetails(page);
    await page.reload();
    await expectDetails(page);
    expect(requests).toContain(`/events/${id}`);
    expect(requests.some((url) => /\/events\/(?:_|null|undefined)$/.test(url))).toBe(false);
    await backToEvents(page);
    expect(errors).toEqual([]);
  });
}

test('event detail opens directly on static hosting', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockSession(page, 'Agent');
  const response = await page.goto(detailUrl);
  expect(response?.status()).toBe(200);
  await expectDetails(page);
  expect(errors).toEqual([]);
});

test('missing event ID avoids requesting a placeholder', async ({ page }) => {
  const requests = await mockSession(page, 'Agent');
  await page.goto('/events/detail/');
  await expect(page.getByText(/missing|no event|event not found/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Back to Events/ })).toBeVisible();
  expect(requests).toEqual([]);
});

for (const status of [403, 404]) {
  test(`API ${status} displays an error and a way back to events`, async ({ page }) => {
    await mockSession(page, 'Agent', status);
    await page.goto(detailUrl);
    const message = status === 403 ? 'You do not have access to this event' : 'Event not found';
    await expect(page.locator('main').getByText(message, { exact: true })).toBeVisible();
    await backToEvents(page);
  });
}
