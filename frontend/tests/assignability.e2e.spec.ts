import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const API_URL = 'http://localhost:8000';
const STATE_PATH = path.resolve(__dirname, '../../backend/scripts/.assignability_test_state.json');

test.use({ baseURL: FRONTEND_URL });
test.describe.configure({ mode: 'serial' });

const consoleErrors: string[] = [];

interface AssignabilityState {
  new_parent_id: string;
  new_parent_email: string;
  new_parent_full_name: string;
}

function loadState(): AssignabilityState {
  const raw = fs.readFileSync(STATE_PATH, 'utf-8');
  return JSON.parse(raw) as AssignabilityState;
}

async function loginAsAgent(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 20000 });

  const tokens = await page.evaluate(async ([apiUrl]) => {
    const resp = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username_or_email: 'phase8_test@example.com',
        password: 'TestAgent123',
      }),
    });
    if (!resp.ok) throw new Error(`Login failed: ${resp.status}`);
    return resp.json() as Promise<{ access_token: string; refresh_token: string }>;
  }, [API_URL]);

  await page.evaluate((t) => {
    localStorage.setItem('access_token', t.access_token);
    localStorage.setItem('refresh_token', t.refresh_token);
  }, tokens);

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForResponse(
    (res) => res.url().includes('/auth/me/module-permissions') && res.status() === 200,
    { timeout: 20000 }
  );
}

test('assignability expansion E2E', async ({ page }) => {
  test.setTimeout(120_000);
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('ws/presence') && !text.includes('WebSocket')) {
        consoleErrors.push(text);
      }
    }
  });

  const state = loadState();
  const parentLabel = state.new_parent_full_name || state.new_parent_email;

  // T1 — Agent login
  await loginAsAgent(page);
  await page.screenshot({ path: 'test-results/assign_01_agent_logged_in.png', fullPage: true });

  // T2 — Open task creation form (agent needs tasks edit permission — granted in setup script)
  await page.goto('/tasks?action=new', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForResponse(
    (res) => res.url().includes('/users/assignable') && res.status() === 200,
    { timeout: 30000 }
  );
  await page.getByText('Create New Task').waitFor({ timeout: 30000 });
  await page.screenshot({ path: 'test-results/assign_02_form_open.png', fullPage: true });

  // T3 — User picker contains new parent (upward)
  const userSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Select User' }) }).first();
  await expect(userSelect).toBeVisible();
  await expect(userSelect.locator('option')).toHaveCount(3, { timeout: 15000 });
  const options = await userSelect.locator('option').allTextContents();
  const hasParent = options.some(
    (o) => o.includes(state.new_parent_email) || o.includes(parentLabel)
  );
  expect(hasParent, `Expected parent in picker. Options: ${options.join(' | ')}`).toBe(true);
  await userSelect.screenshot({ path: 'test-results/assign_03_parent_in_picker.png' });

  // T4 — Department dropdown visible
  const deptSelect = page.locator('label:text-is("Department *"), label:text-is("Department")').first().locator('..').locator('select');
  await expect(deptSelect).toBeVisible();
  const deptOptions = await deptSelect.locator('option').allTextContents();
  expect(deptOptions.length).toBeGreaterThan(0);
  await deptSelect.screenshot({ path: 'test-results/assign_04_department_visible.png' });

  // T5 — Submit upward assignment (scope to modal panel — page filters also have date/company fields)
  const modalPanel = page.locator('div.max-w-2xl');
  await modalPanel.getByPlaceholder('e.g., Review Q3 Financials').fill('E2E upward via UI');

  await modalPanel.locator('label:text-is("Company")').locator('..').locator('select').selectOption({ index: 1 });

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  const deadlineStr = deadline.toISOString().split('T')[0];
  await modalPanel.locator('label:text-is("Deadline *")').locator('..').locator('input[type="date"]').fill(deadlineStr);
  await modalPanel.locator('label:text-is("Urgency Level *")').locator('..').locator('select').selectOption('Not Urgent & Not Important');

  await userSelect.selectOption(state.new_parent_id);

  const createResponse = page.waitForResponse(
    (res) => res.url().includes('/tasks') && res.request().method() === 'POST',
    { timeout: 30000 }
  );
  await page.getByRole('button', { name: /^Create Task$/i }).click();
  const taskRes = await createResponse;
  expect(taskRes.status(), `Task create failed: ${await taskRes.text()}`).toBe(201);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/assign_05_task_submitted.png', fullPage: true });

  const successToast = page.getByText(/task created successfully/i);
  const formClosed = (await page.getByText('Create New Task').count()) === 0;
  expect(
    (await successToast.count()) > 0 || formClosed,
    'Expected success toast or form close after submit'
  ).toBe(true);

  expect(consoleErrors, `Console errors: ${consoleErrors.join('; ')}`).toHaveLength(0);
});
