import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:8000';
const AGENT_EMAIL = 'phase8_test@example.com';
const AGENT_PASSWORD = 'TestAgent123';
const ADMIN_EMAIL = 'kabaniskostas1998@gmail.com';
const ADMIN_PASSWORD = 'Administrator';
const ASSIGNABILITY_STATE_PATH = path.resolve(
  __dirname,
  '../../backend/scripts/.assignability_test_state.json',
);

const TASK_TITLE_PREFIX = 'E2E attachment download';
const ATTACHMENT_FILENAME = 'e2e-task-attachment.txt';

test.describe.configure({ mode: 'serial' });

interface TaskFixture {
  taskId: string;
  taskTitle: string;
  filename: string;
  documentId: string;
  assigneeId: string;
  ownerId: string;
}

let fixture: TaskFixture;

async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 20000 });

  const tokens = await page.evaluate(
    async ([apiUrl, username, pwd]) => {
      const resp = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: username, password: pwd }),
      });
      if (!resp.ok) {
        const detail = await resp.text();
        throw new Error(`Login failed for ${username}: ${resp.status} ${detail}`);
      }
      return resp.json() as Promise<{ access_token: string; refresh_token: string }>;
    },
    [API_URL, email, password],
  );

  await page.evaluate((t) => {
    localStorage.setItem('access_token', t.access_token);
    localStorage.setItem('refresh_token', t.refresh_token);
  }, tokens);

  await page.goto('/tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForResponse(
    (res) => res.url().includes('/tasks') && res.request().method() === 'GET' && res.status() === 200,
    { timeout: 30000 },
  );
}

async function openTaskInDrawer(page: Page, taskTitle: string) {
  await page.goto('/tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForResponse(
    (res) => res.url().includes('/tasks') && res.request().method() === 'GET' && res.status() === 200,
    { timeout: 30000 },
  );

  const taskLink = page.getByText(taskTitle, { exact: true }).first();
  await expect(taskLink).toBeVisible({ timeout: 20000 });
  await taskLink.click();

  await expect(page.getByRole('heading', { name: 'Attachments' })).toBeVisible({ timeout: 20000 });
}

function attachmentTable(page: Page) {
  return page.locator('table').filter({ has: page.locator('th', { hasText: 'File' }) });
}

function firstAttachmentRow(page: Page) {
  return attachmentTable(page).locator('tbody tr').first();
}

