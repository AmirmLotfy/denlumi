import { expect, test, type Locator, type Page } from './database-test';

// Browser-observable regressions for AT068–072. Human screen-reader use and
// native browser zoom still require separate acceptance on supported devices.
const views = [
 { name: 'Today', heading: 'Routine reports' },
 { name: 'Pets', heading: 'Pets and situations' },
 { name: 'Home', heading: 'Home arrangements' },
 { name: 'History', heading: 'History' },
] as const;

async function openSample(page: Page) {
 await page.goto('/');
 await expect(page.getByRole('heading', { name: /One current plan/ })).toBeVisible();
 await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();await page.getByRole('button', { name: 'Open sample household' }).click();
 await expect(page.getByRole('navigation', { name: 'Household views' })).toBeVisible();
}

async function tabTo(page: Page, target: Locator) {
 for (let step = 0; step < 120; step++) {
  await page.keyboard.press('Tab');
  if (await target.evaluate(element => document.activeElement === element)) return;
 }
 throw new Error(`Control was not reachable by Tab: ${target}`);
}

async function expectFocusOutline(target: Locator) {
 const style = await target.evaluate(element => {
  const computed = getComputedStyle(element);
  return {
   outlineStyle: computed.outlineStyle,
   outlineWidth: parseFloat(computed.outlineWidth),
   outlineOffset: parseFloat(computed.outlineOffset),
   outlineColor: computed.outlineColor,
   borderWidth: parseFloat(computed.borderTopWidth),
   borderColor: computed.borderTopColor,
   forcedColors: matchMedia('(forced-colors: active)').matches,
  };
 });
 expect(style.outlineStyle).toBe('solid');
 expect(style.outlineWidth).toBeGreaterThanOrEqual(2);
 expect(style.outlineOffset).toBeGreaterThanOrEqual(2);
 expect(style.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
 if (style.forcedColors) expect(style.outlineOffset).toBeGreaterThanOrEqual(3);
 else if (style.borderWidth > 0) expect(style.outlineColor).not.toBe(style.borderColor);
}

async function expectStopAndNavInViewport(page: Page) {
 const geometry = await page.evaluate(() => {
  const stop = document.querySelector<HTMLButtonElement>('.stopbar .stop-button');
  const nav = document.querySelector<HTMLElement>('.section-nav');
  if (!stop || !nav) return null;
  const stopRect = stop.getBoundingClientRect();
  const navRect = nav.getBoundingClientRect();
  return {
   noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
   stopInside: stopRect.left >= -1 && stopRect.right <= innerWidth + 1 && stopRect.top >= -1 && stopRect.bottom <= innerHeight + 1,
   navInside: navRect.left >= -1 && navRect.right <= innerWidth + 1,
  };
 });
 expect(geometry).not.toBeNull();
 expect(geometry?.noHorizontalOverflow).toBe(true);
 expect(geometry?.stopInside).toBe(true);
 expect(geometry?.navInside).toBe(true);
 await expect(page.getByRole('button', { name: 'Stop guidance' })).toBeVisible();
}

test('AT068/AT072: keyboard reaches all four views, handover status and Stop with visible focus', async ({ page, context }) => {
 await page.goto('/');
 const retention = page.getByRole('checkbox', { name: /I understand the fictional sample/ });
 await tabTo(page, retention);
 await expectFocusOutline(retention);
 await page.keyboard.press('Space');
 await expect(retention).toBeChecked();
 const open = page.getByRole('button', { name: 'Open sample household' });
 await tabTo(page, open);
 await expectFocusOutline(open);
 await page.keyboard.press('Enter');
 const nav = page.getByRole('navigation', { name: 'Household views' });
 await expect(nav).toBeVisible();

 const refresh = page.getByRole('button', { name: 'Refresh Sam’s view' });
 await tabTo(page, refresh);
 await expectFocusOutline(refresh);
 await page.keyboard.press('Enter');
 await expect(page.getByRole('status').filter({ hasText: /Sam retrieved the current update/ })).toBeVisible();

 for (const view of views) {
  const button = nav.getByRole('button', { name: view.name, exact: true });
  await tabTo(page, button);
  await expectFocusOutline(button);
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: view.heading, exact: true })).toBeVisible();
 }

 const stop = page.getByRole('button', { name: 'Stop guidance' });
 await tabTo(page, stop);
 await expectFocusOutline(stop);
 await context.setOffline(true);
 await page.keyboard.press('Enter');
 await expect(page.getByText('Stopped on this device.')).toBeVisible();
 await expect(page.getByRole('status').filter({ hasText: 'Household update not yet synchronized.' })).toBeVisible();
});

test('AT068/AT069: keyboard completes fictional review and handover at 320px, with Stop visible in decision screens', async ({ page }) => {
 await page.setViewportSize({ width: 320, height: 800 });
 await page.goto('/');
 const retention = page.getByRole('checkbox', { name: /I understand the fictional sample/ });
 await tabTo(page, retention);
 await page.keyboard.press('Space');
 await expect(retention).toBeChecked();
 const open = page.getByRole('button', { name: 'Open sample household' });
 await tabTo(page, open);
 await page.keyboard.press('Enter');
 const journey = page.getByRole('region', { name: 'Review this fictional case' });
 await expect(journey).toBeVisible();
 for (const name of ['Save fictional intake', 'Create draft for owner review']) {
  const button = journey.getByRole('button', { name });
  await tabTo(page, button);
  await expectFocusOutline(button);
  await page.keyboard.press('Enter');
  await expectStopAndNavInViewport(page);
 }
 const reviewed = journey.getByRole('checkbox', { name: 'I reviewed this exact fictional revision.' });
 await tabTo(page, reviewed);
 await page.keyboard.press('Space');
 await expect(reviewed).toBeChecked();
 for (const name of ['Record owner review', 'Acknowledge exact handover', 'Sam acknowledges exact handover', 'Check session preflight', 'Start fictional software session']) {
  const button = journey.getByRole('button', { name });
  await tabTo(page, button);
  await expectFocusOutline(button);
  await page.keyboard.press('Enter');
  if (name === 'Check session preflight') await expect(journey.getByText('Ready for an explicit human start. This is a fictional software session.')).toBeVisible();
  await expectStopAndNavInViewport(page);
 }
 await expect(journey.getByText('Session · active')).toBeVisible();
 const stop = page.getByRole('button', { name: 'Stop guidance' });
 await tabTo(page, stop);
 await expectFocusOutline(stop);
 await page.keyboard.press('Enter');
 await expect(page.getByText('Stopped on this device.')).toBeVisible();
});

