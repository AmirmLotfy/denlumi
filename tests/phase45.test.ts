import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../packages/domain/db';
import { testHousehold } from './helpers';
import { householdGraph } from '../packages/domain/household';
import { acknowledgeHandover,draftPlan,replaceHomePlan,reviewPlan,routeCase } from '../packages/domain/planning';
import { bindState } from '../packages/contracts/phase0';
import { getBrief,pauseGuidance } from '../packages/domain/state';
import { confirmSessionObservation,correctSessionObservation,finishSession,interruptTimedOutSessions,pauseSession,reconcileWithdrawnProtocols,recordSessionObservation,resumeSession,sessionPreflight,startSession } from '../packages/domain/sessions';
import { claimTask,createRoutine,generateOccurrences,listDueTasks,listInbox,processOutbox,reportTask,updateRoutine,wallClockInstant } from '../packages/domain/routines';
import { authClient } from '../packages/domain/auth';

after(()=>pool.end());
const denied=(p:Promise<unknown>,code:string)=>assert.rejects(p,(e:any)=>e.code===code);
const expected=async(actor:any,id:string)=>{const g=await householdGraph(actor,id);return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};

async function reviewed(fixture:'cat_dog'|'cat_cat'|'dog_dog'|'single_cat'|'single_dog'='cat_dog'){
 const t=await testHousehold(fixture);
 await routeCase(t.owner.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),intake_schema_version:'1',answers:{fictional:true},unknowns:[]},randomUUID());
 await replaceHomePlan(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),zones:[],responsibilities:[]},randomUUID());
 const draft=await draftPlan(t.owner.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),locale:'en'},randomUUID()) as any;
 const review=await reviewPlan(t.owner.actor,draft.value.plan_revision_id,{...await expected(t.owner.actor,t.householdId),reviewed_digest:draft.value.digest},randomUUID()) as any;
 await acknowledgeHandover(t.caregiver.actor,review.value.handover_id,{acknowledged_digest:review.value.handover_digest},randomUUID());
 const brief=await getBrief(t.caregiver.actor,t.householdId);
 return {...t,brief,state:bindState(brief),handover:{id:review.value.handover_id,digest:review.value.handover_digest}};
}

const observation=(state:any,pets:any[],extra:Record<string,unknown>={})=>({expected_safety_epoch:state.expected_safety_epoch,expected_state:'active',raw_report:'A fictional caregiver report.',actor_pet_id:pets[0]?.id??null,target_pet_id:pets[1]?.id??null,assertion:'uncertain',source_kind:'typed',observed_at:'2026-09-22T08:05:00+02:00',reported_at:'2026-09-22T08:10:00+02:00',behavior_code:null,normalized_observation:{schema_version:'1',values:{},unknowns:['meaning']},...extra});

test('browser/MCP household stop invalidates an active session and its dependent work without clearing urgent restrictions',async()=>{
 const t=await reviewed();const start=await startSession(t.caregiver.actor,{...t.state,handover_id:t.handover.id,handover_digest:t.handover.digest},randomUUID());
 const step=(await pool.query('select id from plan_steps where plan_revision_id=$1 limit 1',[t.state.plan_revision_id])).rows[0];
 await pool.query("insert into task_occurrences(household_id,plan_step_id,due_at,expected_safety_epoch,occurrence_key) values($1,$2,now(),$3,$4)",[t.householdId,step.id,t.state.expected_safety_epoch,randomUUID()]);
 await pool.query("update cases set support_level='urgent_help' where id=$1",[t.caseId]);
 await pauseGuidance(t.caregiver.actor,{...t.state,reason:'Local Stop synchronization'},randomUUID());
 assert.equal((await pool.query('select state from sessions where id=$1',[start.session_id])).rows[0].state,'paused');
 assert.equal((await pool.query('select support_level from cases where id=$1',[t.caseId])).rows[0].support_level,'urgent_help');
 assert.equal((await pool.query('select state from task_occurrences where plan_step_id=$1',[step.id])).rows[0].state,'canceled');
 await denied(resumeSession(t.caregiver.actor,start.session_id,{expected_safety_epoch:t.state.expected_safety_epoch,expected_state:'paused'},randomUUID()),'STALE_STATE');
});

