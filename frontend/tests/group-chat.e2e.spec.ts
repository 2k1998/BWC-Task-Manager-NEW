import { test, expect, type Page } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8000';
const ADMIN_EMAIL = 'kabaniskostas1998@gmail.com';
const ADMIN_PASSWORD = 'Administrator';
const AGENT_EMAIL = 'phase8_test@example.com';
const AGENT_PASSWORD = 'TestAgent123';

const GROUP_NAME = `E2E Group ${Date.now()}`;

// UI strings may render in English or Greek depending on the profile language.
const RX_NEW_GROUP = /New Group|Νέα Ομάδα/;
const RX_CREATE_GROUP = /Create Group|Δημιουργία Ομάδας/;
const RX_MEMBERS_COUNT = /3 (members|μέλη)/;
const RX_SEARCH_USER = /Search user|Αναζήτηση χρήστη/;
const RX_TYPE_MESSAGE = /Type a message|Γράψτε ένα μήνυμα/;
const RX_OWNER = /Owner|Ιδιοκτήτης/;

test.describe.configure({ mode: 'serial' });

interface Participant {
  id: string;
  full_name: string;
  email: string;
}

let participants: Participant[] = [];
let agentName = '';

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
        throw new Error(`Login failed for ${username}: ${resp.status} ${await resp.text()}`);
      }
      return resp.json() as Promise<{ access_token: string; refresh_token: string }>;
    },
    [API_URL, email, password],
  );

  await page.evaluate((t) => {
    localStorage.setItem('access_token', t.access_token);
    localStorage.setItem('refresh_token', t.refresh_token);
  }, tokens);
}

async function openChat(page: Page) {
  await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 30000 });
  // The persistent New Group button renders once the chat page is mounted.
  await expect(page.getByRole('button', { name: RX_NEW_GROUP })).toBeVisible({ timeout: 30000 });
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await browser.newPage();
  try {
    await loginWithCredentials(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Pick the known test agent plus one more assignable user for the group.
    // Small orgs may only have admin + agent, so create a third user if needed.
    const result = await page.evaluate(
      async ([apiUrl, agentEmail]) => {
        const token = localStorage.getItem('access_token');
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        const meRes = await fetch(`${apiUrl}/auth/me`, { headers });
        const me = await meRes.json();

        const loadAssignable = async () => {
          const res = await fetch(`${apiUrl}/users/assignable`, { headers });
          if (!res.ok) throw new Error(`assignable failed: ${res.status}`);
          return (await res.json()) as Array<{ id: string; full_name: string; email: string }>;
        };

        let users = await loadAssignable();
        const agent = users.find((u) => u.email === agentEmail);
        let other = users.find((u) => u.id !== me.id && u.email !== agentEmail);

        if (agent && !other) {
          const suffix = Date.now();
          const createRes = await fetch(`${apiUrl}/admin/users`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              email: `e2e_chat_member_${suffix}@example.com`,
              username: `e2e_chat_${suffix}`,
              first_name: 'E2E',
              last_name: 'Member',
              user_type: 'Agent',
              parent_id: me.id,
            }),
          });
          if (!createRes.ok) {
            throw new Error(`user create failed: ${createRes.status} ${await createRes.text()}`);
          }
          users = await loadAssignable();
          other = users.find((u) => u.id !== me.id && u.email !== agentEmail);
        }

        return { agent, other };
      },
      [API_URL, AGENT_EMAIL],
    );

    if (!result.agent || !result.other) {
      throw new Error('Need the test agent plus one more assignable user for group chat e2e');
    }
    participants = [result.agent, result.other];
    agentName = result.agent.full_name;
  } finally {
    await page.close();
  }
});

test('Scenario 1 — create a group via the New Group modal', async ({ page }) => {
  test.setTimeout(90_000);
  await loginWithCredentials(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openChat(page);

  await page.getByRole('button', { name: RX_NEW_GROUP }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });

  await modal.locator('input[maxlength="200"]').fill(GROUP_NAME);

  for (const participant of participants) {
    const picker = modal.getByPlaceholder(RX_SEARCH_USER);
    await picker.fill(participant.full_name);
    const nameRx = new RegExp(participant.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    await modal.locator('ul').getByRole('button', { name: nameRx }).first().click();
  }

  // Dismiss the user-picker dropdown (its click-outside backdrop absorbs one click).
  const backdrop = page.locator('div.fixed.inset-0.z-10');
  if (await backdrop.isVisible()) {
    await backdrop.click();
  }

  await modal.getByRole('button', { name: RX_CREATE_GROUP }).click();

  // The new group becomes the selected thread.
  await expect(page.getByRole('heading', { name: GROUP_NAME })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: RX_MEMBERS_COUNT })).toBeVisible();

  // Members panel lists all three with an owner badge.
  await page.getByRole('button', { name: RX_MEMBERS_COUNT }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(RX_OWNER)).toBeVisible();
  await expect(panel.getByText(agentName).first()).toBeVisible();
});

test('Scenario 2 — send a message in the group', async ({ page }) => {
  test.setTimeout(90_000);
  await loginWithCredentials(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openChat(page);

  await page.getByText(GROUP_NAME, { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: GROUP_NAME })).toBeVisible({ timeout: 15000 });

  const message = `Hello team ${Date.now()}`;
  const input = page.getByPlaceholder(RX_TYPE_MESSAGE);
  await input.fill(message);
  await input.press('Enter');

  await expect(page.getByText(message, { exact: true })).toBeVisible({ timeout: 15000 });
});

test('Scenario 3 — incoming group messages show the sender name', async ({ page }) => {
  test.setTimeout(120_000);

  // The agent (a group member) sends a message.
  await loginWithCredentials(page, AGENT_EMAIL, AGENT_PASSWORD);
  await openChat(page);
  await page.getByText(GROUP_NAME, { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: GROUP_NAME })).toBeVisible({ timeout: 15000 });

  const agentMessage = `Hello from agent ${Date.now()}`;
  const agentInput = page.getByPlaceholder(RX_TYPE_MESSAGE);
  await agentInput.fill(agentMessage);
  await agentInput.press('Enter');
  await expect(page.getByText(agentMessage, { exact: true })).toBeVisible({ timeout: 15000 });

  // The admin sees the message attributed to the agent by name.
  await loginWithCredentials(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openChat(page);
  await page.getByText(GROUP_NAME, { exact: true }).first().click();

  const bubble = page.locator('div.max-w-\\[70\\%\\]').filter({ hasText: agentMessage });
  await expect(bubble).toBeVisible({ timeout: 15000 });
  const senderLabel = bubble.locator('span.text-xs.font-medium');
  await expect(senderLabel).toBeVisible();
  const nameRx = new RegExp(agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  await expect(senderLabel).toHaveText(nameRx);
});
