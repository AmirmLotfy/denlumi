// Fictional localhost-only withdrawal fixtures. Registry clones are append-only;
// bundled versions and pre-existing households are never revoked by this drill.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool,transaction } from '../packages/domain/db';
import { digest } from '../packages/content/fixtures';
import { testHousehold } from './helpers';
import { householdGraph } from '../packages/domain/household';
import { acknowledgeHandover,replaceHomePlan,reviewPlan,routeCase } from '../packages/domain/planning';
import { getBrief } from '../packages/domain/state';
import { bindState } from '../packages/contracts/phase0';
import { reconcileWithdrawnProtocols,sessionPreflight,startSession } from '../packages/domain/sessions';

export type Pairing='cat_cat'|'dog_dog'|'cat_dog';
export async function withdrawalVersion(pairing:Pairing){
 return transaction(async db=>{
  const slug={cat_cat:'demo-cc-v1',dog_dog:'demo-dd-v1',cat_dog:'demo-dc-new-dog-v1'}[pairing];
  const source=(await db.query("select * from protocol_versions where slug=$1 and status='demo_only' and revoked_at is null",[slug])).rows[0];
  assert.ok(source,'Bundled demo source must be available');assert.equal(source.pairing,pairing);
  const name=`p9-withdrawal-${pairing}-${randomUUID()}`;
  const protocol=(await db.query('insert into protocols(slug,scenario_family,pairing) select $1,scenario_family,pairing from protocols where id=$2 returning id',[name,source.protocol_id])).rows[0];
  const version=(await db.query(`insert into protocol_versions(slug,protocol_id,pairing,newcomer_species,version,status,content,digest,source_ids,locale,content_schema_version)
   values($1,$2,$3,$4,$5,'demo_only',$6,$7,$8,$9,$10) returning id`,[`${name}-v1`,protocol.id,pairing,source.newcomer_species,source.version,JSON.stringify(source.content),source.digest,source.source_ids,source.locale,source.content_schema_version])).rows[0];
  await db.query('insert into protocol_scenarios(protocol_version_id,scenario_id,newcomer_species) select $1,scenario_id,newcomer_species from protocol_scenarios where protocol_version_id=$2',[version.id,source.id]);
  await db.query('insert into protocol_sources(protocol_version_id,source_id,use_note) select $1,source_id,use_note from protocol_sources where protocol_version_id=$2',[version.id,source.id]);
  return {id:version.id as string,pairing,sourceId:source.id as string,digest:source.digest as string};
 });
}
export async function withdrawalHome(version:Awaited<ReturnType<typeof withdrawalVersion>>,session:'active'|'interrupted'|'none'='none'){
 const t=await testHousehold(version.pairing);
 const expected=async()=>{const g=await householdGraph(t.owner.actor,t.householdId);return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};
 await routeCase(t.owner.actor,t.caseId,{...await expected(),intake_schema_version:'1',answers:{fictional:true},unknowns:[]},randomUUID());
 await replaceHomePlan(t.owner.actor,t.householdId,{...await expected(),zones:[],responsibilities:[]},randomUUID());
 // Append a fixture draft bound to the dedicated exact-species version. No
 // historical revision or shared scenario definition is rebound or modified.
 const plan=await transaction(async db=>{
  const p=(await db.query('select p.*,h.safety_epoch current_epoch,h.home_version current_home from plan_revisions p join households h on h.id=p.household_id where p.household_id=$1 order by revision_number desc limit 1',[t.householdId])).rows[0];
  const id=randomUUID(),hash=digest({fixture:'p9-withdrawal',id,protocol:version.id,source_digest:version.digest});
  await db.query(`insert into plan_revisions(id,household_id,case_id,protocol_version_id,revision_number,safety_epoch,home_version,participant_digest,digest,status,current_step,locale,intake_digest,home_digest,protocol_digest)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft','owner-review',$10,$11,$12,$13)`,[id,t.householdId,t.caseId,version.id,p.revision_number+1,p.current_epoch,p.current_home,p.participant_digest,hash,p.locale,p.intake_digest,p.home_digest,version.digest]);
  await db.query("insert into plan_steps(household_id,plan_revision_id,step_key,sequence,status) values($1,$2,'review-records',0,'available')",[t.householdId,id]);
  return {id,digest:hash};
 });
 const review=await reviewPlan(t.owner.actor,plan.id,{...await expected(),reviewed_digest:plan.digest},randomUUID()) as any;
 await acknowledgeHandover(t.caregiver.actor,review.value.handover_id,{acknowledged_digest:review.value.handover_digest},randomUUID());
 const brief=await getBrief(t.caregiver.actor,t.householdId),state=bindState(brief),handover={id:review.value.handover_id,digest:review.value.handover_digest};
 let sessionId:string|null=null;
 if(session!=='none'){
  sessionId=(await startSession(t.caregiver.actor,{...state,handover_id:handover.id,handover_digest:handover.digest},randomUUID())).session_id;
  if(session==='interrupted')await pool.query("update sessions set state='interrupted',interruption_reason='heartbeat_timeout' where id=$1",[sessionId]);
 }
 const step=(await pool.query('select id from plan_steps where plan_revision_id=$1',[plan.id])).rows[0];
 await pool.query('insert into task_occurrences(household_id,plan_step_id,due_at,expected_safety_epoch,occurrence_key) values($1,$2,now(),$3,$4)',[t.householdId,step.id,state.expected_safety_epoch,randomUUID()]);
 const queued=(await pool.query("insert into outbox_events(household_id,event_type,payload,expected_safety_epoch,idempotency_key,state) values($1,'routine_due',$2,$3,$4,'pending') returning id",[t.householdId,JSON.stringify({schema_version:'1',recipient_id:t.owner.actor.userId,fixture:'p9-withdrawal-progression'}),state.expected_safety_epoch,randomUUID()])).rows[0].id;
 return {...t,state,handover,sessionId,queued,version};
}
export async function withdrawalSnapshot(householdIds:string[]){
 const rows=(await pool.query(`select h.id,h.safety_epoch,p.id plan_id,p.status plan_status,p.protocol_version_id,p.protocol_digest,p.digest,p.current_step,c.status case_status,c.support_level,
  (select jsonb_agg(jsonb_build_object('id',s.id,'state',s.state,'protocol_version_id',s.protocol_version_id,'reason',s.interruption_reason) order by s.id) from sessions s where s.plan_revision_id=p.id) sessions,
  (select count(*)::int from plan_reviews r where r.plan_revision_id=p.id and r.invalidated_at is not null) invalid_reviews,
  (select count(*)::int from task_occurrences t where t.household_id=h.id and t.state='canceled') canceled_tasks,
  (select count(*)::int from safety_holds x where x.household_id=h.id and x.reason_code='PROTOCOL_WITHDRAWN') withdrawal_holds,
  (select count(*)::int from audit_events a where a.household_id=h.id and a.event_type='protocol_withdrawn_paused') withdrawal_audits,
  (select count(*)::int from handovers x where x.household_id=h.id and x.status='published' and x.safety_epoch=h.safety_epoch) current_handovers,
  (select jsonb_agg(jsonb_build_object('id',x.id,'state',x.state,'epoch',x.expected_safety_epoch) order by x.id) from outbox_events x where x.household_id=h.id) outbox
  from households h join plan_revisions p on p.household_id=h.id join cases c on c.id=p.case_id
  where h.id=any($1::uuid[]) and p.revision_number=(select max(revision_number) from plan_revisions where case_id=p.case_id) order by h.id`,[householdIds])).rows;
 return rows;
}
export async function runWithdrawalDrill(){
 const versions=await Promise.all((['cat_cat','dog_dog','cat_dog'] as Pairing[]).map(withdrawalVersion));
 const affected=[];
 for(const version of versions)for(const state of ['active','interrupted','none'] as const)affected.push(await withdrawalHome(version,state));
 const controlVersion=await withdrawalVersion('cat_dog');
 const control=await withdrawalHome(controlVersion,'active');
 const omittedVersion=await withdrawalVersion('dog_dog'),omitted=await withdrawalHome(omittedVersion,'none');
 const controls=[control,omitted],controlIds=controls.map(t=>t.householdId);
 const before=await withdrawalSnapshot(affected.map(t=>t.householdId)),unrelatedBefore=await withdrawalSnapshot(controlIds);
 await pool.query('update protocol_versions set revoked_at=now() where id=any($1::uuid[])',[versions.map(v=>v.id).concat(omittedVersion.id)]);
 // The already-revoked but omitted version proves that scope applies to the
 // trusted worker rather than just fixture preparation.
 for(const t of affected){assert.equal((await getBrief(t.caregiver.actor,t.householdId)).guidance_available,false);await assert.rejects(sessionPreflight(t.caregiver.actor,t.state),(e:any)=>e.code==='PROTOCOL_UNAVAILABLE');}
 const started=performance.now(),result=await reconcileWithdrawnProtocols({protocol_version_ids:versions.map(v=>v.id)}),elapsedMs=performance.now()-started;
 assert.equal(result.invalidated_plans.length,9);assert.equal(result.paused.length,6);
 const after=await withdrawalSnapshot(affected.map(t=>t.householdId));
 for(const row of after){
  const prior=before.find(x=>x.id===row.id)!;assert.equal(row.safety_epoch,prior.safety_epoch+1);assert.equal(row.plan_status,'stale');assert.equal(row.case_status,'paused');assert.equal(row.support_level,'clarification_required');
  assert.equal(row.protocol_version_id,prior.protocol_version_id);assert.equal(row.protocol_digest,prior.protocol_digest);assert.equal(row.digest,prior.digest);assert.equal(row.current_step,prior.current_step);
  assert.equal(row.invalid_reviews,1);assert.equal(row.canceled_tasks,1);assert.equal(row.withdrawal_holds,1);assert.equal(row.withdrawal_audits,1);assert.equal(row.current_handovers,1);
  if(row.sessions)for(const s of row.sessions){assert.equal(s.state,'paused');assert.equal(s.reason,'protocol_withdrawn');assert.equal(s.protocol_version_id,row.protocol_version_id);}
  const fixture:Awaited<ReturnType<typeof withdrawalHome>>=affected.find(t=>t.householdId===row.id)!;assert.equal(row.outbox.find((x:any)=>x.id===fixture.queued).state,'canceled');assert.equal(row.outbox.filter((x:any)=>x.state==='pending'&&x.epoch===row.safety_epoch).length,1);
  assert.equal((await getBrief(fixture.caregiver.actor,fixture.householdId)).guidance_available,false);
  await assert.rejects(sessionPreflight(fixture.caregiver.actor,fixture.state),(e:any)=>e.code==='STALE_STATE');
  await assert.rejects(startSession(fixture.caregiver.actor,{...fixture.state,handover_id:fixture.handover.id,handover_digest:fixture.handover.digest},randomUUID()),(e:any)=>e.code==='STALE_STATE');
 }
 assert.deepEqual(await withdrawalSnapshot(controlIds),unrelatedBefore);
 assert.deepEqual(await reconcileWithdrawnProtocols({protocol_version_ids:versions.map(v=>v.id)}),{paused:[],invalidated_plans:[]});
 assert.deepEqual(await withdrawalSnapshot(affected.map(t=>t.householdId)),after);
 assert.equal((await pool.query('select count(*)::int n from protocol_versions where id=any($1::uuid[]) and revoked_at is null',[versions.map(v=>v.sourceId)])).rows[0].n,3);
 return {affected_households:9,protocol_versions:3,pairings:versions.map(v=>v.pairing),paused_sessions:6,no_session_plans:3,unrelated_controls:2,invalidated_plans:9,canceled_progression_events:9,replay_additional_mutations:0,worker_elapsed_ms:Math.round(elapsedMs*100)/100,fixture_household_ids:affected.map(t=>t.householdId),fixture_protocol_version_ids:versions.map(v=>v.id)};
}
