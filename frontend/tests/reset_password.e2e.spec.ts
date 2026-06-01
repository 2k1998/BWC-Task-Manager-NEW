import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const API_URL = 'http://localhost:8000';

test.use({ baseURL: FRONTEND_URL });
test.describe.configure({ mode: 'serial' });

// Shared state across tests
let generatedPassword = '';
const resetNetworkResponses: { url: string; status: number }[] = [];
const consoleErrors: string[] = [];

// ─── Helper: inject tokens directly to avoid form submit race condition ───────
async function loginAsAdmin(page: import('@playwright/test').Page) {
  const tokens = await page.evaluate(
    async ([apiUrl]) => {
      const r = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username_or_email: 'kabaniskostas1998@gmail.com',
          password: 'Administrator',
        }),
      });
      return r.json() as Promise<{ access_token: string; refresh_token: string }>;
    },
    [API_URL]
  );
  await page.evaluate((t) => {
    localStorage.setItem('access_token', t.access_token);
    localStorage.setItem('refresh_token', t.refresh_token);
  }, tokens);
  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
}

// ─── TEST 1: Login as admin and navigate to users page ────────────────────────
test('1 - Login as admin and load users page', async ({ page }) => {
  // Capture console errors (ignore known WS 403)
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('ws/presence') && !text.includes('WebSocket')) {
        consoleErrors.push(text);
      }
    }
  });

  // Capture reset-password network responses
  page.on('response', (res) => {
    if (res.url().includes('/reset-password')) {
      resetNetworkResponses.push({ url: res.url(), status: res.status() });
    }
  });

  await page.goto('/');
  await loginAsAdmin(page);

  // Wait for tree to render
  await page.waitForSelector('text=phase8_test@example.com', { timeout: 15000 });
  await page.screenshot({ path: 'test-results/reset_01_users_page.png' });

  await expect(page.locator('text=phase8_test@example.com').first()).toBeVisible();
});

// ─── TEST 2: Locate Reset Password button on test agent row ───────────────────
test('2 - Reset Password button visible on test agent row', async ({ page }) => {
  page.on('response', (res) => {
    if (res.url().includes('/reset-password')) {
      resetNetworkResponses.push({ url: res.url(), status: res.status() });
    }
  });

  await page.goto('/');
  await loginAsAdmin(page);
  await page.waitForSelector('text=phase8_test@example.com', { timeout: 15000 });

  // Walk up to the containing row/node from the email text
  const userText = page.locator('text=phase8_test@example.com').first();
  const userRow = userText.locator(
    'xpath=ancestor::*[contains(@class,"flex") and contains(@class,"border-b")][1]'
  );

  // Find Reset Password button within the row
  const resetBtn = userRow.getByRole('button', { name: /reset password/i });

  await expect(resetBtn).toBeVisible();
  await page.screenshot({ path: 'test-results/reset_02_button_visible.png' });
});

// ─── TEST 3: Trigger reset + confirm dialog, modal opens ──────────────────────
test('3 - Confirm dialog fires and password modal opens', async ({ page }) => {
  // Track reset-password responses for TEST 4 assertion
  page.on('response', (res) => {
    if (res.url().includes('/reset-password')) {
      resetNetworkResponses.push({ url: res.url(), status: res.status() });
    }
  });

  await page.goto('/');
  await loginAsAdmin(page);
  await page.waitForSelector('text=phase8_test@example.com', { timeout: 15000 });

  const userText = page.locator('text=phase8_test@example.com').first();
  const userRow = userText.locator(
    'xpath=ancestor::*[contains(@class,"flex") and contains(@class,"border-b")][1]'
  );
  const resetBtn = userRow.getByRole('button', { name: /reset password/i });

  // Register dialog handler BEFORE clicking
  let dialogMessage = '';
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    console.log('Confirm dialog text:', dialogMessage);
    await dialog.accept();
  });

  await resetBtn.click();

  // Wait for the "Password Generated" modal title
  await page.waitForSelector('text=Password Generated', { timeout: 12000 });

  console.log('Dialog message was:', dialogMessage);
  // Dialog uses the user's full_name ("Test User"), not their email
  expect(dialogMessage.length).toBeGreaterThan(10);
  expect(dialogMessage.toLowerCase()).toContain('reset password');

  await page.screenshot({ path: 'test-results/reset_03_modal_open.png' });
});

