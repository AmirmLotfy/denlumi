import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool,type Actor } from '../packages/domain/db';
import { testHousehold,testIdentity } from './helpers';
import { householdGraph } from '../packages/domain/household';
import { acknowledgeHandover,draftPlan,replaceHomePlan,reviewPlan,routeCase } from '../packages/domain/planning';
import { bindState } from '../packages/contracts/phase0';
import { getBrief,pauseGuidance,prepareSession } from '../packages/domain/state';
import { checkpointSession,confirmSessionObservation,correctSessionObservation,finishSession,interruptTimedOutSessions,pauseSession,recordSessionObservation,resumeSession,startSession } from '../packages/domain/sessions';

after(()=>pool.end());
const denied=(p:Promise<unknown>,code:string)=>assert.rejects(p,(error:unknown)=>(error as {code:string}).code===code);
const expected=async(actor:Actor,id:string)=>{const g=await householdGraph(actor,id);return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};

async function active(){
 const t=await testHousehold();
 await routeCase(t.owner.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),intake_schema_version:'1',answers:{fictional:true},unknowns:[]},randomUUID());
 await replaceHomePlan(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),zones:[],responsibilities:[]},randomUUID());
 const draft=await draftPlan(t.owner.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),locale:'en'},randomUUID()) as any;
 const review=await reviewPlan(t.owner.actor,draft.value.plan_revision_id,{...await expected(t.owner.actor,t.householdId),reviewed_digest:draft.value.digest},randomUUID()) as any;
 await acknowledgeHandover(t.caregiver.actor,review.value.handover_id,{acknowledged_digest:review.value.handover_digest},randomUUID());
 const brief=await getBrief(t.caregiver.actor,t.householdId),state=bindState(brief);
 const startBody={...state,handover_id:review.value.handover_id,handover_digest:review.value.handover_digest},startKey=randomUUID();
 const started=await startSession(t.caregiver.actor,startBody,startKey);
 return {...t,brief,state,startBody,startKey,started,id:started.session_id,action:{expected_safety_epoch:state.expected_safety_epoch,expected_state:'active' as const}};
}
type Active=Awaited<ReturnType<typeof active>>;

