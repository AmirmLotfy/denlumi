import { test as base, expect } from '@playwright/test';
import { pool } from '../../packages/domain/db';

// Playwright may reuse one worker across several files. Its shared database pool
// belongs to that worker, so file-level afterAll hooks must not close it early.
let lastDemoEntry = 0;
export const test = base.extend<{ demoEntryBudget: void }, { databaseLifecycle: void }>({
 databaseLifecycle: [async ({}, use) => {
  try { await use(); } finally { await pool.end(); }
 }, { scope: 'worker', auto: true }],
 demoEntryBudget: [async ({ page }, use) => {
  // Each typed browser test creates at most one sample. Pace the next test
  // before interaction, without intercepting requests or changing offline behavior.
  await new Promise(resolve => setTimeout(resolve, Math.max(0, 6000 - (Date.now() - lastDemoEntry))));
  const observe = (request: import('@playwright/test').Request) => {
   if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/demo') lastDemoEntry = Date.now();
  };
  page.on('request', observe);
  await use();
  page.off('request', observe);
 }, { auto: true }],
});
export { expect };
export type { Page, Locator } from '@playwright/test';
