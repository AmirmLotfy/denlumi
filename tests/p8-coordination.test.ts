import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../packages/domain/db';
import {testHousehold,testIdentity} from './helpers';
import {householdGraph,grantMembership,addPet} from '../packages/domain/household';
import {acceptMembership,replaceHomePlan} from '../packages/domain/planning';
import {householdIndex,householdMembers,updateHouseholdSettings} from '../packages/domain/coordination';
const expected=async(t:any)=>{const g=await householdGraph(t.owner.actor,t.householdId);return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};
const denied=(p:Promise<unknown>,code:string)=>assert.rejects(p,(e:any)=>e.code===code);
after(()=>pool.end());
test('pending access does not expose household records before recipient acceptance',async()=>{
 const t=await testHousehold(),u=await testIdentity();
 const grant=await grantMembership(t.owner.actor,t.householdId,{...await expected(t),profile_id:u.actor.userId,role:'caregiver',pet_scope:null,case_scope:null,expires_at:null,adult_acknowledged:true},randomUUID()) as any;
 await denied(householdGraph(u.actor,t.householdId),'SCOPE_MISMATCH');
 await acceptMembership(u.actor,grant.value.id,{adult_acknowledged:true,expected_grant_version:1});
 assert.equal((await householdGraph(u.actor,t.householdId)).household.id,t.householdId);
});
test('changed or restored access requires a new recipient acceptance',async()=>{
 const t=await testHousehold();
 const grant=await grantMembership(t.owner.actor,t.householdId,{...await expected(t),profile_id:t.caregiver.actor.userId,role:'reader',pet_scope:null,case_scope:null,expires_at:null,adult_acknowledged:true},randomUUID()) as any;
 assert.equal((await pool.query('select accepted_at from memberships where id=$1',[grant.value.id])).rows[0].accepted_at,null);
 await denied(householdGraph(t.caregiver.actor,t.householdId),'SCOPE_MISMATCH');
});
test('acceptance rechecks household eligibility and preserves accepted record on failure',async()=>{
 const t=await testHousehold(),u=await testIdentity();
 const grant=await grantMembership(t.owner.actor,t.householdId,{...await expected(t),profile_id:u.actor.userId,role:'caregiver',pet_scope:null,case_scope:null,expires_at:null,adult_acknowledged:true},randomUUID()) as any;
 await pool.query("update households set status='suspended' where id=$1",[t.householdId]);
 await denied(acceptMembership(u.actor,grant.value.id,{adult_acknowledged:true,expected_grant_version:1}),'SCOPE_MISMATCH');
 assert.equal((await pool.query('select accepted_at from memberships where id=$1',[grant.value.id])).rows[0].accepted_at,null);
});
test('recipient acceptance refuses an unseen wider grant revision',async()=>{
 const t=await testHousehold(),u=await testIdentity();
 const original={...await expected(t),profile_id:u.actor.userId,role:'reader',pet_scope:null,case_scope:[t.caseId],expires_at:null,adult_acknowledged:true};
 const grant=await grantMembership(t.owner.actor,t.householdId,original,randomUUID()) as any;
 await grantMembership(t.owner.actor,t.householdId,{...original,...await expected(t),role:'caregiver',case_scope:null},randomUUID());
 await denied(acceptMembership(u.actor,grant.value.id,{adult_acknowledged:true,expected_grant_version:1}),'STALE_STATE');
 assert.equal((await pool.query('select accepted_at from memberships where id=$1',[grant.value.id])).rows[0].accepted_at,null);
});
test('normal no-plan index is scoped; settings reject stale/foreign writes and deduplicate exact retries',async()=>{
 const t=await testHousehold(),outside=await testIdentity();
 const index=await householdIndex(outside.actor);assert.equal(index.profile_id,outside.actor.userId);assert.deepEqual(index.households,[]);assert.deepEqual(index.pending_memberships,[]);
 await denied(householdMembers(t.caregiver.actor,t.householdId),'SCOPE_MISMATCH');
 await denied(householdMembers(outside.actor,t.householdId),'SCOPE_MISMATCH');
 const body={...await expected(t),nickname:'Changed home',timezone:'Europe/London',locale:'en',notification_preferences:{internal_inbox:true,email:false}},key=randomUUID();
 const first=await updateHouseholdSettings(t.owner.actor,t.householdId,body,key);
 assert.deepEqual(await updateHouseholdSettings(t.owner.actor,t.householdId,body,key),first);
 await denied(updateHouseholdSettings(t.owner.actor,t.householdId,{...body,nickname:'Different'},key),'IDEMPOTENCY_MISMATCH');
 await denied(updateHouseholdSettings(t.owner.actor,t.householdId,body,randomUUID()),'STALE_STATE');
 await denied(updateHouseholdSettings(t.caregiver.actor,t.householdId,body,randomUUID()),'FORBIDDEN');
});
for(const condition of ['revoked','disabled','wrong_pet','wrong_case'] as const)test(`home responsibility refuses ${condition} caregiver rather than recording a new assignment`,async()=>{
 const t=await testHousehold(),g=await householdGraph(t.owner.actor,t.householdId);
 if(condition==='revoked')await pool.query('update memberships set revoked_at=now() where household_id=$1 and profile_id=$2',[t.householdId,t.caregiver.actor.userId]);
 if(condition==='disabled')await pool.query("update profiles set status='disabled' where id=$1",[t.caregiver.actor.userId]);
 if(condition==='wrong_pet')await pool.query('update memberships set pet_scope=$3 where household_id=$1 and profile_id=$2',[t.householdId,t.caregiver.actor.userId,[g.pets[1].id]]);
 if(condition==='wrong_case')await pool.query("update memberships set case_scope='{}' where household_id=$1 and profile_id=$2",[t.householdId,t.caregiver.actor.userId]);
 await denied(replaceHomePlan(t.owner.actor,t.householdId,{...await expected(t),zones:[],responsibilities:[{profile_id:t.caregiver.actor.userId,pet_id:g.pets[0].id,label:'Fictional responsibility',status:'planned',note:null}]},randomUUID()),'SCOPE_MISMATCH');
});
test('R0 pilot limits allow six active pets and four adult memberships, refusing further additions',async()=>{
 const t=await testHousehold();
 for(let n=0;n<4;n++)await addPet(t.owner.actor,t.householdId,{...await expected(t),nickname:`Fictional extra ${n}`,species:'cat'},randomUUID());
 await denied(addPet(t.owner.actor,t.householdId,{...await expected(t),nickname:'Seventh fictional pet',species:'dog'},randomUUID()),'PET_LIMIT');
 for(let n=0;n<3;n++){
  const u=await testIdentity(),body={...await expected(t),profile_id:u.actor.userId,role:'reader',pet_scope:null,case_scope:null,expires_at:null,adult_acknowledged:true};
  if(n<2)await grantMembership(t.owner.actor,t.householdId,body,randomUUID());
  else await denied(grantMembership(t.owner.actor,t.householdId,body,randomUUID()),'CAREGIVER_LIMIT');
 }
});