test('session mutation waits for the household before locking its session row',async()=>{
 const t=await active(),gate=await pool.connect(),probe=await pool.connect();
 let pending:Promise<unknown>|undefined;
 try{
  await gate.query('begin');
  await gate.query('select id from households where id=$1 for update',[t.householdId]);
  const pid=(await gate.query('select pg_backend_pid() pid')).rows[0].pid;
  pending=pauseSession(t.caregiver.actor,t.id,{...t.action,reason:'Concurrent fictional pause'},randomUUID());
  let waiting=false;
  for(let attempt=0;attempt<100;attempt++){
   waiting=!!(await probe.query("select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock'",[pid])).rowCount;
   if(waiting)break;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(waiting,true,'mutation must reach the held household lock');
  // A start replay already holds this household before reading the session.
  // If the blocked mutation holds the session first, that replay deadlocks.
  await gate.query('select id from sessions where id=$1 for update nowait',[t.id]);
 }finally{
  await gate.query('rollback');gate.release();probe.release();await pending;
 }
});

test('timeout worker locks the household before its due session and rechecks eligibility',async()=>{
 const t=await active(),gate=await pool.connect(),probe=await pool.connect();
 await pool.query("update sessions set last_checkpoint_at='1900-01-01' where id=$1",[t.id]);
 let pending:ReturnType<typeof interruptTimedOutSessions>|undefined;
 try{
  await gate.query('begin');
  await gate.query('select id from households where id=$1 for update',[t.householdId]);
  const pid=(await gate.query('select pg_backend_pid() pid')).rows[0].pid;
  pending=interruptTimedOutSessions(new Date('1901-01-01'));
  let waiting=false;
  for(let attempt=0;attempt<100;attempt++){
   waiting=!!(await probe.query("select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock'",[pid])).rowCount;
   if(waiting)break;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(waiting,true);
  await gate.query('select id from sessions where id=$1 for update nowait',[t.id]);
  // Simulate a committed pause while the worker waits. Its stale candidate
  // must not become an interrupted session when it acquires the lock.
  await gate.query("update sessions set state='paused' where id=$1",[t.id]);
  await gate.query('commit');
  assert.equal((await pending).interrupted.includes(t.id),false);
  assert.equal((await pool.query('select state from sessions where id=$1',[t.id])).rows[0].state,'paused');
 }finally{
  await gate.query('rollback');gate.release();probe.release();await pending;
 }
});
const report=(t:Active,concern=false)=>({...t.action,raw_report:'Fictional attributed report.',actor_pet_id:t.brief.pets[0].id,target_pet_id:t.brief.pets[1].id,assertion:'uncertain' as const,source_kind:'typed' as const,observed_at:null,reported_at:null,behavior_code:null,normalized_observation:{schema_version:'1' as const,values:concern?{requires_pause:true,policy_level:'professional'}:{},unknowns:[]}});
async function confirmed(t:Active,concern=false){
 const draft=await recordSessionObservation(t.caregiver.actor,t.id,report(t,concern),randomUUID());
 const body={...t.action,observation_id:draft.observation_id,digest:draft.digest};
 return {draft,body};
}
const correction=(t:Active,o:{observation_id:string;digest:string},epoch=t.action.expected_safety_epoch,state:'active'|'paused'='active')=>({expected_safety_epoch:epoch,expected_state:state,observation_id:o.observation_id,original_digest:o.digest,raw_report:'Corrected fictional report.',actor_pet_id:t.brief.pets[0].id,target_pet_id:t.brief.pets[1].id,assertion:'negated',source_kind:'typed',observed_at:null,reported_at:null,correction_reason:'Correct the earlier report without clearing any hold.'});

for(const operation of ['pause','resume','finish'] as const)test(`A04: ${operation} exact replay survives its committed state change; altered body is refused`,async()=>{
 const t=await active(),key=randomUUID();
 if(operation==='resume')await pauseSession(t.caregiver.actor,t.id,{...t.action,reason:'Fictional pause'},randomUUID());
 const input={...t.action,expected_state:operation==='resume'?'paused' as const:'active' as const};
 const call=(body:typeof input)=>operation==='pause'?pauseSession(t.caregiver.actor,t.id,{...body,reason:'Fictional pause'},key):operation==='resume'?resumeSession(t.caregiver.actor,t.id,body,key):finishSession(t.caregiver.actor,t.id,body,key);
 const first=await call(input);
 assert.deepEqual(await call(input),first);
 await denied(call({...input,expected_safety_epoch:input.expected_safety_epoch+1}),'IDEMPOTENCY_MISMATCH');
});

for(const concern of [false,true])test(`A04: confirmation replay survives changed observation${concern?' and epoch':''}`,async()=>{
 const t=await active(),o=await confirmed(t,concern),key=randomUUID();
 const first=await confirmSessionObservation(t.caregiver.actor,t.id,o.body,key);
 assert.deepEqual(await confirmSessionObservation(t.caregiver.actor,t.id,o.body,key),first);
 await denied(confirmSessionObservation(t.caregiver.actor,t.id,{...o.body,digest:'0'.repeat(64)},key),'IDEMPOTENCY_MISMATCH');
 assert.equal((await pool.query('select count(*)::int n from safety_holds where household_id=$1',[t.householdId])).rows[0].n,concern?1:0);
});

test('A04: append-only correction replays once despite the original becoming corrected',async()=>{
 const t=await active(),o=await confirmed(t,true);
 const confirmation=await confirmSessionObservation(t.caregiver.actor,t.id,o.body,randomUUID());
 const body=correction(t,o.draft,confirmation.safety_epoch,'paused'),key=randomUUID();
 const first=await correctSessionObservation(t.caregiver.actor,t.id,body,key);
 assert.deepEqual(await correctSessionObservation(t.caregiver.actor,t.id,body,key),first);
 await denied(correctSessionObservation(t.caregiver.actor,t.id,{...body,correction_reason:'Changed reason'},key),'IDEMPOTENCY_MISMATCH');
 assert.equal((await pool.query('select count(*)::int n from observations where supersedes_id=$1',[o.draft.observation_id])).rows[0].n,1);
 assert.equal((await pool.query("select count(*)::int n from safety_holds where household_id=$1 and state='active'",[t.householdId])).rows[0].n,1);
});

for(const change of ['membership_revoked','membership_expired','scope_changed','session_revoked','foreign_actor','household_expired'] as const)test(`A04/A05: cached session result is inaccessible after ${change}`,async()=>{
 const t=await active(),key=randomUUID(),body={...t.action,reason:'Fictional pause'};
 await pauseSession(t.caregiver.actor,t.id,body,key);
 let actor=t.caregiver.actor;
 if(change==='membership_revoked')await pool.query('update memberships set revoked_at=now() where household_id=$1 and profile_id=$2',[t.householdId,actor.userId]);
 if(change==='membership_expired')await pool.query("update memberships set expires_at=now()-interval '1 second' where household_id=$1 and profile_id=$2",[t.householdId,actor.userId]);
 if(change==='scope_changed')await pool.query('update memberships set pet_scope=$3 where household_id=$1 and profile_id=$2',[t.householdId,actor.userId,[t.brief.pets[0].id]]);
 if(change==='session_revoked')await t.caregiver.admin.auth.admin.signOut(t.caregiver.token,'local');
 if(change==='foreign_actor')actor=(await testIdentity()).actor;
 if(change==='household_expired')await pool.query("update households set expires_at=now()-interval '1 second' where id=$1",[t.householdId]);
 await denied(pauseSession(actor,t.id,body,key),change==='session_revoked'?'UNAUTHORIZED':'SCOPE_MISMATCH');
});

test('A05: expired household rejects every new session mutation without changing records',async()=>{
 const t=await active(),draft=await confirmed(t),old=await confirmed(t);
 await confirmSessionObservation(t.caregiver.actor,t.id,old.body,randomUUID());
 await pool.query("update households set expires_at=now()-interval '1 second' where id=$1",[t.householdId]);
 const calls=[()=>checkpointSession(t.caregiver.actor,t.id,t.action),()=>pauseSession(t.caregiver.actor,t.id,{...t.action,reason:'Fictional stop'},randomUUID()),()=>resumeSession(t.caregiver.actor,t.id,t.action,randomUUID()),()=>finishSession(t.caregiver.actor,t.id,t.action,randomUUID()),()=>recordSessionObservation(t.caregiver.actor,t.id,report(t),randomUUID()),()=>confirmSessionObservation(t.caregiver.actor,t.id,draft.body,randomUUID()),()=>correctSessionObservation(t.caregiver.actor,t.id,correction(t,old.draft),randomUUID())];
 for(const call of calls)await denied(call(),'SCOPE_MISMATCH');
 const snapshot=(await pool.query("select state,(select count(*)::int from observations where session_id=s.id) observations from sessions s where id=$1",[t.id])).rows[0];
 assert.deepEqual(snapshot,{state:'active',observations:2});
});

for(const failure of ['revoked','review_expired','locale_changed','scenario_unmapped'] as const)test(`A07/A08: ${failure} blocks ongoing guidance before reconciliation and hides availability`,async()=>{
 const t=await active();
 const v=(await pool.query('select * from protocol_versions where id=$1',[t.state.protocol_version_id])).rows[0];
 const currentCase=(await pool.query('select scenario_code from cases where id=$1',[t.caseId])).rows[0];
 try{
  if(failure==='revoked')await pool.query('update protocol_versions set revoked_at=now() where id=$1',[v.id]);
  if(failure==='review_expired')await pool.query("update protocol_versions set review_due_at=now()-interval '1 second' where id=$1",[v.id]);
  if(failure==='locale_changed')await pool.query("update households set locale='ar' where id=$1",[t.householdId]);
  if(failure==='scenario_unmapped')await pool.query("update cases set scenario_code='SC16' where id=$1",[t.caseId]);
  assert.equal((await getBrief(t.caregiver.actor,t.householdId)).guidance_available,false);
  await denied(checkpointSession(t.caregiver.actor,t.id,t.action),'PROTOCOL_UNAVAILABLE');
  await denied(recordSessionObservation(t.caregiver.actor,t.id,report(t),randomUUID()),'PROTOCOL_UNAVAILABLE');
  await denied(prepareSession(t.caregiver.actor,t.state),'PROTOCOL_UNAVAILABLE');
  assert.equal((await pool.query('select count(*)::int n from observations where session_id=$1',[t.id])).rows[0].n,0);
  assert.equal((await pauseSession(t.caregiver.actor,t.id,{...t.action,reason:'Stop despite unavailable content'},randomUUID())).state,'paused');
 }finally{
  await pool.query('update protocol_versions set revoked_at=$2,review_due_at=$3 where id=$1',[v.id,v.revoked_at,v.review_due_at]);
  await pool.query("update households set locale='en' where id=$1",[t.householdId]);
  await pool.query('update cases set scenario_code=$2 where id=$1',[t.caseId,currentCase.scenario_code]);
 }
});

test('A07: withdrawal keeps human confirmation/correction and finish available as record-only work',async()=>{
 const t=await active(),o=await confirmed(t);
 await pool.query('update protocol_versions set revoked_at=now() where id=$1',[t.state.protocol_version_id]);
 try{
  const saved=await confirmSessionObservation(t.caregiver.actor,t.id,o.body,randomUUID()) as any;
  assert.equal(saved.consequence,'record_only');
  assert.equal(saved.guidance_available,false);
  const corrected=await correctSessionObservation(t.caregiver.actor,t.id,correction(t,o.draft),randomUUID());
  assert.equal(corrected.hold_cleared,false);
  assert.equal((await finishSession(t.caregiver.actor,t.id,t.action,randomUUID())).state,'finished');
 }finally{await pool.query('update protocol_versions set revoked_at=null where id=$1',[t.state.protocol_version_id]);}
});

test('A08: display requires current review, active case and participants, and stays false for live content',async()=>{
 const t=await active();
 assert.equal((await getBrief(t.caregiver.actor,t.householdId)).guidance_available,true);
 await pool.query("update cases set status='paused' where id=$1",[t.caseId]);
 assert.equal((await getBrief(t.caregiver.actor,t.householdId)).guidance_available,false);
 await pool.query("update cases set status='active' where id=$1",[t.caseId]);
 await pool.query('update pets set archived_at=now() where id=$1',[t.brief.pets[0].id]);
 assert.equal((await getBrief(t.caregiver.actor,t.householdId)).guidance_available,false);
 await pool.query('update pets set archived_at=null where id=$1',[t.brief.pets[0].id]);
 await pool.query('update plan_reviews set invalidated_at=now() where plan_revision_id=$1',[t.state.plan_revision_id]);
 assert.equal((await getBrief(t.caregiver.actor,t.householdId)).guidance_available,false);
 await pool.query("update households set mode='live',fictional=false where id=$1",[t.householdId]);
 assert.equal((await getBrief(t.caregiver.actor,t.householdId)).guidance_available,false);
});

for(const change of ['manual_pause','household_stop','protocol_revoked','review_expired'] as const)test(`A04/A07 replay safety: resume receipt cannot affirm current guidance after ${change}`,async()=>{
 const t=await active(),key=randomUUID(),body={...t.action,expected_state:'paused' as const};
 await pauseSession(t.caregiver.actor,t.id,{...t.action,reason:'Initial fictional pause'},randomUUID());
 const first=await resumeSession(t.caregiver.actor,t.id,body,key) as any;
 assert.deepEqual(await resumeSession(t.caregiver.actor,t.id,body,key),first);
 const version=(await pool.query('select revoked_at,review_due_at from protocol_versions where id=$1',[t.state.protocol_version_id])).rows[0];
 try{
  if(change==='manual_pause')await pauseSession(t.caregiver.actor,t.id,{...t.action,reason:'A later explicit pause'},randomUUID());
  if(change==='household_stop')await pauseGuidance(t.caregiver.actor,{...t.state,reason:'A later household Stop'},randomUUID());
  if(change==='protocol_revoked')await pool.query('update protocol_versions set revoked_at=now() where id=$1',[t.state.protocol_version_id]);
  if(change==='review_expired')await pool.query("update protocol_versions set review_due_at=now()-interval '1 second' where id=$1",[t.state.protocol_version_id]);
  const before=(await pool.query('select * from sessions where id=$1',[t.id])).rows[0];
  const replay=await resumeSession(t.caregiver.actor,t.id,body,key) as any;
  if(change==='manual_pause'||change==='household_stop')assert.equal(replay.state,'paused');
  assert.equal(replay.guidance_available,false);
  assert.equal(replay.guidance_state,'paused');
  assert.equal(replay.session_state,before.state);
  assert.equal(replay.safety_epoch,t.action.expected_safety_epoch+(change==='household_stop'?1:0));
  assert.equal(replay.operation_receipt.state,'active');
  assert.deepEqual(replay.operation_receipt,first.operation_receipt);
  assert.deepEqual((await pool.query('select * from sessions where id=$1',[t.id])).rows[0],before);
 }finally{await pool.query('update protocol_versions set revoked_at=$2,review_due_at=$3 where id=$1',[t.state.protocol_version_id,version.revoked_at,version.review_due_at]);}
});

for(const operation of ['observation','confirmation','correction'] as const)test(`A04/A07 replay safety: ${operation} replay reports the later paused state with its immutable receipt`,async()=>{
 const t=await active(),key=randomUUID(),observationBody=report(t);
 const draft=await recordSessionObservation(t.caregiver.actor,t.id,observationBody,operation==='observation'?key:randomUUID());
 const confirmationBody={...t.action,observation_id:draft.observation_id,digest:draft.digest};
 let first:any=draft;
 if(operation!=='observation')first=await confirmSessionObservation(t.caregiver.actor,t.id,confirmationBody,operation==='confirmation'?key:randomUUID());
 const correctionBody=correction(t,draft);
 if(operation==='correction')first=await correctSessionObservation(t.caregiver.actor,t.id,correctionBody,key);
 const replay=()=>operation==='observation'?recordSessionObservation(t.caregiver.actor,t.id,observationBody,key):operation==='confirmation'?confirmSessionObservation(t.caregiver.actor,t.id,confirmationBody,key):correctSessionObservation(t.caregiver.actor,t.id,correctionBody,key);
 assert.deepEqual(await replay(),first);
 await pauseSession(t.caregiver.actor,t.id,{...t.action,reason:'A later explicit pause'},randomUUID());
 const later=await replay() as any;
 assert.equal(later.session_state,'paused');
 assert.equal(later.guidance_available,false);
 assert.equal(later.guidance_state,'paused');
 assert.deepEqual(later.operation_receipt,first.operation_receipt);
 assert.equal((await pool.query('select count(*)::int n from observations where session_id=$1',[t.id])).rows[0].n,operation==='correction'?2:1);
});

test('A04/A07 replay safety: start replay cannot replace a later manual pause with historical active state',async()=>{
 const t=await active();
 assert.deepEqual(await startSession(t.caregiver.actor,t.startBody,t.startKey),t.started);
 await pauseSession(t.caregiver.actor,t.id,{...t.action,reason:'A later explicit pause'},randomUUID());
 const replay=await startSession(t.caregiver.actor,t.startBody,t.startKey) as any;
 assert.equal(replay.state,'paused');
 assert.equal(replay.guidance_available,false);
 assert.deepEqual(replay.operation_receipt,(t.started as any).operation_receipt);
 assert.equal((await pool.query('select count(*)::int n from sessions where household_id=$1',[t.householdId])).rows[0].n,1);
});