test('explicit human start is fresh, idempotent, conflict-safe and never advances a plan clock',async()=>{
 const t=await reviewed();
 const preflight=await sessionPreflight(t.caregiver.actor,t.state);assert.equal(preflight.status,'ready_for_human_start');assert.equal(preflight.start_destination,'/api/sessions');
 const body={...t.state,handover_id:t.handover.id,handover_digest:t.handover.digest},key=randomUUID();
 const first=await startSession(t.caregiver.actor,body,key);const replay=await startSession(t.caregiver.actor,body,key);assert.deepEqual(replay,first);
 await denied(startSession(t.caregiver.actor,{...body,handover_digest:'0'.repeat(64)},key),'IDEMPOTENCY_MISMATCH');
 await denied(startSession(t.caregiver.actor,body,randomUUID()),'SESSION_CONFLICT');
 const stepBefore=(await pool.query('select current_step from plan_revisions where id=$1',[t.state.plan_revision_id])).rows[0].current_step;
 await new Promise(r=>setTimeout(r,10));
 assert.equal((await pool.query('select current_step from plan_revisions where id=$1',[t.state.plan_revision_id])).rows[0].current_step,stepBefore);
 assert.equal((await pool.query('select count(*)::int n from sessions where household_id=$1',[t.householdId])).rows[0].n,1);
 await finishSession(t.caregiver.actor,first.session_id,{expected_safety_epoch:t.state.expected_safety_epoch,expected_state:'active'},randomUUID());
});

test('draft preserves direction, negation, uncertainty and times; confirmed concern pauses atomically; correction appends',async()=>{
 const t=await reviewed();const started=await startSession(t.caregiver.actor,{...t.state,handover_id:t.handover.id,handover_digest:t.handover.digest},randomUUID());
 const ambiguous=await recordSessionObservation(t.caregiver.actor,started.session_id,observation(t.state,t.brief.pets,{actor_pet_id:null}),randomUUID());assert.equal(ambiguous.needs_attribution,true);
 await denied(confirmSessionObservation(t.caregiver.actor,started.session_id,{expected_safety_epoch:t.state.expected_safety_epoch,expected_state:'active',observation_id:ambiguous.observation_id,digest:ambiguous.digest},randomUUID()),'CLARIFICATION_REQUIRED');
 const negated=await recordSessionObservation(t.caregiver.actor,started.session_id,observation(t.state,t.brief.pets,{assertion:'negated',normalized_observation:{schema_version:'1',values:{requires_pause:true,policy_level:'professional'},unknowns:[]}}),randomUUID());
 const noPause=await confirmSessionObservation(t.caregiver.actor,started.session_id,{expected_safety_epoch:t.state.expected_safety_epoch,expected_state:'active',observation_id:negated.observation_id,digest:negated.digest},randomUUID());assert.equal(noPause.consequence,'record_only');
 const step=(await pool.query('select id from plan_steps where plan_revision_id=$1 limit 1',[t.state.plan_revision_id])).rows[0];await pool.query("insert into task_occurrences(household_id,plan_step_id,due_at,expected_safety_epoch,occurrence_key) values($1,$2,now()+interval '1 day',$3,$4)",[t.householdId,step.id,t.state.expected_safety_epoch,randomUUID()]);
 const concern=await recordSessionObservation(t.caregiver.actor,started.session_id,observation(t.state,t.brief.pets,{assertion:'affirmed',normalized_observation:{schema_version:'1',values:{requires_pause:true,policy_level:'professional'},unknowns:[]}}),randomUUID());
 const paused=await confirmSessionObservation(t.caregiver.actor,started.session_id,{expected_safety_epoch:t.state.expected_safety_epoch,expected_state:'active',observation_id:concern.observation_id,digest:concern.digest},randomUUID());assert.equal(paused.consequence,'guidance_paused');assert.equal(paused.safety_epoch,t.state.expected_safety_epoch+1);
 const snapshot=(await pool.query(`select h.safety_epoch,s.state session_state,p.status plan_status,c.support_level,
  (select count(*)::int from safety_holds where household_id=h.id and state='active') holds,
  (select count(*)::int from task_occurrences where household_id=h.id and state='canceled') canceled_tasks,
  (select count(*)::int from handovers where household_id=h.id and status='published' and safety_epoch=h.safety_epoch) handovers,
  (select count(*)::int from outbox_events where household_id=h.id and state='pending' and expected_safety_epoch=h.safety_epoch) outbox
  from households h join sessions s on s.household_id=h.id join plan_revisions p on p.id=s.plan_revision_id join cases c on c.id=s.case_id where h.id=$1`,[t.householdId])).rows[0];
 assert.deepEqual({epoch:snapshot.safety_epoch,state:snapshot.session_state,plan:snapshot.plan_status,level:snapshot.support_level,holds:snapshot.holds,tasks:snapshot.canceled_tasks,handovers:snapshot.handovers,outbox:snapshot.outbox},{epoch:t.state.expected_safety_epoch+1,state:'paused',plan:'stale',level:'professional_required',holds:1,tasks:1,handovers:1,outbox:1});
 await denied(resumeSession(t.caregiver.actor,started.session_id,{expected_safety_epoch:t.state.expected_safety_epoch,expected_state:'paused'},randomUUID()),'STALE_STATE');
 const corrected=await correctSessionObservation(t.caregiver.actor,started.session_id,{expected_safety_epoch:paused.safety_epoch,expected_state:'paused',observation_id:concern.observation_id,original_digest:concern.digest,raw_report:'Corrected fictional report.',actor_pet_id:t.brief.pets[0].id,target_pet_id:t.brief.pets[1].id,assertion:'uncertain',source_kind:'typed',observed_at:'2026-09-22T08:05:00+02:00',reported_at:'2026-09-22T08:20:00+02:00',correction_reason:'The earlier words were wrong.'},randomUUID());assert.equal(corrected.hold_cleared,false);
 assert.equal((await pool.query('select count(*)::int n from observations where id=$1 or supersedes_id=$1',[concern.observation_id])).rows[0].n,2);
 assert.equal((await pool.query("select count(*)::int n from safety_holds where household_id=$1 and state='active'",[t.householdId])).rows[0].n,1);
});

