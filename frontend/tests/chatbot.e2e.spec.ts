import { test, expect, type Page, type Browser } from '@playwright/test';
import * as path from 'path';

// ── serial mode: all tests share one page so conversation state persists ──
test.describe.configure({ mode: 'serial' });

const RESULTS_DIR = path.join(__dirname, '..', 'test-results');

// ── shared state ──────────────────────────────────────────────────────────
let sharedPage: Page;
const consoleErrors: string[] = [];
const networkFailures: Array<{ url: string; status: number }> = [];

// ── helpers ───────────────────────────────────────────────────────────────

async function login(page: Page): Promise<void> {
  // Navigate to /login first so we get the correct origin in localStorage
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 20000 });

  // Get tokens directly from the API using fetch (avoids form-submit + router.push timing races)
  const tokens = await page.evaluate(async () => {
    const resp = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username_or_email: 'kabaniskostas1998@gmail.com',
        password: 'Administrator',
      }),
    });
    if (!resp.ok) throw new Error(`Login failed: ${resp.status}`);
    return resp.json() as Promise<{ access_token: string; refresh_token: string }>;
  });

  // Inject tokens into localStorage (same origin as the app)
  await page.evaluate((t) => {
    localStorage.setItem('access_token', t.access_token);
    localStorage.setItem('refresh_token', t.refresh_token);
  }, tokens);

  // Navigate directly to /dashboard — AuthContext reads localStorage on mount
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Chatbot button visible confirms auth + app hydration is complete
  await page.locator('button[aria-label="Open assistant"]').waitFor({
    state: 'visible',
    timeout: 25000,
  });
}

async function openPanel(page: Page): Promise<void> {
  const panel = page.locator('aside[aria-label="BWC Assistant chat panel"]');
  const alreadyOpen = await panel.isVisible();
  if (!alreadyOpen) {
    await page.locator('button[aria-label="Open assistant"]').click();
    await panel.waitFor({ state: 'visible', timeout: 10000 });
  }
}

async function sendAndWait(
  page: Page,
  text: string,
  replyTimeout = 20000,
): Promise<string> {
  const textarea = page.locator('textarea');
  await textarea.waitFor({ state: 'visible' });
  await textarea.fill(text);
  await textarea.press('Enter');

  // Confirm our message bubble appeared
  await page
    .locator('.items-end p.whitespace-pre-wrap')
    .filter({ hasText: text })
    .waitFor({ state: 'visible', timeout: 8000 });

  // Count assistant messages before the reply lands
  const assistantMsgs = page.locator('.prose');
  const countBefore = await assistantMsgs.count();

  // Wait for the "Thinking…" indicator to appear then clear
  const thinking = page.locator('[aria-label*="Thinking"]');
  try {
    await thinking.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // indicator may have been too brief to catch — that's fine
  }
  await thinking.waitFor({ state: 'hidden', timeout: replyTimeout });

  // Confirm a new assistant bubble has been added
  await expect(assistantMsgs).toHaveCount(countBefore + 1, { timeout: 10000 });

  return (await assistantMsgs.last().textContent()) ?? '';
}

