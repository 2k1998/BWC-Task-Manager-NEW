import { test, expect, type Page, type Route } from '@playwright/test';

const car = { id: 'car-101', license_plate: 'BWC-101', make: 'Toyota', model: 'Yaris', year: 2024, status: 'available' };
const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...car, id: `car-${index}`, license_plate: `BWC-${index}` }));
const savedPayment = {
  id: 'payment-1', title: 'Rental income', description: '', amount: 120, currency: 'EUR',
  payment_type: 'service', payment_date: '2026-10-09', is_income: true,
  income_source: 'car_rental', car_id: car.id, company_id: 'company-1', created_by_user_id: 'user-1',
};

type FixtureOptions = { edit?: boolean; carsPermission?: boolean; failPageTwo?: boolean; emptyCars?: boolean; missingCar?: boolean };

async function mockApp(page: Page, options: FixtureOptions = {}) {
  const requests: number[] = [];
  const writes: Record<string, unknown>[] = [];
  let failPageTwo = !!options.failPageTwo;
  const user = { id: 'user-1', email: 'test@example.com', username: 'tester', first_name: 'Test', last_name: 'User', user_type: options.carsPermission === false ? 'Agent' : 'Admin', is_active: true };
  const fulfill = (route: Route, data: unknown, status = 200) => route.fulfill({
    status, contentType: 'application/json', body: JSON.stringify(data),
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
  });
  await page.context().addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3001' }]);
  await page.addInitScript(() => localStorage.setItem('access_token', 'local-test-token'));
  await page.route('http://localhost:8000/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return fulfill(route, {}, 204);
    if (url.pathname === '/auth/me') return fulfill(route, user);
    if (url.pathname === '/auth/me/module-permissions') return fulfill(route, { permissions: { payments: 'edit', companies: 'view', cars: options.carsPermission === false ? 'none' : 'view' } });
    if (url.pathname === '/profile/me') return fulfill(route, { ...user, language: 'en' });
    if (url.pathname === '/companies') return fulfill(route, { companies: [{ id: 'company-1', name: 'BWC' }], total: 1 });
    if (url.pathname === '/admin/users') return fulfill(route, { users: [user] });
    if (url.pathname === '/cars') {
      const pageNumber = Number(url.searchParams.get('page'));
      requests.push(pageNumber);
      if (pageNumber === 2 && failPageTwo) return fulfill(route, { detail: 'Unavailable' }, 503);
      return fulfill(route, { cars: options.emptyCars ? [] : pageNumber === 1 ? firstPage : options.missingCar ? [{ ...car, id: 'other-car' }] : [car], page: pageNumber, page_size: 100, total: options.emptyCars ? 0 : 101 });
    }
    if (url.pathname === '/payments/summary') return fulfill(route, { total_income: 120, total_expenses: 0, net_balance: 120 });
    if (url.pathname.startsWith('/payments') && ['POST', 'PUT'].includes(request.method())) {
      const payload = request.postDataJSON();
      writes.push(payload);
      return fulfill(route, { ...savedPayment, ...payload }, request.method() === 'POST' ? 201 : 200);
    }
    if (url.pathname === '/payments') return fulfill(route, { payments: options.edit ? [savedPayment] : [], total: options.edit ? 1 : 0, page: 1, page_size: 100 });
    if (['/departments', '/admin/branch-heads', '/teams', '/presence/online'].includes(url.pathname)) return fulfill(route, []);
    return fulfill(route, { notifications: [], conversations: [], users: [], messages: [], items: [], total: 0, unread_count: 0 });
  });
  await page.goto('/payments', { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (options.edit) await page.getByRole('button', { name: 'Edit', exact: true }).last().click();
  else await page.getByRole('button', { name: 'Add Payment', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByPlaceholder('e.g. May Salary')).toBeVisible();
  return { modal, requests, writes, recover: () => { failPageTwo = false; } };
}

async function fillRequired(page: Page) {
  const modal = page.getByRole('dialog');
  await modal.getByPlaceholder('e.g. May Salary').fill('Car proceeds');
  await modal.getByPlaceholder('0.00').fill('120');
  await modal.locator('select').filter({ has: page.locator('option[value="service"]') }).selectOption('service');
  await modal.locator('select').filter({ has: page.locator('option[value="company-1"]') }).selectOption('company-1');
}

for (const source of ['car_rental', 'car_sale']) {
  test(`creates ${source} income with a car from page two`, async ({ page }) => {
    const fixture = await mockApp(page);
    await fillRequired(page);
    await fixture.modal.getByRole('switch', { name: 'Is income?' }).click();
    await fixture.modal.getByRole('combobox', { name: 'Income source' }).selectOption(source);
    const cars = fixture.modal.getByRole('combobox', { name: 'Car *', exact: true });
    await expect(cars).toBeEnabled();
    await expect(cars.locator('option')).toHaveCount(102);
    await expect(cars.locator(`option[value="${car.id}"]`)).toHaveText('BWC-101 · Toyota Yaris');
    await expect(fixture.modal.getByRole('button', { name: 'Create Payment', exact: true })).toBeDisabled();
    await cars.selectOption(car.id);
    if (source === 'car_rental' && process.env.PAYMENT_SCREENSHOT_PATH) {
      await fixture.modal.screenshot({ path: process.env.PAYMENT_SCREENSHOT_PATH });
    }
    await fixture.modal.getByRole('button', { name: 'Create Payment', exact: true }).click();
    await expect.poll(() => fixture.writes.length).toBe(1);
    expect(fixture.writes[0]).toMatchObject({ income_source: source, car_id: car.id, is_income: true });
    expect(fixture.requests).toEqual([1, 2]);
  });
}

test('blocks incomplete car lists and retries both pages', async ({ page }) => {
  const fixture = await mockApp(page, { failPageTwo: true });
  await fillRequired(page);
  await fixture.modal.getByRole('switch', { name: 'Is income?' }).click();
  await fixture.modal.getByRole('combobox', { name: 'Income source' }).selectOption('car_rental');
  await expect(fixture.modal.getByText('Could not load cars. Try again.')).toBeVisible();
  await expect(fixture.modal.getByRole('button', { name: 'Create Payment', exact: true })).toBeDisabled();
  await expect(fixture.modal.getByRole('combobox', { name: 'Car *', exact: true })).toBeDisabled();
  fixture.recover();
  await fixture.modal.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(fixture.modal.getByRole('combobox', { name: 'Car *', exact: true })).toBeEnabled();
  expect(fixture.requests).toEqual([1, 2, 1, 2]);
});

for (const clearWith of ['Other', 'Expense']) {
  test(`clears persisted car metadata when switching to ${clearWith}`, async ({ page }) => {
    const fixture = await mockApp(page, { edit: true });
    await expect(fixture.modal.getByRole('combobox', { name: 'Income source' })).toHaveValue('car_rental');
    await expect(fixture.modal.getByRole('combobox', { name: 'Car *', exact: true })).toHaveValue(car.id);
    if (clearWith === 'Other') await fixture.modal.getByRole('combobox', { name: 'Income source' }).selectOption('');
    else await fixture.modal.getByRole('switch', { name: 'Is income?' }).click();
    await expect(fixture.modal.getByRole('combobox', { name: 'Car *', exact: true })).toHaveCount(0);
    await fixture.modal.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect.poll(() => fixture.writes.length).toBe(1);
    expect(fixture.writes[0]).toMatchObject({ income_source: null, car_id: null, is_income: clearWith === 'Other' });
  });
}

test('restores and saves an existing car association', async ({ page }) => {
  const fixture = await mockApp(page, { edit: true });
  await expect(fixture.modal.getByRole('combobox', { name: 'Car *', exact: true })).toHaveValue(car.id);
  await fixture.modal.getByPlaceholder('e.g. May Salary').fill('Updated rental title');
  await fixture.modal.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect.poll(() => fixture.writes.length).toBe(1);
  expect(fixture.writes[0]).toMatchObject({ income_source: 'car_rental', car_id: car.id, title: 'Updated rental title' });
});

test('preserves an existing car link when Cars permission was removed', async ({ page }) => {
  const fixture = await mockApp(page, { edit: true, carsPermission: false });
  await expect(fixture.modal.getByRole('combobox', { name: 'Car *', exact: true })).toHaveValue(car.id);
  await expect(fixture.modal.getByRole('combobox', { name: 'Car *', exact: true })).toBeDisabled();
  await fixture.modal.getByPlaceholder('e.g. May Salary').fill('Title correction');
  await fixture.modal.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect.poll(() => fixture.writes.length).toBe(1);
  expect(fixture.writes[0]).toMatchObject({ income_source: 'car_rental', car_id: car.id, title: 'Title correction' });
  expect(fixture.requests).toEqual([]);
});

test('blocks a new car link without Cars permission', async ({ page }) => {
  const fixture = await mockApp(page, { carsPermission: false });
  await fillRequired(page);
  await fixture.modal.getByRole('switch', { name: 'Is income?' }).click();
  await fixture.modal.getByRole('combobox', { name: 'Income source' }).selectOption('car_sale');
  await expect(fixture.modal.getByText(/You need Cars access/)).toBeVisible();
  await expect(fixture.modal.getByRole('button', { name: 'Create Payment', exact: true })).toBeDisabled();
  expect(fixture.requests).toEqual([]);
});

test('blocks unavailable saved cars until replaced', async ({ page }) => {
  const fixture = await mockApp(page, { edit: true, missingCar: true });
  await expect(fixture.modal.getByText('The saved car is unavailable. Select another car to continue.')).toBeVisible();
  await expect(fixture.modal.getByRole('button', { name: 'Save Changes', exact: true })).toBeDisabled();
  await fixture.modal.getByRole('combobox', { name: 'Car *', exact: true }).selectOption('other-car');
  await expect(fixture.modal.getByRole('button', { name: 'Save Changes', exact: true })).toBeEnabled();
});

test('shows empty-car guidance and blocks car income', async ({ page }) => {
  const fixture = await mockApp(page, { emptyCars: true });
  await fillRequired(page);
  await fixture.modal.getByRole('switch', { name: 'Is income?' }).click();
  await fixture.modal.getByRole('combobox', { name: 'Income source' }).selectOption('car_sale');
  await expect(fixture.modal.getByText(/No cars available/)).toBeVisible();
  await expect(fixture.modal.getByRole('button', { name: 'Create Payment', exact: true })).toBeDisabled();
});