test('manual pause creates no professional hold; heartbeat timeout interrupts and explicit fresh resume is required',async()=>{
 const manual=await reviewed('cat_cat');const s=await startSession(manual.caregiver.actor,{...manual.state,handover_id:manual.handover.id,handover_digest:manual.handover.digest},randomUUID());
 await pauseSession(manual.caregiver.actor,s.session_id,{expected_safety_epoch:manual.state.expected_safety_epoch,expected_state:'active',reason:'Caregiver chose to stop software.'},randomUUID());
 assert.equal((await pool.query('select count(*)::int n from safety_holds where household_id=$1',[manual.householdId])).rows[0].n,0);
 const timed=await reviewed('dog_dog');const active=await startSession(timed.caregiver.actor,{...timed.state,handover_id:timed.handover.id,handover_digest:timed.handover.digest},randomUUID());
 const interrupted=await interruptTimedOutSessions(new Date(Date.now()+60_000));assert.ok(interrupted.interrupted.includes(active.session_id));
 const row=(await pool.query('select state,interruption_reason from sessions where id=$1',[active.session_id])).rows[0];assert.deepEqual(row,{state:'interrupted',interruption_reason:'heartbeat_timeout'});
 const resumed=await resumeSession(timed.caregiver.actor,active.session_id,{expected_safety_epoch:timed.state.expected_safety_epoch,expected_state:'interrupted'},randomUUID());assert.equal(resumed.state,'active');assert.equal(resumed.physical_state_verified,false);
});

