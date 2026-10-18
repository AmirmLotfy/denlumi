import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getBrief,prepareSession,recordObservation,confirmObservation,pauseGuidance } from '../packages/domain/state';
import { pool,readAs,transaction } from '../packages/domain/db';
import { bindState,fixtureNames } from '../packages/contracts/phase0';
import { authClient,authenticateToken } from '../packages/domain/auth';
import { dispatch } from '../apps/web/lib/mcp';
import { testHousehold,testIdentity } from './helpers';
import { reserveProvider } from '../packages/domain/providers';
const rejects=(promise:Promise<unknown>,code:string)=>assert.rejects(promise,(e:unknown)=>(e as {code:string}).code===code);
after(async()=>pool.end());

test('real authentication rejects forged token and revoked Supabase session',async()=>{
 const u=await testIdentity();assert.equal((await authenticateToken(u.token)).userId,u.actor.userId);
 await rejects(authenticateToken('forged'),'UNAUTHORIZED');
 await u.admin.auth.admin.signOut(u.token,'local');
 await rejects(authenticateToken(u.token),'UNAUTHORIZED');
});
test('revoked session also loses direct Supabase Data API reads',async()=>{
 const t=await testHousehold();
 const before=await authClient(t.owner.token).from('households').select('id');assert.equal(before.data?.length,1);
 await t.owner.admin.auth.admin.signOut(t.owner.token,'local');
 const after=await authClient(t.owner.token).from('households').select('id');assert.ok(after.error||after.data?.length===0);
});
test('household isolation enforced by server and actual RLS; Data API writes denied',async()=>{
 const a=await testHousehold(),b=await testHousehold('single_cat');
 await rejects(getBrief(a.owner.actor,b.householdId),'SCOPE_MISMATCH');
 const rows=await readAs(a.owner.actor,async db=>(await db.query('select id from households')).rows);
 assert.deepEqual(rows.map(r=>r.id),[a.householdId]);
 const hidden=await authClient(a.owner.token).from('pets').select('*').eq('household_id',b.householdId);
 assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
 const write=await authClient(a.owner.token).from('households').update({safety_epoch:999}).eq('id',a.householdId);
 assert.ok(write.error);assert.equal((await getBrief(a.owner.actor,a.householdId)).safety_epoch,1);
});
for(const fixture of fixtureNames)test(`${fixture}: distinct demo content, fictional pause, stale caregiver, fresh retrieval, idempotency`,async()=>{
 const t=await testHousehold(fixture),b=await getBrief(t.owner.actor,t.householdId),stale=bindState(await getBrief(t.caregiver.actor,t.householdId));
 assert.equal(b.protocol_status,'demo_only');assert.equal(b.physical_state_verified,false);
 assert.equal(b.pairing,fixture==='multi_pet'?'coordination':fixture==='cat_dog_new_cat'?'cat_dog':fixture);
 if(fixture==='cat_dog_new_cat'){assert.equal(b.pets.find(p=>p.species==='cat')?.role,'newcomer');assert.equal(b.protocol_slug,'demo-dc-new-cat-v1');}
 if(fixture.startsWith('single'))assert.equal(b.pets.length,1);
 if(fixture==='multi_pet')assert.equal(b.pets.length,3);
 assert.equal((await prepareSession(t.caregiver.actor,stale)).status,'demo_preflight_only');
 const input={...bindState(b),raw_report:'Fictional concern; exact report preserved.',actor_pet_id:b.pets[0].id,target_pet_id:b.pets[1]?.id??null,assertion:'affirmed',source_kind:'typed',observed_at:null};
 const key=randomUUID(),saved=await recordObservation(t.owner.actor,input,key) as {observation_id:string;digest:string};
 const again=await recordObservation(t.owner.actor,input,key);assert.deepEqual(again,saved);
 await rejects(recordObservation(t.owner.actor,{...input,raw_report:'different payload'},key),'IDEMPOTENCY_MISMATCH');
 await rejects(prepareSession(t.caregiver.actor,stale),'STALE_STATE');
 let fresh=await getBrief(t.caregiver.actor,t.householdId);
 assert.equal(fresh.safety_epoch,2);assert.equal(fresh.observations.length,1);assert.equal(fresh.observations[0].observed_at,null);
 assert.equal(fresh.observations[0].actor_pet_id,input.actor_pet_id);assert.equal(fresh.observations[0].target_pet_id,input.target_pet_id);
 await confirmObservation(t.owner.actor,{...bindState(fresh),observation_id:saved.observation_id,digest:saved.digest},randomUUID());
  fresh=await getBrief(t.caregiver.actor,t.householdId);
 assert.equal(fresh.safety_epoch,3);assert.equal(fresh.support_level,'professional_required');assert.equal(fresh.observations[0].status,'confirmed');
  await rejects(prepareSession(t.caregiver.actor,bindState(fresh)),'GUIDANCE_PAUSED');
  const stopped=await pauseGuidance(t.owner.actor,{...bindState(fresh),reason:'stop again'},randomUUID()) as {support_level:string};
  assert.equal(stopped.support_level,'professional_required');
});
test('expired/revoked/scoped memberships lose reads and writes immediately',async()=>{
 const t=await testHousehold();const b=await getBrief(t.caregiver.actor,t.householdId);
 await pool.query('update memberships set pet_scope=$2 where profile_id=$1',[t.caregiver.actor.userId,[b.pets[0].id]]);
 await rejects(getBrief(t.caregiver.actor,t.householdId),'SCOPE_MISMATCH');
 await rejects(prepareSession(t.caregiver.actor,bindState(b)),'SCOPE_MISMATCH');
 await pool.query("update memberships set pet_scope=null,role='sitter',expires_at=now()-interval '1 second' where profile_id=$1",[t.caregiver.actor.userId]);
 await rejects(getBrief(t.caregiver.actor,t.householdId),'SCOPE_MISMATCH');
 await pool.query("update memberships set role='caregiver',expires_at=null,revoked_at=now() where profile_id=$1",[t.caregiver.actor.userId]);
 await rejects(pauseGuidance(t.caregiver.actor,{...bindState(b),reason:'stop'},randomUUID()),'SCOPE_MISMATCH');
});
test('fictional demo household expires after 24 hours and cannot read or reserve provider work',async()=>{
 const t=await testHousehold('single_cat');
 const expiry=(await pool.query('select expires_at,created_at from households where id=$1',[t.householdId])).rows[0];
 const lifetime=new Date(expiry.expires_at).getTime()-new Date(expiry.created_at).getTime();
 assert.ok(lifetime>23*3600000&&lifetime<25*3600000);
 assert.equal((await getBrief(t.owner.actor,t.householdId)).fictional,true);
 await pool.query("update households set expires_at=now()-interval '1 second' where id=$1",[t.householdId]);
 await rejects(getBrief(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 await rejects(reserveProvider(t.owner.actor,t.householdId,'test-no-network'),'SCOPE_MISMATCH');
 const rows=await authClient(t.owner.token).from('households').select('id').eq('id',t.householdId);
 assert.equal(rows.error,null);assert.deepEqual(rows.data,[]);
 assert.equal((await pool.query('select count(*)::integer n from private.provider_calls where household_id=$1',[t.householdId])).rows[0].n,0);
});
test('reader cannot mutate; forged pet references and hidden properties are rejected',async()=>{
 const t=await testHousehold(),b=await getBrief(t.owner.actor,t.householdId);
 await pool.query("update memberships set role='reader' where profile_id=$1",[t.caregiver.actor.userId]);
 await rejects(pauseGuidance(t.caregiver.actor,{...bindState(b),reason:'stop'},randomUUID()),'FORBIDDEN');
 const i={...bindState(b),raw_report:'fictional',actor_pet_id:randomUUID(),target_pet_id:null,assertion:'uncertain',source_kind:'typed',observed_at:null};
 await rejects(recordObservation(t.owner.actor,i,randomUUID()),'SCOPE_MISMATCH');
 await assert.rejects(recordObservation(t.owner.actor,{...i,confirmed:true},randomUUID()));
 assert.equal((await getBrief(t.owner.actor,t.householdId)).safety_epoch,1);
});
test('concurrent pause transactions: only one stale version can commit',async()=>{
 const t=await testHousehold(),b=await getBrief(t.owner.actor,t.householdId),i={...bindState(b),reason:'fictional stop'};
 const results=await Promise.allSettled([pauseGuidance(t.owner.actor,i,randomUUID()),pauseGuidance(t.caregiver.actor,i,randomUUID())]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const failed=results.find(r=>r.status==='rejected') as PromiseRejectedResult;assert.equal(failed.reason.code,'STALE_STATE');
 assert.equal((await getBrief(t.owner.actor,t.householdId)).safety_epoch,2);
});
test('negation/uncertainty and observation time remain intact; model has no confirmation/override tools',async()=>{
 for(const assertion of ['negated','uncertain']){
  const t=await testHousehold('single_dog'),b=await getBrief(t.owner.actor,t.householdId);
  const text=assertion==='negated'?'Finn did not chase anyone.':'I am not sure what Finn did.';
  await recordObservation(t.owner.actor,{...bindState(b),raw_report:text,actor_pet_id:b.pets[0].id,target_pet_id:null,assertion,source_kind:'typed',observed_at:'2026-09-15T10:00:00Z'},randomUUID());
  const fresh=await getBrief(t.owner.actor,t.householdId),o=fresh.observations[0];
  assert.equal(o.raw_report,text);assert.equal(o.assertion,assertion);assert.notEqual(o.observed_at,o.reported_at);
  for(const tool of ['confirm_observation','advance_plan','clear_hold','share_externally','invite_user','operate_device'])await rejects(dispatch(t.owner.actor,tool,{},randomUUID()),'TOOL_NOT_ALLOWED');
 }
});
test('demo content fails closed for live household, revoked content, changed home, and locale; stop still works',async()=>{
 const t=await testHousehold(),b=await getBrief(t.owner.actor,t.householdId);
 await pool.query("update households set mode='live',fictional=false where id=$1",[t.householdId]);
 await rejects(prepareSession(t.owner.actor,bindState(b)),'PROTOCOL_UNAVAILABLE');
 await pool.query("update households set mode='demo',fictional=true,locale='ar' where id=$1",[t.householdId]);
 await rejects(prepareSession(t.owner.actor,bindState(b)),'PROTOCOL_UNAVAILABLE');
 await pool.query("update households set locale='en',home_version=2 where id=$1",[t.householdId]);
 await rejects(prepareSession(t.owner.actor,bindState(b)),'STALE_STATE');
 const registry=await pool.query("insert into protocols(slug,scenario_family,pairing) values($1,'test','cat_dog') returning id",['test-'+randomUUID()]);
 const custom=await pool.query("insert into protocol_versions(slug,protocol_id,pairing,version,status,content,digest,source_ids) values($1,$2,'cat_dog','test','revoked','{}',$3,'{}') returning id",['test-'+randomUUID(),registry.rows[0].id,'0'.repeat(64)]);
 await pool.query("update plan_revisions set status='stale' where id=$1",[b.plan_revision_id]);
 await pool.query("insert into plan_revisions(household_id,case_id,protocol_version_id,revision_number,safety_epoch,home_version,participant_digest,digest,status,current_step,protocol_digest) select household_id,case_id,$2,revision_number+1,safety_epoch,2,participant_digest,$3,'draft','owner-review',$4 from plan_revisions where id=$1",[b.plan_revision_id,custom.rows[0].id,'2'.repeat(64),'0'.repeat(64)]);
 const revoked=await getBrief(t.owner.actor,t.householdId);
 await rejects(prepareSession(t.owner.actor,bindState(revoked)),'PROTOCOL_UNAVAILABLE');
 await pauseGuidance(t.owner.actor,{...bindState(revoked),reason:'stop'},randomUUID());
});
test('database composite constraints prevent cross-household pets; transaction failure rolls back epoch',async()=>{
 const a=await testHousehold(),b=await testHousehold();const bp=await getBrief(b.owner.actor,b.householdId);
 await assert.rejects(pool.query("insert into case_pets(household_id,case_id,pet_id,role) values($1,$2,$3,'affected')",[a.householdId,a.caseId,bp.pets[0].id]));
 await assert.rejects(transaction(async db=>{await db.query('update households set safety_epoch=99 where id=$1',[a.householdId]);throw new Error('injected transaction failure');}));
 assert.equal((await getBrief(a.owner.actor,a.householdId)).safety_epoch,1);
});
