import { randomUUID } from 'node:crypto';
import { expect,test } from './database-test';
import { testHousehold } from '../helpers';
import { householdGraph } from '../../packages/domain/household';
import { createRoutine,generateOccurrences,listDueTasks,reportTask } from '../../packages/domain/routines';
import { pool } from '../../packages/domain/db';

const origin='http://127.0.0.1:3400';
const schedule={schema_version:'1',timezone:'Africa/Cairo',frequency:'daily',local_time:'00:01',days_of_week:[],dst_policy:'wall_clock_first_valid'};
async function setup(){
 const h=await testHousehold('single_cat');
 const state=async()=>{const g=await householdGraph(h.owner.actor,h.householdId);return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};
 const pet=(await householdGraph(h.owner.actor,h.householdId)).pets[0];
 return {...h,pet,state};
}
async function seed(h:Awaited<ReturnType<typeof setup>>){
 await createRoutine(h.owner.actor,h.householdId,{...await h.state(),pet_id:h.pet.id,kind:'water',instruction:'Fictional owner routine record.',schedule_spec:schedule},randomUUID());
 const date=new Date().toISOString().slice(0,10);
 await generateOccurrences(h.owner.actor,h.householdId,{...await h.state(),from_date:date,through_date:date},randomUUID());
 return (await listDueTasks(h.owner.actor,h.householdId)).tasks[0];
}
async function open(page:import('@playwright/test').Page,token:string){
 await page.context().addCookies([{name:'denlumi_session',value:token,url:origin,httpOnly:true,sameSite:'Strict'}]);
 await page.goto('/');
 await page.getByText('Manage routine rules and reports',{exact:true}).click();
 const manager=page.getByRole('region',{name:'Routine management'});
 // Opening the disclosure alone does not mean its asynchronous current read
 // finished. Establish the attributed baseline before tests mutate that state.
 await expect(manager.getByText(/Reporting as /)).toBeVisible();
 return manager;
}
async function request(token:string,path:string,method='GET',body?:unknown){return fetch(origin+path,{method,headers:{Origin:origin,Cookie:`denlumi_session=${token}`,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});}

test('routine rule list returns current scoped versions and the authenticated reporter identity',async()=>{
 const h=await setup();await seed(h);
 const response=await request(h.owner.token,`/api/households/${h.householdId}/routine-rules`);
 expect(response.status).toBe(200);
 const body=await response.json();
 expect(body.actor_id).toBe(h.owner.actor.userId);
 expect(body.rules).toHaveLength(1);
 expect(body.rules[0]).toMatchObject({pet_id:h.pet.id,version:1,status:'active',schedule_spec:schedule});
});

test('owner creates an explicit schedule, generates occurrences and edits without changing pet identity',async({page})=>{
 const h=await setup(),manager=await open(page,h.owner.token);
 const form=manager.getByRole('form',{name:'Create routine rule'});
 await form.getByLabel('Routine pet').selectOption(h.pet.id);
 await form.getByLabel('Routine kind').selectOption('water');
 await form.getByLabel('Owner instruction').fill('Fictional water record.');
 await form.getByLabel('Schedule timezone').fill('Africa/Cairo');
 await form.getByLabel('Schedule frequency').selectOption('weekly');
 await form.getByLabel('Monday',{exact:true}).check();
 await form.getByLabel('Local scheduled time').fill('09:15');
 await form.getByRole('button',{name:'Create routine rule',exact:true}).click();
 await expect(manager.getByText('Routine rule created.')).toBeVisible();
 const monday=new Date();monday.setUTCDate(monday.getUTCDate()+((8-monday.getUTCDay())%7||7));
 const date=monday.toISOString().slice(0,10),generate=manager.getByRole('form',{name:'Generate routine occurrences'});
 await generate.getByLabel('From date').fill(date);await generate.getByLabel('Through date').fill(date);
 await generate.getByRole('button',{name:'Generate occurrences'}).click();
 await expect(manager.getByText('Occurrences generated: 1. Existing occurrences are preserved.')).toBeVisible();
 const editor=manager.getByRole('form',{name:`Edit routine ${h.pet.nickname} water`});
 await expect(editor.getByLabel('Routine pet')).toBeDisabled();
 await expect(editor.getByLabel('Schedule timezone')).toHaveValue('Africa/Cairo');
 await editor.getByLabel('Routine status').selectOption('paused');
 await editor.getByRole('button',{name:'Save routine changes'}).click();
 await expect(manager.getByText('Routine rule updated. Historical occurrences and reports remain unchanged.')).toBeVisible();
 await expect(manager.getByRole('form',{name:`Edit routine ${h.pet.nickname} water`}).getByLabel('Routine status')).toHaveValue('paused');
 await generate.getByRole('button',{name:'Generate occurrences'}).click();
 await expect(manager.getByText('Occurrences generated: 0. Existing occurrences are preserved.')).toBeVisible();
});

test('claim and performed-time report are attributed; own correction appends and preserves conflicting reports',async({page})=>{
 const h=await setup(),task=await seed(h);
 const manager=await open(page,h.owner.token),card=manager.getByTestId(`managed-task-${task.id}`);
 await card.getByRole('button',{name:'Claim task'}).click();
 await expect(card.getByText(`Claimed by ${h.owner.actor.userId}`,{exact:false})).toBeVisible();
 await reportTask(h.caregiver.actor,task.id,{report:'skipped',performed_at:null,note:'Fictional caregiver report.'},randomUUID());
 const report=card.getByRole('form',{name:'Add attributed task report'});
 await report.getByLabel('Reported outcome').selectOption('done');
 await report.getByLabel('Performed time').fill('2026-10-20T08:10');
 await report.getByLabel('Report note').fill('Fictional owner report.');
 await report.getByRole('button',{name:'Add report',exact:true}).click();
 await expect(card.getByText('Conflicting current reports remain unresolved.')).toBeVisible();
 await expect(card.getByText(`Reported by ${h.owner.actor.userId}`,{exact:false})).toBeVisible();
 await expect(card.getByText('Performed:',{exact:false}).filter({hasText:'2026'})).toBeVisible();
 const correction=card.getByRole('form',{name:'Correct my task report'});
 await correction.getByLabel('Corrected outcome').selectOption('uncertain');
 await correction.getByLabel('Correction reason').fill('Fictional correction; original stays visible.');
 await correction.getByRole('button',{name:'Append correction'}).click();
 await expect(card.getByText('Superseded by a later correction; retained in history.')).toBeVisible();
 await expect(card.getByText('Fictional owner report.',{exact:true})).toBeVisible();
 await expect(card.getByText('Fictional correction; original stays visible.',{exact:true})).toBeVisible();
 await expect(card.getByText('Conflicting current reports remain unresolved.')).toBeVisible();
 expect((await pool.query('select count(*)::int n from task_reports where task_occurrence_id=$1',[task.id])).rows[0].n).toBe(3);
 const original=(await pool.query("select id from task_reports where task_occurrence_id=$1 and reporter_id=$2 and report='done'",[task.id,h.owner.actor.userId])).rows[0].id;
 const foreignCorrection=await request(h.caregiver.token,`/api/tasks/${task.id}/reports`,'POST',{report:'correction',supersedes_id:original,corrected_report:'done',performed_at:null,note:'Attempt to correct another reporter.'});
 expect(foreignCorrection.status).toBe(403);
 const staleCorrection=await request(h.owner.token,`/api/tasks/${task.id}/reports`,'POST',{report:'correction',supersedes_id:original,corrected_report:'done',performed_at:null,note:'Attempt to correct an already superseded report.'});
 expect(staleCorrection.status).toBe(409);expect((await staleCorrection.json()).error).toBe('STALE_STATE');
});

test('caregiver has no rule controls and rule reads honor scope, expiry and disabled identity',async({page})=>{
 const h=await setup();await seed(h);
 const manager=await open(page,h.caregiver.token);
 await expect(manager.getByRole('form',{name:'Create routine rule'})).toHaveCount(0);
 await expect(manager.getByRole('button',{name:'Save routine changes'})).toHaveCount(0);
 const refused=await request(h.caregiver.token,`/api/households/${h.householdId}/routine-rules`,'POST',{...await h.state(),pet_id:h.pet.id,kind:'water',instruction:'Fictional.',schedule_spec:schedule});
 expect(refused.status).toBe(403);
 const foreign=await setup();
 expect((await request(foreign.owner.token,`/api/households/${h.householdId}/routine-rules`)).status).toBe(403);
 await pool.query('update memberships set pet_scope=$3 where household_id=$1 and profile_id=$2',[h.householdId,h.caregiver.actor.userId,[]]);
 const scoped=await request(h.caregiver.token,`/api/households/${h.householdId}/routine-rules`);
 expect(scoped.status).toBe(200);expect((await scoped.json()).rules).toEqual([]);
 await pool.query("update memberships set expires_at=now()-interval '1 second' where household_id=$1 and profile_id=$2",[h.householdId,h.caregiver.actor.userId]);
 expect((await request(h.caregiver.token,`/api/households/${h.householdId}/routine-rules`)).status).toBe(403);
 await pool.query("update profiles set status='disabled' where id=$1",[h.owner.actor.userId]);
 expect((await request(h.owner.token,`/api/households/${h.householdId}/routine-rules`)).status).toBe(401);
});

test('stale rule edit is refused; outage does not invent a save and unchanged retry keeps the key',async({page})=>{
 const h=await setup();await seed(h);
 const manager=await open(page,h.owner.token),editor=manager.getByRole('form',{name:`Edit routine ${h.pet.nickname} water`});
 await expect(editor.getByLabel('Owner instruction')).toHaveValue('Fictional owner routine record.');
 const baseline=await h.state();
 await pool.query('update households set state_version=state_version+1 where id=$1',[h.householdId]);
 await editor.getByLabel('Owner instruction').fill('Stale fictional edit.');
 const refused=page.waitForResponse(response=>response.request().method()==='PUT'&&response.url().includes(`/api/households/${h.householdId}/routine-rules/`));
 await editor.getByRole('button',{name:'Save routine changes'}).click();
 const stale=await refused;
 expect(stale.request().postDataJSON().expected_state_version).toBe(baseline.expected_state_version);
 expect(stale.status()).toBe(409);
 await expect(manager.getByRole('alert')).toContainText('STALE_STATE');
 await manager.getByRole('button',{name:'Retrieve routine records again'}).click();
 const form=manager.getByRole('form',{name:'Create routine rule'});
 await form.getByLabel('Routine pet').selectOption(h.pet.id);
 await form.getByLabel('Owner instruction').fill('Retry fictional routine.');
 const keys:string[]=[];
 await page.route(`**/api/households/${h.householdId}/routine-rules`,async route=>{if(route.request().method()==='POST'){keys.push(route.request().headers()['idempotency-key']);await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SIMULATED_LOCAL_OUTAGE'})});}else await route.continue();});
 await form.getByRole('button',{name:'Create routine rule',exact:true}).click();
 await expect(manager.getByRole('alert')).toContainText('SIMULATED_LOCAL_OUTAGE');
 await expect(manager.getByText('Routine rule created.')).toHaveCount(0);
 await form.getByRole('button',{name:'Create routine rule',exact:true}).click();
 await expect.poll(()=>keys.length).toBe(2);
 expect(keys[0]).toBe(keys[1]);
});

test('routine read outage removes current records and controls until a fresh successful read',async({page})=>{
 const h=await setup();await seed(h);const manager=await open(page,h.owner.token);
 await expect(manager.getByRole('form',{name:'Create routine rule'})).toBeVisible();
 await page.route(`**/api/households/${h.householdId}/routine-rules`,async route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SIMULATED_LOCAL_READ_OUTAGE'})}));
 await manager.getByRole('button',{name:'Retrieve routine records again'}).click();
 await expect(manager.getByRole('alert')).toContainText('SIMULATED_LOCAL_READ_OUTAGE');
 await expect(manager.getByRole('form',{name:'Create routine rule'})).toHaveCount(0);
 await expect(manager.getByRole('button',{name:'Claim task'})).toHaveCount(0);
 await page.unroute(`**/api/households/${h.householdId}/routine-rules`);
 await manager.getByRole('button',{name:'Retrieve routine records again'}).click();
 await expect(manager.getByRole('form',{name:'Create routine rule'})).toBeVisible();
});
