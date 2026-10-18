import { expect,test } from '@playwright/test';
import { testHousehold } from '../helpers';
import { pool } from '../../packages/domain/db';

test.afterAll(()=>pool.end());

test('freshly authenticated owner sees deletion-only path after fictional demo expiry',async({page})=>{
 const home=await testHousehold('single_cat',true);
 await pool.query("update households set expires_at=now()-interval '1 minute' where id=$1",[home.householdId]);
 await page.context().addCookies([{name:'denlumi_session',value:home.owner.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'}]);
 await page.addInitScript(id=>sessionStorage.setItem('denlumi-records-household',id),home.householdId);
 await page.goto('/');
 const panel=page.getByRole('region',{name:'Saved fictional household: deletion only'});
 await expect(panel).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop guidance'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'A shared starting point.'})).toHaveCount(0);
 const request=panel.getByRole('button',{name:'Disable household and request deletion'});
 await expect(request).toBeDisabled();
 await panel.getByLabel('Type DELETE to confirm').fill('DELETE');
 await panel.getByRole('checkbox',{name:'I request deletion of this entire fictional household.'}).check();
 await request.click();
 await expect(panel.getByRole('heading',{name:'Household deletion: pending'})).toBeVisible();
 await panel.getByRole('button',{name:'Run local primary cleanup'}).click();
 await expect(panel.getByRole('heading',{name:'Household deletion: completed'})).toBeVisible();
 await expect(panel.getByText('Primary database cleanup: verified by the server.')).toBeVisible();
 expect((await pool.query('select 1 from households where id=$1',[home.householdId])).rowCount).toBe(0);
});
