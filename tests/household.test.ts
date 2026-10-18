import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, readAs, transaction } from '../packages/domain/db';
import { testHousehold, testIdentity } from './helpers';
import { getBrief, prepareSession } from '../packages/domain/state';
import { bindState } from '../packages/contracts/phase0';
import { authClient } from '../packages/domain/auth';
after(() => pool.end());
const denied = (p: Promise<unknown>, code: string) => assert.rejects(p, (e: any) => e.code === code);

test('identity does not grant household access; reviewer/support credentials are not membership', async () => {
 const t = await testHousehold(), outsider = await testIdentity();
 await pool.query("update profiles set reviewer_scope=$2 where id=$1", [outsider.actor.userId, { schema_version: 1, scopes: ['cat_cat'], evidence_ref: 'fictional-test-only' }]);
 await pool.query("insert into private.operator_roles(profile_id,role) values($1,'support')", [outsider.actor.userId]);
 await denied(getBrief(outsider.actor,t.householdId), 'SCOPE_MISMATCH');
 assert.equal((await readAs(outsider.actor, db => db.query('select id from pets'))).rowCount, 0);
 const profiles = await readAs(outsider.actor, db => db.query('select id from profiles'));
 assert.deepEqual(profiles.rows.map(r=>r.id), [outsider.actor.userId]);
 const forged = await authClient(outsider.token).from('profiles').update({reviewer_scope:{approved:true}}).eq('id',outsider.actor.userId);
 assert.ok(forged.error);
});