test('protocol withdrawal pauses the bound session and preserves historical version identity',async()=>{
 const t=await reviewed('single_cat');const active=await startSession(t.caregiver.actor,{...t.state,handover_id:t.handover.id,handover_digest:t.handover.digest},randomUUID());await pool.query('update protocol_versions set revoked_at=now() where id=$1',[t.state.protocol_version_id]);
 try{const result=await reconcileWithdrawnProtocols();assert.ok(result.paused.includes(active.session_id));const row=(await pool.query('select state,protocol_version_id,interruption_reason from sessions where id=$1',[active.session_id])).rows[0];assert.deepEqual(row,{state:'paused',protocol_version_id:t.state.protocol_version_id,interruption_reason:'protocol_withdrawn'});await denied(resumeSession(t.caregiver.actor,active.session_id,{expected_safety_epoch:t.state.expected_safety_epoch+1,expected_state:'paused'},randomUUID()),'STALE_STATE');}
 finally{await pool.query('update protocol_versions set revoked_at=null where id=$1',[t.state.protocol_version_id]);}
});

test('protocol withdrawal pauses an interrupted session without erasing its historical binding',async()=>{
 const t=await reviewed('single_dog');const active=await startSession(t.caregiver.actor,{...t.state,handover_id:t.handover.id,handover_digest:t.handover.digest},randomUUID());
 await pool.query("update sessions set state='interrupted',interruption_reason='heartbeat_timeout' where id=$1",[active.session_id]);
 await pool.query('update protocol_versions set revoked_at=now() where id=$1',[t.state.protocol_version_id]);
 try{
  const result=await reconcileWithdrawnProtocols();assert.ok(result.paused.includes(active.session_id));
  const row=(await pool.query('select state,protocol_version_id,interruption_reason from sessions where id=$1',[active.session_id])).rows[0];
  assert.deepEqual(row,{state:'paused',protocol_version_id:t.state.protocol_version_id,interruption_reason:'protocol_withdrawn'});
  assert.ok(result.invalidated_plans.includes(t.state.plan_revision_id));
 }finally{await pool.query('update protocol_versions set revoked_at=null where id=$1',[t.state.protocol_version_id]);}
});

test('withdrawal invalidates every affected reviewed plan, even without a session, and cancels queued prompts',async()=>{
 const active=await reviewed('cat_cat'),waiting=await reviewed('cat_cat'),unrelated=await reviewed('dog_dog');
 const started=await startSession(active.caregiver.actor,{...active.state,handover_id:active.handover.id,handover_digest:active.handover.digest},randomUUID());
 await pool.query("insert into outbox_events(household_id,event_type,payload,expected_safety_epoch,idempotency_key,state) values($1,'routine_due',$2,$3,$4,'pending')",[waiting.householdId,JSON.stringify({schema_version:'1',recipient_id:waiting.owner.actor.userId}),waiting.state.expected_safety_epoch,randomUUID()]);
 await pool.query('update protocol_versions set revoked_at=now() where id=$1',[active.state.protocol_version_id]);
 try{
  const result=await reconcileWithdrawnProtocols();
  assert.ok(result.paused.includes(started.session_id));
  assert.ok(result.invalidated_plans.includes(active.state.plan_revision_id));
  assert.ok(result.invalidated_plans.includes(waiting.state.plan_revision_id));
  for(const t of [active,waiting]){
   const row=(await pool.query('select h.safety_epoch,p.status plan_status,c.status case_status from households h join plan_revisions p on p.household_id=h.id join cases c on c.id=p.case_id where p.id=$1',[t.state.plan_revision_id])).rows[0];
   assert.deepEqual(row,{safety_epoch:t.state.expected_safety_epoch+1,plan_status:'stale',case_status:'paused'});
   await denied(sessionPreflight(t.caregiver.actor,t.state),'STALE_STATE');
  }
  const queued=(await pool.query("select state from outbox_events where household_id=$1 and event_type='routine_due' order by created_at desc limit 1",[waiting.householdId])).rows[0];
  assert.equal(queued.state,'canceled');
  const other=(await pool.query('select h.safety_epoch,p.status from households h join plan_revisions p on p.household_id=h.id where p.id=$1',[unrelated.state.plan_revision_id])).rows[0];
  assert.deepEqual(other,{safety_epoch:unrelated.state.expected_safety_epoch,status:'reviewed'});
  const replay=await reconcileWithdrawnProtocols();
  assert.ok(!replay.invalidated_plans.includes(active.state.plan_revision_id));
  assert.ok(!replay.invalidated_plans.includes(waiting.state.plan_revision_id));
 }finally{
  await pool.query('update protocol_versions set revoked_at=null where id=$1',[active.state.protocol_version_id]);
 }
});

