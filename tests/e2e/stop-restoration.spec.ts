import { test, expect } from './database-test';
import { testHousehold } from '../helpers';

for (const caregiver of ['missing', 'unavailable', 'delayed'] as const) {
 for (const marker of ['pending', 'synced'] as const) {
  test(`restores ${marker} Stop before ${caregiver} optional caregiver state`, async ({ page, context }) => {
   const home = await testHousehold('cat_dog');
   await context.addCookies([{ name: 'denlumi_session', value: home.owner.token,
    url: 'http://127.0.0.1:3400', httpOnly: true, sameSite: 'Strict' }]);
   await page.addInitScript(({ id, value }) => {
    localStorage.setItem(`denlumi-stop-${id}`, value);
   }, { id: home.householdId, value: marker });
   let pauseRequests = 0;
   page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/actions' && request.method() === 'POST'
      && request.postDataJSON()?.operation === 'pause') pauseRequests++;
   });
   let release: (() => void) | undefined;
   if (caregiver === 'unavailable') {
    await page.route('**/api/caregiver', route => route.fulfill({ status: 503, json: { error: 'AUTH_UNAVAILABLE' } }));
   } else if (caregiver === 'delayed') {
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/caregiver', async route => {
     await gate;
     await route.fulfill({ status: 503, json: { error: 'AUTH_UNAVAILABLE' } }).catch(() => {});
    });
   }
   try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Finn & Nora', exact: true })).toBeVisible();
    await expect(page.getByText('Stopped on this device.', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('The software pause is saved to the household.', { exact: true })).toBeVisible();
    expect(pauseRequests).toBe(marker === 'pending' ? 1 : 0);
    expect(await page.evaluate(id => localStorage.getItem(`denlumi-stop-${id}`), home.householdId)).toBe('synced');
    if (marker === 'pending') {
     const response = await page.request.get(`/api/households/${home.householdId}`);
     expect(response.status()).toBe(200);
     expect((await response.json()).stale).toBe(true);
    }
   } finally { release?.(); }
  });
 }
}

for (const operation of ['refresh', 'check'] as const) {
 test(`late caregiver ${operation} cannot replace another household's saved state or status`, async ({ page, context }) => {
  const old = await testHousehold('cat_dog');
  await context.addCookies([
   { name: 'denlumi_session', value: old.owner.token, url: 'http://127.0.0.1:3400', httpOnly: true, sameSite: 'Strict' },
   { name: 'denlumi_caregiver', value: old.caregiver.token, url: 'http://127.0.0.1:3400', httpOnly: true, sameSite: 'Strict' },
  ]);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Check Sam’s saved view' })).toBeEnabled();
  let release!: () => void, captured!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const held = new Promise<void>(resolve => { captured = resolve; });
  let intercepted = false;
  await page.route(operation === 'refresh' ? '**/api/caregiver' : '**/api/actions', async route => {
   if (intercepted) { await route.continue(); return; }
   intercepted = true;
   const response = await route.fetch();
   captured(); await gate;
   await route.fulfill({ response }).catch(() => {});
  });
  try {
   await page.getByRole('button', { name: operation === 'refresh' ? 'Refresh Sam’s view' : 'Check Sam’s saved view' }).click();
   await held;
   await page.getByRole('button', { name: 'Leave sample', exact: true }).click();
   await expect(page.getByRole('button', { name: 'Open sample household' })).toBeVisible();
   await page.getByRole('radio', { name: /One cat/ }).check();
   await page.getByRole('checkbox', { name: /I understand the fictional sample/ }).check();
   await page.getByRole('button', { name: 'Open sample household' }).click();
   await expect(page.getByRole('heading', { name: 'Nora’s home', exact: true })).toBeVisible();
   const current = await (await page.request.get('/api/households')).json();
   const completed = page.waitForResponse(r => new URL(r.url()).pathname === (operation === 'refresh' ? '/api/caregiver' : '/api/actions'));
   release(); await completed;
   await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
   await expect(page.getByText(/Sam retrieved the current update|Sam’s saved view is current/)).toHaveCount(0);
   const action = page.waitForRequest(r => new URL(r.url()).pathname === '/api/actions' && r.method() === 'POST');
   await page.getByRole('button', { name: 'Check Sam’s saved view' }).click();
   expect((await action).postDataJSON().input.case_id).toBe(current.brief.case_id);
  } finally { release(); }
 });
}