test('disabled identity and suspended household deny both RLS reads and privileged server writes',async()=>{
 const t=await testHousehold(), b=await getBrief(t.caregiver.actor,t.householdId);
 await pool.query("update profiles set status='disabled' where id=$1",[t.caregiver.actor.userId]);
 await denied(getBrief(t.caregiver.actor,t.householdId),'UNAUTHORIZED');
 await denied(prepareSession(t.caregiver.actor,bindState(b)),'UNAUTHORIZED');
 const direct=await authClient(t.caregiver.token).from('households').select('id');
 assert.deepEqual(direct.data,[]);
 await pool.query("update households set status='suspended' where id=$1",[t.householdId]);
 await denied(getBrief(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 await denied(prepareSession(t.owner.actor,bindState(b)),'SCOPE_MISMATCH');
});
test('RLS household prefilter rechecks session, identity, membership and household state without replacing pet/case scope',async()=>{
 const t=await testHousehold(),other=await testHousehold('single_cat');
 const visible=async(sessionId:unknown=t.caregiver.actor.sessionId)=>transaction(async db=>{
  await db.query('set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[t.caregiver.actor.userId,JSON.stringify({sub:t.caregiver.actor.userId,session_id:sessionId})]);
  return (await db.query('select id from pets')).rows.map(r=>r.id).sort();
 });
 const pets=(await pool.query('select id from pets where household_id=$1',[t.householdId])).rows.map(r=>r.id).sort();
 assert.deepEqual(await visible(),pets);
 for(const session of [undefined,null,'malformed',randomUUID(),other.owner.actor.sessionId])assert.deepEqual(await visible(session),[]);
 await pool.query("update profiles set status='disabled' where id=$1",[t.caregiver.actor.userId]);assert.deepEqual(await visible(),[]);
 await pool.query("update profiles set status='active' where id=$1",[t.caregiver.actor.userId]);
 await pool.query("update households set status='suspended' where id=$1",[t.householdId]);assert.deepEqual(await visible(),[]);
 await pool.query("update households set status='active',expires_at=now()-interval '1 second' where id=$1",[t.householdId]);assert.deepEqual(await visible(),[]);
 await pool.query("update households set expires_at=now()+interval '1 day' where id=$1",[t.householdId]);
 await pool.query("update memberships set expires_at=now()-interval '1 second' where profile_id=$1 and household_id=$2",[t.caregiver.actor.userId,t.householdId]);assert.deepEqual(await visible(),[]);
 await pool.query('update memberships set expires_at=null,pet_scope=$3 where profile_id=$1 and household_id=$2',[t.caregiver.actor.userId,t.householdId,[pets[0]]]);
 assert.deepEqual(await visible(),[pets[0]]);
 assert.equal((await readAs(t.caregiver.actor,db=>db.query('select id from cases'))).rowCount,0);
 await pool.query('update memberships set revoked_at=now() where profile_id=$1 and household_id=$2',[t.caregiver.actor.userId,t.householdId]);assert.deepEqual(await visible(),[]);
 await pool.query('update memberships set revoked_at=null where profile_id=$1 and household_id=$2',[t.caregiver.actor.userId,t.householdId]);
 await pool.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[t.caregiver.actor.sessionId]);assert.deepEqual(await visible(),[]);
 await pool.query('update auth.sessions set not_after=null where id=$1',[t.caregiver.actor.sessionId]);assert.deepEqual(await visible(),[pets[0]]);
 await pool.query('delete from auth.sessions where id=$1',[t.caregiver.actor.sessionId]);assert.deepEqual(await visible(),[]);
 assert.equal((await pool.query("select has_function_privilege('anon','private.accessible_household_ids()','EXECUTE') allowed")).rows[0].allowed,false);
});

test('canonical pair rejects self, reverse, duplicate and foreign-household endpoints',async()=>{
 const a=await testHousehold(),b=await testHousehold();
 const pets=(await pool.query('select id from pets where household_id=$1 order by id',[a.householdId])).rows.map(r=>r.id);
 const foreign=(await pool.query('select id from pets where household_id=$1 limit 1',[b.householdId])).rows[0].id;
 await pool.query('delete from pair_contexts where household_id=$1',[a.householdId]);
 await pool.query('delete from pet_pairs where household_id=$1',[a.householdId]);
 const insert=(x:string,y:string)=>pool.query('insert into pet_pairs(household_id,pet_a_id,pet_b_id) values($1,$2,$3)',[a.householdId,x,y]);
 await insert(pets[0],pets[1]);
 await denied(insert(pets[0],pets[1]),'23505');
 await denied(insert(pets[1],pets[0]),'23514');
 await denied(insert(pets[0],pets[0]),'23514');
 await denied(insert(...[pets[0],foreign].sort() as [string,string]),'23503');
});

test('scope arrays have same-household referential integrity, reject nulls/duplicates, preserve referenced records',async()=>{
 const a=await testHousehold(),b=await testHousehold();
 const ap=(await pool.query('select id from pets where household_id=$1 limit 1',[a.householdId])).rows[0].id;
 const bp=(await pool.query('select id from pets where household_id=$1 limit 1',[b.householdId])).rows[0].id;
 const update=(pets:unknown,cases:unknown)=>pool.query('update memberships set pet_scope=$2,case_scope=$3 where profile_id=$1',[a.caregiver.actor.userId,pets,cases]);
 await denied(update([bp],null),'23503');
 await denied(update(null,[b.caseId]),'23503');
 await denied(update([null],null),'23514');
 await denied(update([ap,ap],null),'23514');
 await update([ap],[a.caseId]);
 const visible=await readAs(a.caregiver.actor, db=>db.query('select id from pets'));
 assert.deepEqual(visible.rows.map(r=>r.id),[ap]);
 assert.equal((await readAs(a.caregiver.actor,db=>db.query('select id from cases'))).rowCount,0);
 assert.equal((await readAs(a.caregiver.actor,db=>db.query('select id from pet_pairs'))).rowCount,0);
 await denied(pool.query('delete from pets where id=$1',[ap]),'23503');
});

test('case requires at least one pet at commit, pair contexts require both case participants',async()=>{
 const t=await testHousehold('single_cat');
 await denied(pool.query("insert into cases(household_id,title,scenario_code) values($1,'empty','SC01')",[t.householdId]),'23514');
 await denied(pool.query('delete from case_pets where case_id=$1',[t.caseId]),'23514');
 const pet=(await pool.query('select id from pets where household_id=$1',[t.householdId])).rows[0].id;
 const other=(await pool.query("insert into pets(household_id,nickname,species) values($1,'Other','dog') returning id",[t.householdId])).rows[0].id;
 const pair=(await pool.query('insert into pet_pairs(household_id,pet_a_id,pet_b_id) values($1,$2,$3) returning id',[t.householdId,...[pet,other].sort()])).rows[0].id;
 await denied(pool.query("insert into pair_contexts(household_id,case_id,pair_id,context_key) values($1,$2,$3,'home')",[t.householdId,t.caseId,pair]),'23503');
 assert.equal((await pool.query('select count(*)::int n from case_pets where case_id=$1',[t.caseId])).rows[0].n,1);
});

test('database owner consistency, timezone, and nonnegative versions enforced',async()=>{
 const t=await testHousehold();
 await denied(pool.query('update households set owner_id=$2 where id=$1',[t.householdId,t.caregiver.actor.userId]),'23514');
 await denied(pool.query("update memberships set role='reader' where household_id=$1 and role='owner'",[t.householdId]),'23514');
 await denied(pool.query("update households set timezone='Not/AZone' where id=$1",[t.householdId]),'23514');
 await denied(pool.query('update households set home_version=-1 where id=$1',[t.householdId]),'23514');
 await denied(pool.query('update households set safety_epoch=0 where id=$1',[t.householdId]),'23514');
 await denied(pool.query("insert into memberships(household_id,profile_id,role) values($1,$2,'sitter')",[t.householdId,(await testIdentity()).actor.userId]),'23514');
});

import { createHousehold,householdGraph,addPet,updatePet,createCase,grantMembership,revokeMembership,transferOwnership } from '../packages/domain/household';
const householdData={nickname:'Fictional test records',timezone:'Africa/Cairo',locale:'en',adult_acknowledged:true,notification_preferences:{internal_inbox:true,email:false}};
const petData=(nickname:string,species='cat')=>({nickname,species,age_band:null,approx_birth_date:null,arrival_date:null,context_notes:{schema_version:1,reported_history:null,accessibility_notes:null}});
const expected=async(actor:any,id:string)=>{const g=await householdGraph(actor,id);return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};

test('create household retry is unique; adult acknowledgement and mode spoofing rejected; empty records allowed',async()=>{
 const u=await testIdentity(),key=randomUUID();
 await assert.rejects(createHousehold(u.actor,{...householdData,adult_acknowledged:false},key));
 await assert.rejects(createHousehold(u.actor,{...householdData,mode:'demo'},key));
 const [a,b]=await Promise.all([createHousehold(u.actor,householdData,key),createHousehold(u.actor,householdData,key)]);
 assert.deepEqual(a,b);
 await denied(createHousehold(u.actor,{...householdData,nickname:'Other'},key),'IDEMPOTENCY_MISMATCH');
 const graph=await householdGraph(u.actor,a.household_id);
 assert.equal(graph.household.mode,'live');assert.equal(graph.pets.length,0);assert.equal(graph.pairs.length,0);assert.equal(graph.cases.length,0);
});

test('single-pet and multi-pet graph preserves participants, canonical pairs and distinct contexts without guidance',async()=>{
 const u=await testIdentity(),h=(await createHousehold(u.actor,householdData,randomUUID())).household_id;
 await addPet(u.actor,h,{...await expected(u.actor,h),...petData('Same name')},randomUUID());
 let g=await householdGraph(u.actor,h);
 await createCase(u.actor,h,{...await expected(u.actor,h),title:'One pet',scenario_code:'SC01',participants:[{pet_id:g.pets[0].id,role:'newcomer'}]},randomUUID());
 g=await householdGraph(u.actor,h);assert.equal(g.pairs.length,0);assert.equal(g.participants.length,1);
 for(const species of ['cat','dog'])await addPet(u.actor,h,{...await expected(u.actor,h),...petData('Same name',species)},randomUUID());
 g=await householdGraph(u.actor,h);
 for(const context_key of ['home','other-context'])await createCase(u.actor,h,{...await expected(u.actor,h),title:context_key,scenario_code:'SC07',participants:g.pets.map(p=>({pet_id:p.id,role:'affected'})),context_key},randomUUID());
 g=await householdGraph(u.actor,h);
 assert.equal(g.pets.length,3);assert.equal(g.pairs.length,3);assert.equal(g.contexts.length,6);
 assert.ok(g.contexts.every(c=>c.status==='unreviewed'&&c.last_observation_at===null));
 assert.ok(g.cases.every(c=>c.support_level==='coordination_only'));
 assert.ok(g.pets.every(p=>p.age_band===null&&p.approx_birth_date===null));
 assert.equal((await pool.query('select count(*)::int n from plan_revisions where household_id=$1',[h])).rows[0].n,0);
});

test('owner-only mutations enforce stale/duplicate/concurrent state and scope; pet changes invalidate old plan',async()=>{
 const t=await testHousehold(),b=await getBrief(t.owner.actor,t.householdId),version=await expected(t.owner.actor,t.householdId);
 await denied(addPet(t.caregiver.actor,t.householdId,{...version,...petData('Third')},randomUUID()),'FORBIDDEN');
 const input={...version,...petData('Third')},key=randomUUID();
 const results=await Promise.allSettled([addPet(t.owner.actor,t.householdId,input,key),addPet(t.owner.actor,t.householdId,input,randomUUID())]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.code,'STALE_STATE');
 const g=await householdGraph(t.owner.actor,t.householdId);assert.equal(g.pets.length,3);assert.equal(g.household.safety_epoch,2);
 await denied(prepareSession(t.caregiver.actor,bindState(b)),'STALE_STATE');
 const changed={...await expected(t.owner.actor,t.householdId),...petData('Renamed','dog'),expected_pet_version:g.pets[0].version};
 const changeKey=randomUUID();const saved=await updatePet(t.owner.actor,g.pets[0].id,changed,changeKey);
 assert.deepEqual(await updatePet(t.owner.actor,g.pets[0].id,changed,changeKey),JSON.parse(JSON.stringify(saved)));
 await denied(updatePet(t.owner.actor,g.pets[0].id,{...changed,nickname:'Different'},changeKey),'IDEMPOTENCY_MISMATCH');
 const outsider=await testHousehold();await denied(updatePet(outsider.owner.actor,g.pets[0].id,changed,randomUUID()),'SCOPE_MISMATCH');
 const before=await expected(t.owner.actor,t.householdId);
 await denied(createCase(t.owner.actor,t.householdId,{...before,title:'Forged',scenario_code:'SC07',participants:[{pet_id:randomUUID(),role:'affected'}]},randomUUID()),'SCOPE_MISMATCH');
 assert.deepEqual(await expected(t.owner.actor,t.householdId),before);
});

test('explicit membership grants are scoped, audited, expiring and immediately revocable; no self privilege',async()=>{
 const t=await testHousehold('single_cat'),u=await testIdentity(),g=await householdGraph(t.owner.actor,t.householdId);
 const input={...await expected(t.owner.actor,t.householdId),profile_id:u.actor.userId,role:'sitter',pet_scope:[g.pets[0].id],case_scope:[t.caseId],expires_at:new Date(Date.now()+60000).toISOString(),adult_acknowledged:true};
 await denied(grantMembership(t.caregiver.actor,t.householdId,input,randomUUID()),'FORBIDDEN');
 await grantMembership(t.owner.actor,t.householdId,input,randomUUID());
 assert.equal((await householdGraph(u.actor,t.householdId)).pets.length,1);
 const m=(await pool.query('select * from memberships where profile_id=$1',[u.actor.userId])).rows[0];assert.equal(m.invited_by,t.owner.actor.userId);
 await revokeMembership(t.owner.actor,t.householdId,m.id,await expected(t.owner.actor,t.householdId),randomUUID());
 await denied(householdGraph(u.actor,t.householdId),'SCOPE_MISMATCH');
 assert.equal((await readAs(u.actor,db=>db.query('select id from pets'))).rowCount,0);
 assert.equal((await pool.query("select count(*)::int n from audit_events where household_id=$1 and event_type in ('membership_granted','membership_revoked')",[t.householdId])).rows[0].n,2);
});

test('ownership transfers atomically to existing unrestricted caregiver and removes old owner authority',async()=>{
 const t=await testHousehold();
 await transferOwnership(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),new_owner_id:t.caregiver.actor.userId,confirm_transfer:true},randomUUID());
 const g=await householdGraph(t.caregiver.actor,t.householdId);assert.equal(g.membership.role,'owner');
 await denied(addPet(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),...petData('Denied')},randomUUID()),'FORBIDDEN');
 assert.equal((await pool.query("select count(*)::int n from memberships where household_id=$1 and role='owner' and revoked_at is null",[t.householdId])).rows[0].n,1);
});