test('owner routines generate deterministic DST-safe occurrences and never infer ingestion',async()=>{
 assert.equal(wallClockInstant('2026-03-08','02:30','America/New_York'),'2026-03-08T07:00:00.000Z');
 assert.equal(wallClockInstant('2026-11-01','01:30','America/New_York'),'2026-11-01T05:30:00.000Z');
 const t=await testHousehold('single_dog');const pet=(await householdGraph(t.owner.actor,t.householdId)).pets[0].id;
 const created=await createRoutine(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),pet_id:pet,kind:'meal',instruction:'Owner record: morning meal.',schedule_spec:{schema_version:'1',timezone:'Africa/Cairo',frequency:'daily',local_time:'00:01',days_of_week:[],dst_policy:'wall_clock_first_valid'}},randomUUID()) as any;assert.equal(created.value.source,'owner_entered');
 const generated=await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),from_date:'2026-09-22',through_date:'2026-09-22'},randomUUID()) as any;assert.equal(generated.value.created,1);
 const again=await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),from_date:'2026-09-22',through_date:'2026-09-22'},randomUUID()) as any;assert.equal(again.value.created,0);
 const due=await listDueTasks(t.owner.actor,t.householdId,48);assert.equal(due.tasks.length,1);assert.equal(due.tasks[0].has_report,false);assert.equal(due.tasks[0].ingestion_verified,false);assert.match(due.notice,/No report/);
 await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),from_date:'2027-03-14',through_date:'2027-03-14'},randomUUID());const changed=await updateRoutine(t.owner.actor,t.householdId,created.value.routine_rule_id,{...await expected(t.owner.actor,t.householdId),expected_rule_version:1,pet_id:pet,kind:'meal',instruction:'Owner record: changed morning meal time.',status:'active',schedule_spec:{schema_version:'1',timezone:'America/New_York',frequency:'daily',local_time:'03:30',days_of_week:[],dst_policy:'wall_clock_first_valid'}},randomUUID()) as any;assert.equal(changed.value.version,2);assert.equal(changed.value.canceled_future_occurrences,1);const v2=await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),from_date:'2027-03-14',through_date:'2027-03-14'},randomUUID()) as any;assert.equal(v2.value.created,1);const history=(await pool.query('select occurrence_key,state from task_occurrences where routine_rule_id=$1 and occurrence_key like $2 order by occurrence_key',[created.value.routine_rule_id,'%2027-03-14%'])).rows;assert.equal(history.length,2);assert.deepEqual(history.map(r=>r.state).sort(),['canceled','planned']);
});

