import { randomUUID } from 'node:crypto';
import { expect,test,type Page } from './database-test';
import { testHousehold } from '../helpers';
import type { FixtureName } from '../../packages/contracts/phase0';
import { bindState } from '../../packages/contracts/phase0';
import { householdGraph } from '../../packages/domain/household';
import { acknowledgeHandover,draftPlan,reviewPlan,routeCase } from '../../packages/domain/planning';
import { getBrief } from '../../packages/domain/state';
import { confirmSessionObservation,finishSession,pauseSession,recordSessionObservation,startSession } from '../../packages/domain/sessions';
import { pool } from '../../packages/domain/db';

async function active(page:Page,fixture:FixtureName='cat_dog',starter:'owner'|'caregiver'='owner'){
 const h=await testHousehold(fixture),actor=h.owner.actor;
 const expected=async()=>{const g=await householdGraph(actor,h.householdId);return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};
 await routeCase(actor,h.caseId,{...await expected(),intake_schema_version:'1',answers:{fictional:true},unknowns:[]},randomUUID());
 const plan=await draftPlan(actor,h.caseId,{...await expected(),locale:'en'},randomUUID()) as any;
 const review=await reviewPlan(actor,plan.value.plan_revision_id,{...await expected(),reviewed_digest:plan.value.digest},randomUUID()) as any;
 const identity=h[starter];
 await acknowledgeHandover(identity.actor,review.value.handover_id,{acknowledged_digest:review.value.handover_digest},randomUUID());
 const brief=await getBrief(identity.actor,h.householdId);
 const session=await startSession(identity.actor,{...bindState(brief),handover_id:review.value.handover_id,handover_digest:review.value.handover_digest},randomUUID());
 await page.context().addCookies([{name:'denlumi_session',value:identity.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'}]);
 await page.goto('/');
 const journey=page.getByRole('region',{name:'Review this fictional case'});
 await expect(journey.getByText('Session · active',{exact:true})).toBeVisible();
 return {...h,brief,id:session.session_id,journey,action:{expected_safety_epoch:brief.safety_epoch,expected_state:'active' as const}};
}

for(const fixture of ['cat_cat','dog_dog','cat_dog'] as const)test(`W02 ${fixture}: explicit checkpoint, pause, fresh resume and finish release the unresolved session`,async({page})=>{
 const h=await active(page,fixture);
 await expect(h.journey.getByRole('button',{name:'Save software checkpoint',exact:true})).toBeVisible({timeout:2000});
 await h.journey.getByRole('button',{name:'Save software checkpoint',exact:true}).click();
 await expect(h.journey.getByRole('status').filter({hasText:'Software checkpoint saved'})).toBeVisible();
 await h.journey.getByLabel('Software pause reason').fill('Fictional caregiver takes a break.');
 await h.journey.getByRole('button',{name:'Pause software session',exact:true}).click();
 await expect(h.journey.getByText('Session · paused',{exact:true})).toBeVisible();
 await h.journey.getByRole('button',{name:'Check and resume software session',exact:true}).click();
 await expect(h.journey.getByText('Session · active',{exact:true})).toBeVisible();
 await h.journey.getByRole('button',{name:'Finish software session',exact:true}).click();
 await expect(h.journey.getByText('Session · active',{exact:true})).toHaveCount(0);
 await expect(h.journey.getByText('Latest session · finished',{exact:true})).toBeVisible();
 await expect(h.journey.getByRole('button',{name:'Save fictional intake'})).toBeEnabled();
 await expect(h.journey.getByRole('button',{name:'Check session preflight'})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
 expect((await pool.query('select state from sessions where id=$1',[h.id])).rows[0].state).toBe('finished');
});

test('W02 interrupted session requires a human resume; a persisted local Stop blocks it',async({page})=>{
 const h=await active(page);
 await expect(h.journey.getByRole('button',{name:'Pause software session',exact:true})).toBeVisible({timeout:2000});
 await pool.query("update sessions set state='interrupted',interruption_reason='heartbeat_timeout' where id=$1",[h.id]);
 await page.reload();
 await expect(h.journey.getByText('Session · interrupted',{exact:true})).toBeVisible();
 await h.journey.getByRole('button',{name:'Check and resume software session',exact:true}).click();
 await expect(h.journey.getByText('Session · active',{exact:true})).toBeVisible();
 await pauseSession(h.owner.actor,h.id,{...h.action,reason:'Fictional pause'},randomUUID());
 await page.evaluate(id=>localStorage.setItem(`denlumi-stop-${id}`,'synced'),h.householdId);
 await page.reload();
 await expect(h.journey.getByRole('button',{name:'Check and resume software session',exact:true})).toBeDisabled();
 await expect(h.journey.getByText(/Local Stop is active/)).toBeVisible();
 await expect(h.journey.getByRole('button',{name:'Finish software session',exact:true})).toBeEnabled();
});

test('W02 correction preserves original direction, timestamps and provenance without clearing a hold',async({page})=>{
 const h=await active(page),observed='2026-10-19T09:25:00.000Z';
 const draft=await recordSessionObservation(h.owner.actor,h.id,{...h.action,raw_report:'Fictional report: Finn moved toward Nora.',actor_pet_id:h.brief.pets[0].id,target_pet_id:h.brief.pets[1].id,assertion:'affirmed',source_kind:'typed',observed_at:observed,reported_at:null,behavior_code:null,normalized_observation:{schema_version:'1',values:{requires_pause:true,policy_level:'professional'},unknowns:[]}},randomUUID());
 await confirmSessionObservation(h.owner.actor,h.id,{...h.action,observation_id:draft.observation_id,digest:draft.digest},randomUUID());
 await page.reload();
 await expect(h.journey.getByRole('button',{name:'Append correction',exact:true})).toBeVisible({timeout:2000});
 await h.journey.getByRole('button',{name:'Append correction',exact:true}).click();
 await h.journey.getByLabel('Corrected exact fictional report').fill('Fictional correction: Finn did not move toward Nora.');
 await h.journey.getByLabel('Corrected report meaning').selectOption('negated');
 await h.journey.getByLabel('Reason for this correction').fill('The earlier wording reversed the meaning.');
 await h.journey.getByRole('button',{name:'Save append-only correction',exact:true}).click();
 await expect(h.journey.getByText('Fictional report: Finn moved toward Nora.',{exact:true})).toBeVisible();
 await expect(h.journey.getByText('Fictional correction: Finn did not move toward Nora.',{exact:true})).toBeVisible();
 await expect(h.journey.getByText(/Reporter: .*Source: typed/)).toHaveCount(2);
 await expect(h.journey.getByText(/Observed: .*2026-10-19T09:25/)).toHaveCount(2);
 await expect(h.journey.getByText('Existing holds remain active. A correction does not authorize resume.',{exact:true})).toBeVisible();
 await h.journey.getByRole('button',{name:'Check and resume software session',exact:true}).click();
 await expect(h.journey.getByRole('alert')).toContainText(/Resume was refused/);
 await expect(h.journey.getByText('Session · paused',{exact:true})).toBeVisible();
 expect((await pool.query("select count(*)::int n from safety_holds where household_id=$1 and state='active'",[h.householdId])).rows[0].n).toBe(1);
 const rows=(await pool.query('select raw_report,status,supersedes_id,assertion,observed_at,source_kind from observations where session_id=$1 order by reported_at',[h.id])).rows;
 expect(rows).toHaveLength(2);expect(rows[0].status).toBe('corrected');expect(rows[1].supersedes_id).toBe(draft.observation_id);expect(rows[1].assertion).toBe('negated');
});

test('W02 stale plan refuses resume and leaves a useful finish path',async({page})=>{
 const h=await active(page);
 await expect(h.journey.getByRole('button',{name:'Pause software session',exact:true})).toBeVisible({timeout:2000});
 await pauseSession(h.owner.actor,h.id,{...h.action,reason:'Fictional pause'},randomUUID());
 await page.reload();
 // Invalidate the bound plan rather than altering a shared protocol fixture.
 await pool.query("update plan_revisions set status='stale' where id=$1",[h.brief.plan_revision_id]);
 await h.journey.getByRole('button',{name:'Check and resume software session',exact:true}).click();
 await expect(h.journey.getByRole('alert')).toContainText(/Resume was refused.*STALE STATE/i);
 await expect(h.journey.getByText('Session · paused',{exact:true})).toBeVisible();
 await h.journey.getByRole('button',{name:'Finish software session',exact:true}).click();
 await expect(h.journey.getByText('Latest session · finished',{exact:true})).toBeVisible();
});

test('W02 a response-lost pause retries the unchanged request key without duplicate audit work',async({page})=>{
 const h=await active(page),keys:string[]=[];
 await expect(h.journey.getByLabel('Software pause reason')).toBeVisible({timeout:2000});
 let first=true;
 await page.route(`**/api/sessions/${h.id}/pause`,async route=>{
  keys.push(route.request().headers()['idempotency-key']);
  if(first){first=false;await route.fetch();await route.abort('failed');}else await route.continue();
 });
 await h.journey.getByLabel('Software pause reason').fill('Fictional pause response lost.');
 await h.journey.getByRole('button',{name:'Pause software session',exact:true}).click();
 await expect(h.journey.getByRole('alert')).toContainText('Pause response unavailable');
 await h.journey.getByRole('button',{name:'Pause software session',exact:true}).click();
 await expect(h.journey.getByText('Session · paused',{exact:true})).toBeVisible();
 expect(keys).toHaveLength(2);expect(keys[1]).toBe(keys[0]);
 expect((await pool.query("select count(*)::int n from audit_events where entity_id=$1 and event_type='session_paused'",[h.id])).rows[0].n).toBe(1);
});


test('W02 withdrawn protocol refuses checkpoints and resume while pause and finish remain available',async({page})=>{
 const h=await active(page);
 await expect(h.journey.getByRole('button',{name:'Save software checkpoint',exact:true})).toBeVisible({timeout:2000});
 const original=(await pool.query('select revoked_at from protocol_versions where id=$1',[h.brief.protocol_version_id])).rows[0];
 try{
  await pool.query('update protocol_versions set revoked_at=now() where id=$1',[h.brief.protocol_version_id]);
  await h.journey.getByRole('button',{name:'Save software checkpoint',exact:true}).click();
  await expect(h.journey.getByRole('alert')).toContainText(/Software checkpoint was refused.*PROTOCOL UNAVAILABLE/i);
  await h.journey.getByRole('button',{name:'Pause software session',exact:true}).click();
  await expect(h.journey.getByText('Session · paused',{exact:true})).toBeVisible();
  await h.journey.getByRole('button',{name:'Check and resume software session',exact:true}).click();
  await expect(h.journey.getByRole('alert')).toContainText(/Resume was refused.*PROTOCOL UNAVAILABLE/i);
  await h.journey.getByRole('button',{name:'Finish software session',exact:true}).click();
  await expect(h.journey.getByText('Latest session · finished',{exact:true})).toBeVisible();
 }finally{await pool.query('update protocol_versions set revoked_at=$2 where id=$1',[h.brief.protocol_version_id,original.revoked_at]);}
});

test('W02 a newly restricted caregiver scope refuses a displayed session action without changing its record',async({page})=>{
 const h=await active(page,'cat_dog','caregiver');
 await expect(h.journey.getByRole('button',{name:'Save software checkpoint',exact:true})).toBeVisible({timeout:2000});
 await pool.query("update memberships set case_scope='{}'::uuid[] where household_id=$1 and profile_id=$2",[h.householdId,h.caregiver.actor.userId]);
 await h.journey.getByRole('button',{name:'Save software checkpoint',exact:true}).click();
 await expect(h.journey.getByRole('alert')).toContainText(/Software checkpoint was refused.*SCOPE MISMATCH/i);
 expect((await pool.query('select state from sessions where id=$1',[h.id])).rows[0].state).toBe('active');
 await expect(h.journey.getByRole('button',{name:'Refresh journey state'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
});

test('W02 finished session accepts an append-only correction without reopening guidance or clearing a hold',async({page})=>{
 const h=await active(page);
 const draft=await recordSessionObservation(h.owner.actor,h.id,{...h.action,raw_report:'Fictional original report before finish.',actor_pet_id:h.brief.pets[0].id,target_pet_id:h.brief.pets[1].id,assertion:'affirmed',source_kind:'typed',observed_at:null,reported_at:null,behavior_code:null,normalized_observation:{schema_version:'1',values:{requires_pause:true,policy_level:'professional'},unknowns:[]}},randomUUID());
 await confirmSessionObservation(h.owner.actor,h.id,{...h.action,observation_id:draft.observation_id,digest:draft.digest},randomUUID());
 await page.reload();
 await h.journey.getByRole('button',{name:'Finish software session',exact:true}).click();
 await expect(h.journey.getByText('Latest session · finished',{exact:true})).toBeVisible();
 await expect(h.journey.getByRole('button',{name:'Append correction',exact:true})).toBeVisible({timeout:2000});
 await h.journey.getByRole('button',{name:'Append correction',exact:true}).click();
 await h.journey.getByLabel('Corrected exact fictional report').fill('Fictional correction after finish: the earlier event did not occur.');
 await h.journey.getByLabel('Corrected report meaning').selectOption('negated');
 await h.journey.getByLabel('Reason for this correction').fill('Correct the meaning after closing the software record.');
 await h.journey.getByRole('button',{name:'Save append-only correction',exact:true}).click();
 await expect(h.journey.getByText('Fictional original report before finish.',{exact:true})).toBeVisible();
 await expect(h.journey.getByText('Fictional correction after finish: the earlier event did not occur.',{exact:true})).toBeVisible();
 await expect(h.journey.getByText('Latest session · finished',{exact:true})).toBeVisible();
 await expect(h.journey.getByRole('button',{name:'Check and resume software session',exact:true})).toHaveCount(0);
 await expect(h.journey.getByText('Existing holds remain active. A correction does not authorize resume.',{exact:true})).toBeVisible();
 const records=(await pool.query('select status,supersedes_id,assertion from observations where session_id=$1 order by reported_at',[h.id])).rows;
 expect(records).toHaveLength(2);expect(records[0].status).toBe('corrected');expect(records[1].supersedes_id).toBe(draft.observation_id);expect(records[1].assertion).toBe('negated');
 expect((await pool.query("select count(*)::int n from safety_holds where household_id=$1 and state='active'",[h.householdId])).rows[0].n).toBe(1);
 expect((await pool.query('select state from sessions where id=$1',[h.id])).rows[0].state).toBe('finished');
});


test('W02 primary caregiver acknowledges, explicitly starts and finishes while owner actions and other reporters controls stay hidden',async({page})=>{
 const h=await active(page);
 const report=await recordSessionObservation(h.owner.actor,h.id,{...h.action,raw_report:'Fictional owner record, no concern classified.',actor_pet_id:h.brief.pets[0].id,target_pet_id:h.brief.pets[1].id,assertion:'negated',source_kind:'typed',observed_at:null,reported_at:null,behavior_code:null,normalized_observation:{schema_version:'1',values:{},unknowns:[]}},randomUUID());
 await confirmSessionObservation(h.owner.actor,h.id,{...h.action,observation_id:report.observation_id,digest:report.digest},randomUUID());
 await page.context().addCookies([{name:'denlumi_session',value:h.caregiver.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'}]);
 await page.reload();
 await expect(h.journey).toBeVisible({timeout:2000});
 await expect(h.journey.getByText('Session · active',{exact:true})).toBeVisible();
 await expect(h.journey.getByRole('button',{name:'Save fictional intake',exact:true})).toHaveCount(0);
 await expect(h.journey.getByRole('button',{name:'Create draft for owner review',exact:true})).toHaveCount(0);
 await expect(h.journey.getByRole('button',{name:'Record owner review',exact:true})).toHaveCount(0);
 await expect(h.journey.getByRole('button',{name:'Sam acknowledges exact handover',exact:true})).toHaveCount(0);
 await expect(h.journey.getByRole('button',{name:'Save software checkpoint',exact:true})).toHaveCount(0);
 await expect(h.journey.getByRole('button',{name:'Finish software session',exact:true})).toHaveCount(0);
 await expect(h.journey.getByRole('button',{name:'Append correction',exact:true})).toHaveCount(0);
 await finishSession(h.owner.actor,h.id,h.action,randomUUID());
 await page.reload();
 await h.journey.getByRole('button',{name:'Acknowledge exact handover',exact:true}).click();
 await h.journey.getByRole('button',{name:'Check session preflight',exact:true}).click();
 await expect(h.journey.getByText('Ready for an explicit human start. This is a fictional software session.')).toBeVisible();
 await h.journey.getByRole('button',{name:'Start fictional software session',exact:true}).click();
 await expect(h.journey.getByText('Session · active',{exact:true})).toBeVisible();
 await h.journey.getByRole('button',{name:'Save software checkpoint',exact:true}).click();
 await h.journey.getByRole('button',{name:'Finish software session',exact:true}).click();
 await expect(h.journey.getByText('Latest session · finished',{exact:true})).toBeVisible();
 const sessions=(await pool.query('select state,started_by from sessions where household_id=$1 order by created_at desc',[h.householdId])).rows;
 expect(sessions).toHaveLength(2);expect(sessions[0].state).toBe('finished');expect(sessions[0].started_by).toBe(h.caregiver.actor.userId);
});