import { addCaseParticipant } from '../packages/domain/household';
test('adding third case participant stales the bound plan and never infers group readiness',async()=>{
 const t=await testHousehold();
 await addPet(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),...petData('Third')},randomUUID());
 let g=await householdGraph(t.owner.actor,t.householdId);const p=g.pets.find(p=>p.nickname==='Third');
 const i={...await expected(t.owner.actor,t.householdId),pet_id:p.id,role:'affected'};const key=randomUUID();
 const added=await addCaseParticipant(t.owner.actor,t.caseId,i,key);
 assert.deepEqual(await addCaseParticipant(t.owner.actor,t.caseId,i,key),added);
 g=await householdGraph(t.owner.actor,t.householdId);assert.equal(g.participants.length,3);assert.equal(g.pairs.length,3);assert.equal(g.contexts.length,3);
 assert.ok(g.contexts.every(c=>c.status==='unreviewed'));assert.equal(g.household.safety_epoch,3);
 assert.equal(g.cases.find(c=>c.id===t.caseId)?.support_level,'clarification_required');
 assert.equal(g.cases.find(c=>c.id===t.caseId)?.support_reason_code,'PARTICIPANTS_CHANGED');
 assert.equal(g.cases.find(c=>c.id===t.caseId)?.routed_at,null);
 const b=await getBrief(t.owner.actor,t.householdId);assert.equal(b.plan_status,'stale');assert.equal(b.stale,true);
 await denied(addCaseParticipant(t.caregiver.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),pet_id:p.id,role:'affected'},randomUUID()),'FORBIDDEN');
});