// ─── TEST 4: Extract generated password from modal ───────────────────────────
test('4 - Extract generated password and verify network call', async ({ page }) => {
  page.on('response', (res) => {
    if (res.url().includes('/reset-password')) {
      resetNetworkResponses.push({ url: res.url(), status: res.status() });
    }
  });

  await page.goto('/');
  await loginAsAdmin(page);
  await page.waitForSelector('text=phase8_test@example.com', { timeout: 15000 });

  const userText = page.locator('text=phase8_test@example.com').first();
  const userRow = userText.locator(
    'xpath=ancestor::*[contains(@class,"flex") and contains(@class,"border-b")][1]'
  );
  const resetBtn = userRow.getByRole('button', { name: /reset password/i });

  page.once('dialog', (d) => d.accept());
  await resetBtn.click();

  // Wait for modal
  await page.waitForSelector('text=Password Generated', { timeout: 12000 });

  // Password is rendered in a font-mono div (not an input or code tag)
  // Try multiple selectors in priority order
  let pwd = '';

  // Strategy 1: div with font-mono class containing the password
  const monoDiv = page.locator('div.font-mono, [class*="font-mono"]').first();
  if (await monoDiv.isVisible()) {
    pwd = (await monoDiv.textContent()) ?? '';
    pwd = pwd.trim();
  }

  // Strategy 2: readonly input
  if (!pwd || pwd.length < 8) {
    const readonlyInput = page.locator('input[readonly]').first();
    if (await readonlyInput.isVisible()) {
      pwd = await readonlyInput.inputValue();
    }
  }

  // Strategy 3: code or pre
  if (!pwd || pwd.length < 8) {
    const codePre = page.locator('code, pre').filter({ hasText: /\S{8,}/ }).first();
    if (await codePre.isVisible()) {
      pwd = (await codePre.textContent()) ?? '';
      pwd = pwd.trim();
    }
  }

  console.log(`Generated password: "${pwd}" (length=${pwd.length})`);
  generatedPassword = pwd;

  expect(pwd.length).toBeGreaterThanOrEqual(8);
  expect(pwd).not.toContain(' ');

  // Network assertion: at least one /reset-password call returned 200
  const resetCall = resetNetworkResponses.find(
    (r) => r.url.match(/admin\/users\/.+\/reset-password/) && r.status === 200
  );
  expect(resetCall, 'Expected a 200 response from /reset-password').toBeTruthy();
  console.log('Network call confirmed:', resetCall);

  // Close the modal (click the "I have copied the password" button)
  await page.getByRole('button', { name: /copied the password/i }).click();
  await page.waitForSelector('text=Password Generated', { state: 'hidden', timeout: 8000 });

  await page.screenshot({ path: 'test-results/reset_04_modal_closed.png' });
});

// ─── TEST 5: New password actually works for login ────────────────────────────
test('5 - Generated password works for test agent login', async ({ page }) => {
  // generatedPassword is captured from TEST 4 — if it's empty (serial failure),
  // skip rather than assert a false negative
  test.skip(!generatedPassword, 'Skipped: no generated password captured from TEST 4');

  console.log(`Verifying login with password: "${generatedPassword}"`);

  // Direct API call to verify the password works (avoids form submit race condition documented in CLAUDE.md)
  const result = await page.evaluate(
    async ([apiUrl, email, pwd]) => {
      try {
        const r = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username_or_email: email, password: pwd }),
        });
        const body = await r.json();
        return { status: r.status, hasAccessToken: !!body.access_token, detail: body.detail ?? null };
      } catch (e: unknown) {
        return { status: 0, hasAccessToken: false, detail: String(e) };
      }
    },
    [API_URL, 'phase8_test@example.com', generatedPassword]
  );

  console.log('Login API result:', JSON.stringify(result));
  expect(result.status, `Expected 200 from /auth/login, got ${result.status}. Detail: ${result.detail}`).toBe(200);
  expect(result.hasAccessToken, 'Expected access_token in response').toBe(true);

  // Bonus: inject the token and verify the dashboard loads
  // Must navigate to a page first so localStorage is accessible (not about:blank)
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  const tokens = await page.evaluate(
    async ([apiUrl, email, pwd]) => {
      const r = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: email, password: pwd }),
      });
      return r.json() as Promise<{ access_token: string; refresh_token: string }>;
    },
    [API_URL, 'phase8_test@example.com', generatedPassword]
  );

  await page.evaluate((t) => {
    localStorage.setItem('access_token', t.access_token);
    localStorage.setItem('refresh_token', t.refresh_token);
  }, tokens);

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  const finalUrl = page.url();
  console.log('After injecting new password token, ended up at:', finalUrl);

  // Should be on dashboard or some authenticated page (not redirected back to login)
  expect(finalUrl).not.toContain('/login');

  await page.screenshot({ path: 'test-results/reset_05_login_with_new_pwd.png' });
});