async function ensureTaskWithAttachment(page: Page): Promise<TaskFixture> {
  await loginWithCredentials(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  const created = await page.evaluate(
    async ([apiUrl, agentEmail, titlePrefix]) => {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error('Missing access token');

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const usersRes = await fetch(`${apiUrl}/users?query=${encodeURIComponent(agentEmail)}&limit=20`, {
        headers,
      });
      if (!usersRes.ok) throw new Error(`Users search failed: ${usersRes.status}`);
      const usersPayload = await usersRes.json();
      const agent = (usersPayload.users || []).find((u: { email: string }) => u.email === agentEmail);
      if (!agent) throw new Error(`Agent not found: ${agentEmail}`);

      const companiesRes = await fetch(`${apiUrl}/companies?limit=1`, { headers });
      if (!companiesRes.ok) throw new Error(`Companies list failed: ${companiesRes.status}`);
      const companiesPayload = await companiesRes.json();
      const company = companiesPayload.companies?.[0];
      if (!company) throw new Error('No company available for task creation');

      const deptsRes = await fetch(`${apiUrl}/departments?limit=1`, { headers });
      if (!deptsRes.ok) throw new Error(`Departments list failed: ${deptsRes.status}`);
      const deptsPayload = await deptsRes.json();
      const department = deptsPayload?.[0]?.name;
      if (!department) throw new Error('No department available for task creation');

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 14);
      const start = new Date();
      const taskTitle = `${titlePrefix} ${Date.now()}`;

      const createRes = await fetch(`${apiUrl}/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: taskTitle,
          description: 'Playwright task attachment download test',
          company_id: company.id,
          department,
          urgency_label: 'Not Urgent & Not Important',
          start_date: start.toISOString().split('T')[0],
          deadline: deadline.toISOString().split('T')[0],
          assigned_user_id: agent.id,
        }),
      });
      if (!createRes.ok) {
        throw new Error(`Task create failed: ${createRes.status} ${await createRes.text()}`);
      }
      const task = await createRes.json();

      return {
        taskId: task.id as string,
        taskTitle,
        assigneeId: agent.id as string,
        ownerId: task.owner_user_id as string,
      };
    },
    [API_URL, AGENT_EMAIL, TASK_TITLE_PREFIX],
  );

  await loginWithCredentials(page, AGENT_EMAIL, AGENT_PASSWORD);

  const uploaded = await page.evaluate(
    async ([apiUrl, taskId, filename]) => {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error('Missing agent access token');

      const formData = new FormData();
      formData.append(
        'file',
        new File(['e2e attachment content'], filename, { type: 'text/plain' }),
      );

      const uploadRes = await fetch(`${apiUrl}/tasks/${taskId}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        throw new Error(`Attachment upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
      }
      const attachment = await uploadRes.json();
      return {
        documentId: attachment.document_id as string,
        filename: attachment.filename as string,
      };
    },
    [API_URL, created.taskId, ATTACHMENT_FILENAME],
  );

  return {
    ...created,
    filename: uploaded.filename,
    documentId: uploaded.documentId,
  };
}

function resolveObserverCredentials(): { email: string; password: string } | null {
  const envEmail = process.env.E2E_OBSERVER_EMAIL;
  const envPassword = process.env.E2E_OBSERVER_PASSWORD;
  if (envEmail && envPassword) {
    return { email: envEmail, password: envPassword };
  }

  if (!fs.existsSync(ASSIGNABILITY_STATE_PATH)) {
    return null;
  }

  try {
    const state = JSON.parse(fs.readFileSync(ASSIGNABILITY_STATE_PATH, 'utf-8')) as {
      new_parent_email?: string;
    };
    if (state.new_parent_email && state.new_parent_email !== ADMIN_EMAIL) {
      return { email: state.new_parent_email, password: AGENT_PASSWORD };
    }
  } catch {
    return null;
  }

  return null;
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage();
  try {
    fixture = await ensureTaskWithAttachment(page);
  } finally {
    await page.close();
  }
});

test('Scenario 1 — download button visible for assigned user', async ({ page }) => {
  test.setTimeout(90_000);
  await loginWithCredentials(page, AGENT_EMAIL, AGENT_PASSWORD);
  await openTaskInDrawer(page, fixture.taskTitle);

  const row = firstAttachmentRow(page);
  await expect(row.getByRole('button', { name: /^Download / })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Remove' })).toBeVisible();
});

test('Scenario 2 — download button triggers a file download', async ({ page }) => {
  test.setTimeout(90_000);
  await loginWithCredentials(page, AGENT_EMAIL, AGENT_PASSWORD);
  await openTaskInDrawer(page, fixture.taskTitle);

  const downloadBtn = firstAttachmentRow(page).getByRole('button', { name: /^Download / });
  const downloadPromise = page.waitForEvent('download');
  await downloadBtn.click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBeTruthy();
  await expect(firstAttachmentRow(page).locator('p.text-red-600')).toHaveCount(0);
});

test('Scenario 3 — loading state appears during download', async ({ page }) => {
  test.setTimeout(90_000);
  await loginWithCredentials(page, AGENT_EMAIL, AGENT_PASSWORD);
  await openTaskInDrawer(page, fixture.taskTitle);

  const downloadBtn = firstAttachmentRow(page).getByRole('button', { name: /^Download / });

  await page.route(`**/documents/${fixture.documentId}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  const downloadPromise = page.waitForEvent('download');
  await downloadBtn.click();

  await expect(downloadBtn).toBeDisabled();
  await expect(downloadBtn.locator('.animate-spin')).toBeVisible();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBeTruthy();

  await page.unroute(`**/documents/${fixture.documentId}`);
});

test('Scenario 4 — wrong user gets 403 handled gracefully', async ({ page }) => {
  test.setTimeout(90_000);

  const observer = resolveObserverCredentials();
  if (!observer) {
    test.skip(true, 'No observer credentials — set E2E_OBSERVER_EMAIL/PASSWORD or run assignability setup');
    return;
  }

  if (observer.email === AGENT_EMAIL || observer.email === ADMIN_EMAIL) {
    test.skip(true, 'Observer must be a non-assignee user with task visibility');
    return;
  }

  try {
    await loginWithCredentials(page, observer.email, observer.password);
  } catch {
    test.skip(true, `Could not log in as observer (${observer.email})`);
    return;
  }

  await page.goto('/tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForResponse(
    (res) => res.url().includes('/tasks') && res.request().method() === 'GET' && res.status() === 200,
    { timeout: 30000 },
  );

  const taskVisible = await page.getByText(fixture.taskTitle, { exact: true }).count();
  if (taskVisible === 0) {
    test.skip(true, 'Task not visible to observer due to branch isolation');
    return;
  }

  await openTaskInDrawer(page, fixture.taskTitle);

  const row = firstAttachmentRow(page);
  const downloadBtn = row.getByRole('button', { name: /^Download / });
  const downloadVisible = await downloadBtn.isVisible();

  if (!downloadVisible) {
    await expect(downloadBtn).toHaveCount(0);
    return;
  }

  await downloadBtn.click();
  await expect(row.locator('p.text-red-600')).toBeVisible({ timeout: 15000 });
  await expect(row.locator('p.text-red-600')).not.toHaveText('');
});