test('participant changes never downgrade professional or urgent restrictions',async()=>{
 for(const level of ['professional_required','urgent_help']){
  const t=await testHousehold('cat_dog');
  await addPet(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),...petData('Third')},randomUUID());
  const pet=(await householdGraph(t.owner.actor,t.householdId)).pets.find(p=>p.nickname==='Third');
  await pool.query('update cases set support_level=$2,support_reason_code=$3 where id=$1',[t.caseId,level,'REPORTED_CONCERN']);
  await addCaseParticipant(t.owner.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),pet_id:pet.id,role:'affected'},randomUUID());
  const changed=(await householdGraph(t.owner.actor,t.householdId)).cases.find(c=>c.id===t.caseId);
  assert.equal(changed.support_level,level);assert.equal(changed.support_reason_code,'REPORTED_CONCERN');assert.equal(changed.routed_at,null);
 }
});

test('new exposed graph tables reject all Data API writes and hide foreign household rows',async()=>{
 const a=await testHousehold(),b=await testHousehold();
 for(const table of ['pet_pairs','pair_contexts']){
  const foreign=await authClient(a.owner.token).from(table).select('*').eq('household_id',b.householdId);assert.equal(foreign.error,null);assert.deepEqual(foreign.data,[]);
  assert.ok((await authClient(a.owner.token).from(table).delete().eq('household_id',a.householdId)).error);
  assert.ok((await authClient(a.owner.token).from(table).insert({household_id:a.householdId})).error);
  assert.ok((await authClient(a.owner.token).from(table).update({household_id:b.householdId}).eq('household_id',a.householdId)).error);
 }
});

test('concurrent participant removal cannot commit an empty case',async()=>{
 const t=await testHousehold(),id=randomUUID();
 const pets=(await pool.query('select id from pets where household_id=$1',[t.householdId])).rows;
 await transaction(async db=>{
  await db.query("insert into cases(id,household_id,title,scenario_code) values($1,$2,'Concurrent fixture','SC07')",[id,t.householdId]);
  for(const p of pets)await db.query("insert into case_pets(household_id,case_id,pet_id,role) values($1,$2,$3,'affected')",[t.householdId,id,p.id]);
 });
 const result=await Promise.allSettled(pets.map(p=>pool.query('delete from case_pets where case_id=$1 and pet_id=$2',[id,p.id])));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((result.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.code,'23514');
 assert.equal((await pool.query('select count(*)::int n from case_pets where case_id=$1',[id])).rows[0].n,1);
});