test('task report retries deduplicate while caregiver conflicts and corrections remain attributed',async()=>{
 const t=await testHousehold('single_cat'),pet=(await householdGraph(t.owner.actor,t.householdId)).pets[0].id;await createRoutine(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),pet_id:pet,kind:'water',instruction:'Owner record: refresh water.',schedule_spec:{schema_version:'1',timezone:'Africa/Cairo',frequency:'daily',local_time:'00:01',days_of_week:[],dst_policy:'wall_clock_first_valid'}},randomUUID());await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),from_date:'2026-09-22',through_date:'2026-09-22'},randomUUID());
 const task=(await pool.query('select id from task_occurrences where household_id=$1',[t.householdId])).rows[0],key=randomUUID();const owner=await reportTask(t.owner.actor,task.id,{report:'done',performed_at:'2026-09-22T06:00:00+02:00',note:'Owner report.'},key);assert.deepEqual(await reportTask(t.owner.actor,task.id,{report:'done',performed_at:'2026-09-22T06:00:00+02:00',note:'Owner report.'},key),owner);
 const conflict=await reportTask(t.caregiver.actor,task.id,{report:'skipped',performed_at:null,note:'Caregiver report.'},randomUUID());assert.equal(conflict.conflict,true);assert.equal(conflict.effective_state,'uncertain');assert.equal(conflict.reports.length,2);
 const caregiverReport=conflict.reports.find((r:any)=>r.reporter_id===t.caregiver.actor.userId);const correction=await reportTask(t.caregiver.actor,task.id,{report:'correction',supersedes_id:(await pool.query('select id from task_reports where task_occurrence_id=$1 and reporter_id=$2',[task.id,t.caregiver.actor.userId])).rows[0].id,corrected_report:'done',performed_at:'2026-09-22T06:01:00+02:00',note:'Correction: it was done.'},randomUUID());assert.equal(correction.effective_state,'reported_done');assert.equal(correction.conflict,false);assert.ok(caregiverReport);
 assert.equal((await pool.query('select count(*)::int n from task_reports where task_occurrence_id=$1',[task.id])).rows[0].n,3);
});

test('task writes honor case scope and stale plan epoch while independent routines retain their own scope',async()=>{
 const t=await reviewed('cat_dog');
 const step=(await pool.query('select id from plan_steps where plan_revision_id=$1 limit 1',[t.state.plan_revision_id])).rows[0];
 const planTask=(await pool.query('insert into task_occurrences(household_id,plan_step_id,due_at,expected_safety_epoch,occurrence_key) values($1,$2,now(),$3,$4) returning id',[t.householdId,step.id,t.state.expected_safety_epoch,randomUUID()])).rows[0];
 const pet=(await householdGraph(t.owner.actor,t.householdId)).pets[0];
 await createRoutine(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),pet_id:pet.id,kind:'water',instruction:'Fictional owner record: water check.',schedule_spec:{schema_version:'1',timezone:'Africa/Cairo',frequency:'daily',local_time:'00:01',days_of_week:[],dst_policy:'wall_clock_first_valid'}},randomUUID());
 const date=new Date().toISOString().slice(0,10);
 await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),from_date:date,through_date:date},randomUUID());
 const routineTask=(await pool.query('select id from task_occurrences where household_id=$1 and routine_rule_id is not null limit 1',[t.householdId])).rows[0];
 await pool.query("update memberships set case_scope='{}'::uuid[] where household_id=$1 and profile_id=$2",[t.householdId,t.caregiver.actor.userId]);
 await denied(claimTask(t.caregiver.actor,planTask.id,{expected_state:'planned'},randomUUID()),'SCOPE_MISMATCH');
 await denied(reportTask(t.caregiver.actor,planTask.id,{report:'done',performed_at:null,note:null},randomUUID()),'SCOPE_MISMATCH');
 await denied(reportTask(t.caregiver.actor,routineTask.id,{report:'done',performed_at:null,note:null},randomUUID()),'SCOPE_MISMATCH');
 await pool.query('update memberships set case_scope=null where household_id=$1 and profile_id=$2',[t.householdId,t.caregiver.actor.userId]);
 await replaceHomePlan(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),zones:[],responsibilities:[]},randomUUID());
 await denied(claimTask(t.caregiver.actor,planTask.id,{expected_state:'planned'},randomUUID()),'STALE_STATE');
 await denied(reportTask(t.caregiver.actor,planTask.id,{report:'done',performed_at:null,note:null},randomUUID()),'STALE_STATE');
});

