import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:3400';
const root = await mkdtemp(join(tmpdir(), 'denlumi-native-zoom-'));
const extension = join(root, 'extension');
await mkdir(extension);
await writeFile(join(extension, 'manifest.json'), JSON.stringify({
 manifest_version: 3,
 name: 'Denlumi local browser zoom probe',
 version: '1.0.0',
 permissions: ['tabs'],
 background: { service_worker: 'background.js' },
}));
await writeFile(join(extension, 'background.js'), 'chrome.runtime.onInstalled.addListener(() => {});\n');

let context;
try {
 context = await chromium.launchPersistentContext(join(root, 'profile'), {
  channel: 'chromium', headless: false, viewport: null,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=800,900'],
 });
 const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
 const page = await context.newPage();
 await page.goto(origin);
 await page.getByRole('checkbox', { name: /I understand the fictional sample/ }).check();
 await page.getByRole('button', { name: 'Open sample household' }).click();
 await expect(page.getByRole('navigation', { name: 'Household views' })).toBeVisible();
 const before = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
 const zoom = await worker.evaluate(async target => {
  const extensionApi = (globalThis as unknown as { chrome: { tabs: {
   query(options: { url: string }): Promise<Array<{ active?: boolean; id?: number }>>;
   setZoom(tabId: number, zoom: number): Promise<void>;
   getZoom(tabId: number): Promise<number>;
  } } }).chrome;
  const tabs = await extensionApi.tabs.query({ url: `${target}/*` });
  const tab = tabs.find(item => item.active && item.id !== undefined) ?? tabs.find(item => item.id !== undefined);
  if (!tab?.id) throw Error('Local app tab not found');
  await extensionApi.tabs.setZoom(tab.id, 2);
  return extensionApi.tabs.getZoom(tab.id);
 }, origin);
 assert.equal(zoom, 2);
 const after = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
 assert.ok(after.width < before.width, `Native zoom did not reduce CSS viewport: ${JSON.stringify({before,after})}`);
 const journey = page.getByRole('region', { name: 'Review this fictional case' });
 const stages = [
  'Save fictional intake', 'Create draft for owner review', 'Record owner review',
  'Acknowledge exact handover', 'Sam acknowledges exact handover',
  'Check session preflight', 'Start fictional software session',
 ];
 const check = async () => {
  const geometry = await page.evaluate(() => {
   const stop = document.querySelector('.stopbar .stop-button')?.getBoundingClientRect();
   const nav = document.querySelector('.section-nav')?.getBoundingClientRect();
   return { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    stop: !!stop && stop.left >= -1 && stop.right <= innerWidth + 1 && stop.top >= -1 && stop.bottom <= innerHeight + 1,
    nav: !!nav && nav.left >= -1 && nav.right <= innerWidth + 1 };
  });
  assert.deepEqual(geometry, { overflow: false, stop: true, nav: true });
  assert.equal(await journey.evaluate(element => {
   const box = element.getBoundingClientRect();
   return box.left >= -1 && box.right <= innerWidth + 1;
  }), true);
 };
 await check();
 for (const name of stages) {
  if (name === 'Record owner review') await journey.getByRole('checkbox', { name: 'I reviewed this exact fictional revision.' }).check();
  await journey.getByRole('button', { name }).click();
  await check();
 }
 await expect(journey.getByText('Session · active')).toBeVisible();
 await page.getByRole('button', { name: 'Stop guidance' }).click();
 await expect(page.getByText('Stopped on this device.')).toBeVisible();
 const evidence = {
  checked_at: new Date().toISOString(), result: 'PASS',
  environment: `Task-owned headed Chromium ${context.browser()?.version() ?? 'unknown'} on macOS; local production Next.js and fictional local Supabase`,
  mechanism: 'chrome.tabs.setZoom(tabId, 2) from a temporary unpacked local extension; browser reported zoom 2',
  before, after,
  checks: ['Native browser zoom reduced CSS viewport from 800 to 400 pixels',
   'No horizontal document overflow in review, handover and session stages',
   'Stop and section navigation remained inside the visible viewport at all seven decision stages',
   'Fictional software session started and local Stop showed its stopped state'],
  limits: 'One task-owned desktop Chromium profile. Browser automation does not prove human screen-reader announcements, supported-device behavior, user comprehension, physical audio, or professional content approval. No hosted service or real animal guidance was used.',
 };
 await mkdir('evidence/phase9', { recursive: true });
 await writeFile('evidence/phase9/native-zoom.json', `${JSON.stringify(evidence, null, 2)}\n`);
 console.log(JSON.stringify({ result: evidence.result, browser: evidence.environment, zoom, before, after, stages: stages.length, localStop: true }));
} finally {
 if (context) await context.close();
 await rm(root, { recursive: true, force: true });
}
