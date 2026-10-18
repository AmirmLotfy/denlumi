import { expect,test } from '@playwright/test';
import { testHousehold } from '../helpers';

test('planning read outage hides stale decision controls and a fresh read restores the current handover',async({page})=>{
 const home=await testHousehold('cat_dog');
 await page.context().addCookies([
  {name:'denlumi_session',value:home.owner.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'},
  {name:'denlumi_caregiver',value:home.caregiver.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'},
 ]);
 await page.goto('/');
 const journey=page.getByRole('region',{name:'Review this fictional case'});
 await journey.getByRole('button',{name:'Save fictional intake'}).click();
 await journey.getByRole('button',{name:'Create draft for owner review'}).click();
 await journey.getByRole('checkbox',{name:'I reviewed this exact fictional revision.'}).check();
 await journey.getByRole('button',{name:'Record owner review'}).click();
 await expect(journey.getByRole('button',{name:'Acknowledge exact handover'})).toBeVisible();

 const pattern=`**/api/households/${home.householdId}/planning`;
 await page.route(pattern,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SERVICE_UNAVAILABLE'})}));
 await journey.getByRole('button',{name:'Refresh journey state'}).click();
 await expect(journey.getByRole('alert')).toContainText('Refresh failed: SERVICE_UNAVAILABLE');
 await expect(journey.getByRole('button',{name:'Acknowledge exact handover'})).toHaveCount(0);
 await expect(journey.getByRole('button',{name:'Start fictional software session'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();

 await page.unroute(pattern);
 await journey.getByRole('button',{name:'Refresh journey state'}).click();
 await expect(journey.getByRole('button',{name:'Acknowledge exact handover'})).toBeVisible();
 await expect(journey.getByRole('alert')).toHaveCount(0);
});

test('failed current-plan turn hides the previous answer and a fresh turn recovers',async({page})=>{
 const home=await testHousehold('single_cat');
 await page.context().addCookies([{name:'denlumi_session',value:home.owner.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'}]);
 await page.goto('/');
 const reply=page.locator('.companion .reply');
 await page.getByRole('button',{name:'Read current plan'}).click();
 await expect(reply).toBeVisible();
 const pattern='**/api/assistant/turn';
 await page.route(pattern,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SERVICE_UNAVAILABLE'})}));
 await page.getByRole('button',{name:'Read current plan'}).click();
 await expect(page.locator('main .error[role="alert"]')).toContainText('Current-state retrieval failed: SERVICE_UNAVAILABLE');
 await expect(reply).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
 await page.unroute(pattern);
 await page.getByRole('button',{name:'Read current plan'}).click();
 await expect(reply).toBeVisible();
 await expect(page.locator('main .error[role="alert"]')).toHaveCount(0);
});