test('outbox rechecks epoch and recipient, is duplicate-safe, and inbox exposes failure or uncertainty honestly',async()=>{
 const processOne=async(id:string,outcome:'success'|'failure'|'uncertain'='success')=>{for(let n=0;n<30;n++){const batch=await processOutbox(50,outcome);const own=batch.find((x:any)=>x.id===id);if(own)return own;}throw Error('OWN_OUTBOX_EVENT_NOT_PROCESSED');};
 const stale=await testHousehold('single_cat');const staleId=(await pool.query("insert into outbox_events(household_id,event_type,payload,expected_safety_epoch,idempotency_key,state) values($1,'routine_due',$2,$3,$4,'pending') returning id",[stale.householdId,JSON.stringify({schema_version:'1',recipient_id:stale.owner.actor.userId}),1,randomUUID()])).rows[0].id;await pool.query('update households set safety_epoch=safety_epoch+1 where id=$1',[stale.householdId]);assert.equal((await processOne(staleId)).state,'canceled');
 const delivered=await testHousehold('single_dog');const add=async(label:string)=>{const event=(await pool.query("insert into outbox_events(household_id,event_type,payload,expected_safety_epoch,idempotency_key,state) values($1,'routine_due',$2,1,$3,'pending') returning id",[delivered.householdId,JSON.stringify({schema_version:'1',recipient_id:delivered.owner.actor.userId,label}),randomUUID()])).rows[0];return event.id as string;};
 const deliveredId=await add('delivered');assert.equal((await processOne(deliveredId)).state,'delivered');assert.ok(!(await processOutbox(50,'success')).some((x:any)=>x.id===deliveredId));
 const failedId=await add('failure');assert.equal((await processOne(failedId,'failure')).state,'failed');const uncertainId=await add('uncertain');assert.equal((await processOne(uncertainId,'uncertain')).state,'uncertain');assert.ok(!(await processOutbox(50,'success')).some((x:any)=>[deliveredId,failedId,uncertainId].includes(x.id)));
 const inbox=await listInbox(delivered.owner.actor,delivered.householdId);assert.equal(inbox.delivery_statuses_are_distinct,true);assert.ok(inbox.items.some((x:any)=>x.status==='failed'&&x.last_error_code==='INTERNAL_DELIVERY_FAILED'));assert.ok(inbox.items.some((x:any)=>x.status==='uncertain'&&x.last_error_code==='DELIVERY_OUTCOME_UNKNOWN'));
 assert.equal((await pool.query('select count(*)::int n from deliveries where household_id=$1',[delivered.householdId])).rows[0].n,3);
 const revoked=await testHousehold('single_cat');const revokedId=(await pool.query("insert into outbox_events(household_id,event_type,payload,expected_safety_epoch,idempotency_key,state) values($1,'routine_due',$2,1,$3,'pending') returning id",[revoked.householdId,JSON.stringify({schema_version:'1',recipient_id:revoked.caregiver.actor.userId}),randomUUID()])).rows[0].id;await pool.query('update memberships set revoked_at=now() where household_id=$1 and profile_id=$2',[revoked.householdId,revoked.caregiver.actor.userId]);assert.equal((await processOne(revokedId)).reason,'RECIPIENT_NOT_AUTHORIZED');
});

test('Phase 4 and 5 tables are tenant-isolated and reject direct Data API writes',async()=>{
 const own=await testHousehold('single_cat'),foreign=await testHousehold('single_dog');const foreignPet=(await householdGraph(foreign.owner.actor,foreign.householdId)).pets[0].id;
 await createRoutine(foreign.owner.actor,foreign.householdId,{...await expected(foreign.owner.actor,foreign.householdId),pet_id:foreignPet,kind:'rest',instruction:'Foreign owner record.',schedule_spec:{schema_version:'1',timezone:'Africa/Cairo',frequency:'daily',local_time:'00:01',days_of_week:[],dst_policy:'wall_clock_first_valid'}},randomUUID());await generateOccurrences(foreign.owner.actor,foreign.householdId,{...await expected(foreign.owner.actor,foreign.householdId),from_date:'2026-09-22',through_date:'2026-09-22'},randomUUID());
 for(const table of ['sessions','session_pets','routine_rules','task_occurrences','task_claims','task_reports','deliveries']){const read=await authClient(own.owner.token).from(table).select('*').eq('household_id',foreign.householdId);assert.equal(read.error,null);assert.deepEqual(read.data,[]);const write=await authClient(own.owner.token).from(table).insert({household_id:own.householdId});assert.ok(write.error,`${table} unexpectedly allowed Data API write`);}
});
