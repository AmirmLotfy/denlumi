import { test,expect } from './database-test';
import { pool } from '../../packages/domain/db';

test('a saved code deletes only its expired fictional sample after browser session loss',async({page,context})=>{
 await page.goto('/');
 await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();
 await page.getByRole('button',{name:'Open sample household'}).click();
 await expect(page.getByRole('heading',{name:'Finn & Nora'})).toBeVisible();
 const panel=page.getByRole('region',{name:'Keep a way to delete this sample'});
 await panel.getByText('Show deletion code').click();
 const code=(await panel.locator('code').textContent())!;
 const householdId=code.split('.')[1];
 expect(code).toMatch(/^d1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
 expect(JSON.stringify(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}})))).not.toContain(code);
 await page.setViewportSize({width:320,height:720});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);

 await pool.query("update households set expires_at=now()-interval '1 minute' where id=$1",[householdId]);
 await context.clearCookies();
 await page.reload();
 const recovery=page.getByRole('region',{name:'Delete an expired fictional sample'});
 await expect(recovery).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
 await recovery.getByLabel('Deletion code').fill(code.slice(0,-1)+(code.endsWith('a')?'b':'a'));
 await recovery.getByLabel('Type DELETE to confirm').fill('DELETE');
 await recovery.getByRole('checkbox',{name:/I request deletion of the exact fictional household/}).check();
 await recovery.getByRole('button',{name:'Request exact sample deletion'}).click();
 await expect(recovery.getByRole('alert')).toContainText('This code cannot be used');
 const row=(await pool.query('select status from households where id=$1',[householdId])).rows[0];
 expect(row.status).toBe('active');
 await recovery.getByLabel('Deletion code').fill(code);
 const [response]=await Promise.all([
  page.waitForResponse(r=>r.url().endsWith('/api/demo/recover-delete')&&r.request().method()==='POST'&&r.status()===202),
  recovery.getByRole('button',{name:'Request exact sample deletion'}).click()
 ]);
 expect((await response.json()).primary_cleanup_verified).toBe(true);
 await expect(recovery.getByRole('status')).toContainText('Household deletion: completed');
 expect((await pool.query('select 1 from households where id=$1',[householdId])).rowCount).toBe(0);
});
