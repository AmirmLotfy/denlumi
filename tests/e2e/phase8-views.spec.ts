import { test,expect } from '@playwright/test';
import { testHousehold } from '../helpers';
import { pool } from '../../packages/domain/db';

test('newcomer-cat sample has current Today, directional Pets, Home and attributed History views',async({page})=>{
 await page.goto('/');await page.getByLabel(/Cat joining a dog/).check();await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();await page.getByRole('button',{name:'Open sample household'}).click();
 await expect(page.getByRole('heading',{name:'Finn & Nora'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Routine reports'})).toBeVisible();
 await expect(page.getByText('Current household details could not be retrieved')).toHaveCount(0);
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Pets'}).click();
 await expect(page.getByRole('heading',{name:'Pets and situations'})).toBeVisible();
 await expect(page.getByText('Nora · cat · newcomer')).toBeVisible();
 await expect(page.getByText('Finn · dog · resident')).toBeVisible();
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Home'}).click();
 await expect(page.getByRole('heading',{name:'Home arrangements'})).toBeVisible();
 await expect(page.getByText('No home zones are recorded for the current version.')).toBeVisible();
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'History'}).click();
 await expect(page.getByRole('heading',{name:'History'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Private records'})).toBeVisible();
 await expect(page.getByText('Fictional household loaded. Review the named pets and current record. No practical animal guidance is approved.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
});

test('320px multi-pet views keep separate pair contexts and visible Stop',async({page})=>{
 await page.setViewportSize({width:320,height:800});await page.goto('/');await page.getByLabel(/A multi-pet home/).check();await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();await page.getByRole('button',{name:'Open sample household'}).click();
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Pets'}).click();
 await expect(page.getByRole('heading',{name:'Pets and situations'})).toBeVisible();
 await page.getByText('Separate pair contexts (3)').click();
 await expect(page.getByText('no group-readiness inference').first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test('owner-reported home change creates a new version and visibly invalidates the old plan',async({page})=>{
 await page.goto('/');await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();await page.getByRole('button',{name:'Open sample household'}).click();
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Home'}).click();
 await page.getByText('Add a reported zone').click();
 await page.getByLabel('Zone name').fill('Fictional quiet room');
 await page.getByLabel(/Arrangement note/).fill('Caregiver-reported arrangement; not physically verified.');
 await page.getByLabel(/Resource label/).fill('Water bowl record');
 await page.getByLabel('Planned access for pet').selectOption({label:'Nora (cat)'});
 await page.getByRole('button',{name:'Save new home record'}).click();
 await expect(page.getByText('Version 2')).toBeVisible();
 await expect(page.getByText('Fictional quiet room')).toBeVisible();
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Today'}).click();
 await expect(page.getByRole('heading',{name:'Plan review needed.'})).toBeVisible();
 await expect(page.getByText('Earlier plan review cannot authorize a session.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
});

test('three-pet home edit invalidates the prior revision while preserving separate pair contexts',async({page})=>{
 const home=await testHousehold('multi_pet');
 await page.context().addCookies([{name:'denlumi_session',value:home.owner.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'}]);
 await page.goto('/');
 const prior=(await pool.query('select safety_epoch,home_version from households where id=$1',[home.householdId])).rows[0];
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Pets'}).click();
 await expect(page.getByText('Separate pair contexts (3)')).toBeVisible();
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Home'}).click();
 await page.getByText('Add a reported zone').click();
 await page.getByLabel('Zone name').fill('Reported three-pet room');
 await page.getByLabel(/Resource label/).fill('Reported shared resource');
 await page.getByLabel('Planned access for pet').selectOption({label:'Milo (cat)'});
 await page.getByRole('button',{name:'Save new home record'}).click();
 await expect(page.getByText('Version 2')).toBeVisible();
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Today'}).click();
 await expect(page.getByRole('heading',{name:'Plan review needed.'})).toBeVisible();
 const current=(await pool.query('select safety_epoch,home_version from households where id=$1',[home.householdId])).rows[0];
 expect(current.safety_epoch).toBe(prior.safety_epoch+1);expect(current.home_version).toBe(prior.home_version+1);
 const revision=(await pool.query('select status from plan_revisions where id=$1',[home.planId])).rows[0];expect(revision.status).toBe('stale');
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Pets'}).click();
 await expect(page.getByText('Separate pair contexts (3)')).toBeVisible();
 await page.getByText('Separate pair contexts (3)').click();
 await expect(page.getByText('no group-readiness inference').first()).toBeVisible();
});