test('AT069: review, handover and session decisions reflow under a 200% CSS zoom simulation', async ({ page }) => {
 await page.setViewportSize({ width: 640, height: 900 });
 await openSample(page);
 await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
 const journey = page.getByRole('region', { name: 'Review this fictional case' });
 const check = async () => {
  await expectStopAndNavInViewport(page);
  expect(await journey.evaluate(element => {
   const box=element.getBoundingClientRect();
   return box.left>=-1&&box.right<=innerWidth+1;
  })).toBe(true);
 };
 await check();
 await journey.getByRole('button', { name: 'Save fictional intake' }).click();
 await check();
 await journey.getByRole('button', { name: 'Create draft for owner review' }).click();
 await check();
 await journey.getByRole('checkbox', { name: 'I reviewed this exact fictional revision.' }).check();
 await journey.getByRole('button', { name: 'Record owner review' }).click();
 await check();
 await journey.getByRole('button', { name: 'Acknowledge exact handover' }).click();
 await journey.getByRole('button', { name: 'Sam acknowledges exact handover' }).click();
 await check();
 await journey.getByRole('button', { name: 'Check session preflight' }).click();
 await expect(journey.getByText('Ready for an explicit human start. This is a fictional software session.')).toBeVisible();
 await journey.getByRole('button', { name: 'Start fictional software session' }).click();
 await expect(journey.getByText('Session · active')).toBeVisible();
 await check();
});

test('AT069: four views and Stop reflow at 320 CSS pixels', async ({ page }) => {
 await page.setViewportSize({ width: 320, height: 800 });
 await openSample(page);
 const nav = page.getByRole('navigation', { name: 'Household views' });
 for (const view of views) {
  await nav.getByRole('button', { name: view.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: view.heading, exact: true })).toBeVisible();
  await expectStopAndNavInViewport(page);
 }
});

test('AT069: four views and Stop reflow with a 200% CSS zoom simulation', async ({ page }) => {
 // A 640px viewport with 2x root zoom exercises roughly 320px of layout
 // space. This does not substitute for manual native browser-zoom testing.
 await page.setViewportSize({ width: 640, height: 900 });
 await openSample(page);
 await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
 const nav = page.getByRole('navigation', { name: 'Household views' });
 for (const view of views) {
  await nav.getByRole('button', { name: view.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: view.heading, exact: true })).toBeVisible();
  await expectStopAndNavInViewport(page);
 }
});

test('AT070/AT071: reduced motion computes without transitions; photo-free pets stay named', async ({ page }) => {
 await page.emulateMedia({ reducedMotion: 'reduce' });
 await page.goto('/');
 await page.getByRole('radio', { name: /A multi-pet home/ }).check();
 await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();await page.getByRole('button', { name: 'Open sample household' }).click();
 const nav = page.getByRole('navigation', { name: 'Household views' });
 await expect(nav).toBeVisible();
 for (const view of views) {
  const button = nav.getByRole('button', { name: view.name, exact: true });
  await button.click();
  await expect(page.getByRole('heading', { name: view.heading, exact: true })).toBeVisible();
  const motion = await button.evaluate(element => {
   const style = getComputedStyle(element);
   return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, animation: style.animationName, transition: style.transitionDuration, scroll: style.scrollBehavior };
  });
  expect(motion).toEqual({ reduced: true, animation: 'none', transition: '0s', scroll: 'auto' });
  const petLanes = page.locator('.pet-lanes');
  for (const [name, species] of [['Finn', 'dog'], ['Nora', 'cat'], ['Milo', 'cat']] as const) {
   await expect(petLanes.locator('.pet').filter({ hasText: name })).toContainText(species);
  }
  await expect(petLanes.locator('img')).toHaveCount(0);
 }
 await nav.getByRole('button', { name: 'Pets', exact: true }).click();
 const cards = page.locator('.pet-card');
 await expect(cards).toHaveCount(3);
 await expect(cards.locator('img')).toHaveCount(0);
 for (const [name, species] of [['Finn', 'dog'], ['Nora', 'cat'], ['Milo', 'cat']] as const) {
  await expect(cards.filter({ hasText: name })).toContainText(species);
 }
});

test('AT072: forced-colors mode keeps controls and Stop visually distinct', async ({ page }) => {
 await page.emulateMedia({ forcedColors: 'active' });
 await openSample(page);
 const nav = page.getByRole('navigation', { name: 'Household views' });
 const pets = nav.getByRole('button', { name: 'Pets', exact: true });
 await tabTo(page, pets);
 await expectFocusOutline(pets);
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading', { name: 'Pets and situations' })).toBeVisible();
 const stop = page.getByRole('button', { name: 'Stop guidance' });
 await tabTo(page, stop);
 await expectFocusOutline(stop);
 await expect(stop).toBeVisible();
});