// ── lifecycle ─────────────────────────────────────────────────────────────

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  test.setTimeout(90000); // login + chatbot warmup on dev server can be slow
  const context = await browser.newContext();
  sharedPage = await context.newPage();

  sharedPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[console.error] ${msg.text()}`);
    }
  });

  sharedPage.on('response', (resp) => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && !url.includes('/docs')) {
      // Skip expected 401 on initial /auth/me unauthenticated probe
      if (status === 401 && url.includes('/auth/me')) return;
      networkFailures.push({ url, status });
    }
  });

  await login(sharedPage);
});

test.afterAll(async () => {
  const dedupedErrors = [...new Set(consoleErrors)];
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  CONSOLE ERRORS (full run, deduplicated)     ║');
  console.log('╚══════════════════════════════════════════════╝');
  if (dedupedErrors.length === 0) {
    console.log('  (none)');
  } else {
    dedupedErrors.forEach((e) => console.log(' ', e));
  }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  NETWORK FAILURES (≥400, excl. auth probes)  ║');
  console.log('╚══════════════════════════════════════════════╝');
  if (networkFailures.length === 0) {
    console.log('  (none)');
  } else {
    networkFailures.forEach((f) => console.log(`  ${f.status}  ${f.url}`));
  }

  await sharedPage.close();
});

// ── tests ─────────────────────────────────────────────────────────────────

test('(a) button visible and position fixed bottom-right', async () => {
  const launcher = sharedPage.locator('button[aria-label="Open assistant"]');
  await expect(launcher).toBeVisible();

  const pos = await sharedPage.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Open assistant"]');
    if (!btn) return null;
    const s = window.getComputedStyle(btn);
    const rect = btn.getBoundingClientRect();
    return {
      position: s.position,
      distFromBottom: window.innerHeight - rect.bottom,
      distFromRight: window.innerWidth - rect.right,
    };
  });

  expect(pos?.position).toBe('fixed');
  expect(pos?.distFromBottom).toBeLessThanOrEqual(40);
  expect(pos?.distFromRight).toBeLessThanOrEqual(40);

  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '01_button_visible.png') });
});

test('(b) panel opens', async () => {
  await openPanel(sharedPage);
  await expect(
    sharedPage.locator('aside[aria-label="BWC Assistant chat panel"]'),
  ).toBeVisible();
  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '02_panel_open.png') });
});

test('(c) empty state visible', async () => {
  await expect(sharedPage.getByText('How can I help you today?')).toBeVisible();
  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '03_empty_state.png') });
});

test('(d) Greek greeting + reply (live LLM)', async () => {
  // Capture the POST to /chatbot/conversations/*/messages
  const responsePromise = sharedPage.waitForResponse(
    (resp) =>
      resp.url().includes('/chatbot') &&
      resp.url().includes('/messages') &&
      resp.request().method() === 'POST',
    { timeout: 35000 },
  );

  const replyText = await sendAndWait(sharedPage, 'Γεια', 30000);
  const apiResp = await responsePromise;

  expect(apiResp.status()).toBe(200);
  // Reply must contain at least one Greek letter
  expect(replyText).toMatch(/[Ͱ-Ͽἀ-῿]/);
  expect(replyText.length).toBeGreaterThan(10);

  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '04_greek_reply.png') });
});

test('(e) KB tool call — empty KB graceful', async () => {
  const reply = await sendAndWait(sharedPage, 'Πώς δημιουργώ task;', 30000);
  expect(reply).toMatch(/Κώστα|Kostas|δεν βρέθηκε|no article|empty|task|Task|δημιουργ/i);
  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '05_kb_search.png') });
});

test('(f) close panel', async () => {
  // Use the close button inside the aside header (not the launcher, which also gets "Close assistant")
  const closeBtn = sharedPage
    .locator('aside[aria-label="BWC Assistant chat panel"]')
    .getByRole('button', { name: 'Close assistant' });
  await closeBtn.click();
  await sharedPage
    .locator('aside[aria-label="BWC Assistant chat panel"]')
    .waitFor({ state: 'hidden', timeout: 5000 });
  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '06_panel_closed.png') });
});

test('(g) reopen — conversation persists', async () => {
  await openPanel(sharedPage);
  // "Γεια" should still be in the messages area
  await expect(sharedPage.locator('.items-end p.whitespace-pre-wrap').first()).toBeVisible();
  await expect(
    sharedPage.locator('.items-end p.whitespace-pre-wrap').filter({ hasText: 'Γεια' }).first(),
  ).toBeVisible();
  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '07_panel_reopened.png') });
});

test('(h) new conversation — empty state returns', async () => {
  const newConvBtn = sharedPage
    .locator('aside')
    .getByRole('button', { name: 'New conversation' });
  await newConvBtn.click();
  // Give context a tick to create new conv and clear messages
  await sharedPage.waitForTimeout(1500);
  await expect(sharedPage.getByText('How can I help you today?')).toBeVisible();
  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '08_new_conversation.png') });
});

test('(i) history dropdown shows previous conversations', async () => {
  const convBtn = sharedPage
    .locator('aside')
    .getByRole('button', { name: 'Conversations' });
  await convBtn.click();

  // The dropdown is the absolute-positioned div that appears below the button
  const dropdown = sharedPage.locator('aside').locator('div[class*="absolute"][class*="top-full"]');
  await expect(dropdown).toBeVisible({ timeout: 5000 });

  const rows = dropdown.locator('ul li button');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThanOrEqual(1);

  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '09_history_open.png') });
});

test('(j) switch back to first conversation', async () => {
  const dropdown = sharedPage.locator('aside').locator('div[class*="absolute"][class*="top-full"]');
  // Click the conversation row whose title contains "Γεια"
  const targetRow = dropdown.locator('button').filter({ hasText: 'Γεια' }).first();
  await targetRow.click();
  // Dropdown should close
  await dropdown.waitFor({ state: 'hidden', timeout: 5000 });
  // "Γεια" message should be visible in the messages area
  await expect(
    sharedPage.locator('.items-end p.whitespace-pre-wrap').filter({ hasText: 'Γεια' }).first(),
  ).toBeVisible();
  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '10_switched.png') });
});

test('(k) markdown rendering — list elements rendered', async () => {
  const newConvBtn = sharedPage
    .locator('aside')
    .getByRole('button', { name: 'New conversation' });
  await newConvBtn.click();
  await sharedPage.waitForTimeout(1000);

  await sendAndWait(
    sharedPage,
    'Δώσε μου μια λίστα markdown με τα 5 statuses των task',
    30000,
  );

  // The ReactMarkdown component renders lists inside .prose
  const listEl = sharedPage.locator('.prose').last().locator('ul, ol').first();
  await expect(listEl).toBeVisible({ timeout: 10000 });

  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '11_markdown.png') });
});

test('(l) no horizontal scroll', async () => {
  const overflow = await sharedPage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '12_no_xscroll.png') });
});

test('(m) mobile viewport — panel full-width, no overflow', async () => {
  await sharedPage.setViewportSize({ width: 390, height: 844 });

  // Re-open the panel (in case viewport resize caused it to be considered off-screen)
  await openPanel(sharedPage);

  const panel = sharedPage.locator('aside[aria-label="BWC Assistant chat panel"]');
  const panelBox = await panel.boundingBox();
  expect(panelBox?.width).toBeGreaterThanOrEqual(380);

  const reply = await sendAndWait(sharedPage, 'Γεια', 30000);
  expect(reply.length).toBeGreaterThan(0);

  const overflowMobile = await sharedPage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflowMobile).toBeLessThanOrEqual(2);

  await sharedPage.screenshot({ path: path.join(RESULTS_DIR, '13_mobile.png') });
});
