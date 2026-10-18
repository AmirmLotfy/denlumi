import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool,DomainError,readAs } from '../packages/domain/db';
import { testHousehold,testIdentity } from './helpers';
import { addPet,createCase,createHousehold,householdGraph } from '../packages/domain/household';
import { acknowledgeHandover,caseContext,draftPlan,planningWorkspace,replaceHomePlan,reviewPlan,routeCase } from '../packages/domain/planning';
import { bindState } from '../packages/contracts/phase0';
import { getBrief,prepareSession } from '../packages/domain/state';
import { authClient } from '../packages/domain/auth';

after(()=>pool.end());
const denied=(p:Promise<unknown>,code:string)=>assert.rejects(p,(e:any)=>e.code===code);
const base={nickname:'Fictional routing record',timezone:'Africa/Cairo',locale:'en',adult_acknowledged:true,notification_preferences:{internal_inbox:true,email:false}};
const expected=async(actor:any,id:string)=>{const g=await householdGraph(actor,id);return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};
const pet=(nickname:string,species:'cat'|'dog')=>({nickname,species,age_band:null,approx_birth_date:null,arrival_date:null,context_notes:{schema_version:1 as const,reported_history:null,accessibility_notes:null}});
const scenarios={
 SC01:{species:['cat'],roles:['newcomer'],route:'guided_preparation',protocol:'demo-solo-cat-v1'},SC02:{species:['dog'],roles:['newcomer'],route:'guided_preparation',protocol:'demo-solo-dog-v1'},
 SC03:{species:['cat','cat'],roles:['resident','newcomer'],route:'guided_preparation',protocol:'demo-cc-v1'},SC04:{species:['dog','dog'],roles:['resident','newcomer'],route:'guided_preparation',protocol:'demo-dd-v1'},
 SC05:{species:['dog','cat'],roles:['resident','newcomer'],route:'guided_preparation',protocol:'demo-dc-new-cat-v1'},SC06:{species:['cat','dog'],roles:['resident','newcomer'],route:'guided_preparation',protocol:'demo-dc-new-dog-v1'},
 SC07:{species:['cat','cat','dog'],roles:['affected','affected','affected'],route:'coordination_only',protocol:'demo-care-v1'},SC08:{species:['dog','dog'],roles:['resident','newcomer'],route:'clarification_required',protocol:'demo-care-v1'},
 SC09:{species:['cat','cat'],roles:['resident','returning'],route:'clarification_required',protocol:'demo-care-v1'},SC10:{species:['dog','cat'],roles:['affected','affected'],route:'coordination_only',protocol:'demo-care-v1'},
 SC11:{species:['cat','dog'],roles:['affected','affected'],route:'coordination_only',protocol:'demo-care-v1'},SC12:{species:['dog','cat'],roles:['affected','affected'],route:'coordination_only',protocol:'demo-care-v1'},
 SC13:{species:['dog','cat'],roles:['affected','affected'],route:'professional_required',protocol:'demo-care-v1'},SC14:{species:['dog'],roles:['affected'],route:'professional_required',protocol:'demo-care-v1'},
 SC15:{species:['dog'],roles:['affected'],route:'coordination_only',protocol:'demo-care-v1'},SC16:{species:['cat'],roles:['affected'],route:'urgent_help',protocol:'demo-care-v1'},SC17:{species:['cat'],roles:['affected'],route:'coordination_only',protocol:'demo-care-v1'}
} as const;

for(const [code,s] of Object.entries(scenarios))test(`${code} routes exact participants and keeps live demo content unavailable`,async()=>{
 const u=await testIdentity(),householdId=(await createHousehold(u.actor,base,randomUUID())).household_id;
 for(const [n,species] of s.species.entries())await addPet(u.actor,householdId,{...await expected(u.actor,householdId),...pet(`Pet ${n+1}`,species)},randomUUID());
 const g=await householdGraph(u.actor,householdId);const c=await createCase(u.actor,householdId,{...await expected(u.actor,householdId),title:code,scenario_code:code,participants:g.pets.map((p,n)=>({pet_id:p.id,role:s.roles[n]}))},randomUUID()) as any;
 const routed=await routeCase(u.actor,c.value.id,{...await expected(u.actor,householdId),intake_schema_version:'1',answers:{note:'preserved'},unknowns:[]},randomUUID()) as any;
 assert.equal(routed.value.support_level,s.route);assert.equal(routed.value.demo_protocol_slug,s.protocol);
 const context=await caseContext(u.actor,c.value.id);assert.equal(context.case.intake.answers.note,'preserved');assert.ok(context.protocol_candidates.every((v:any)=>!v.eligible));
});

test('unknowns are preserved and raise clarification; professional and urgent routes cannot be owner-downgraded',async()=>{
 const t=await testHousehold('single_dog');
 const routed=await routeCase(t.owner.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),intake_schema_version:'1',answers:{professional_concern:true,free_text:'exact'},unknowns:['arrival history']},randomUUID()) as any;
 assert.equal(routed.value.support_level,'professional_required');
 const c=await caseContext(t.owner.actor,t.caseId);assert.deepEqual(c.case.intake.unknowns,['arrival history']);assert.equal(c.case.intake.answers.free_text,'exact');
 await denied(pool.query("update cases set support_level='coordination_only' where id=$1",[t.caseId]),'23514');
 await pool.query("update cases set support_level='urgent_help' where id=$1",[t.caseId]);
 await denied(pool.query("update cases set support_level='professional_required' where id=$1",[t.caseId]),'23514');
});

test('scenario species and newcomer direction fail closed without changing household state',async()=>{
 const t=await testHousehold('cat_dog'),before=await expected(t.owner.actor,t.householdId);
 await pool.query("update cases set scenario_code='SC05' where id=$1",[t.caseId]);
 await denied(routeCase(t.owner.actor,t.caseId,{...before,intake_schema_version:'1',answers:{},unknowns:[]},randomUUID()),'NEWCOMER_DIRECTION_MISMATCH');
 assert.deepEqual(await expected(t.owner.actor,t.householdId),before);
});

test('versioned home, reviewed plan, exact handover ack and fresh retrieval form one complete demo slice',async()=>{
 const t=await testHousehold('cat_dog');
 await routeCase(t.owner.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),intake_schema_version:'1',answers:{fictional:true},unknowns:[]},randomUUID());
 const b=await getBrief(t.owner.actor,t.householdId);
 const home=await replaceHomePlan(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),zones:[{key:'shared-room',label:'Shared room record',arrangement_note:'Fictional layout only',resources:[{key:'water-a',kind:'water',label:'Recorded water location',status:'reported_present',pet_access:b.pets.map(p=>({pet_id:p.id,access_plan:'shared'}))},{key:'alternative',kind:'retreat',label:'Recorded alternative location',status:'unknown',pet_access:b.pets.map(p=>({pet_id:p.id,access_plan:'unknown'}))}]}],responsibilities:[{profile_id:t.owner.actor.userId,pet_id:null,label:'Review records',status:'planned',note:'Software record only'}]},randomUUID()) as any;
 assert.equal(home.value.home_version,2);
 const draft=await draftPlan(t.owner.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),locale:'en'},randomUUID()) as any;
 assert.equal(draft.value.status,'draft');assert.equal(draft.value.demo_only,true);
 const reviewed=await reviewPlan(t.owner.actor,draft.value.plan_revision_id,{...await expected(t.owner.actor,t.householdId),reviewed_digest:draft.value.digest},randomUUID()) as any;
 const ack=await acknowledgeHandover(t.caregiver.actor,reviewed.value.handover_id,{acknowledged_digest:reviewed.value.handover_digest},randomUUID());assert.equal(ack.digest,reviewed.value.handover_digest);
 const current=await getBrief(t.caregiver.actor,t.householdId);assert.equal(current.plan_status,'reviewed');assert.equal((await prepareSession(t.caregiver.actor,bindState(current))).status,'demo_preflight_only');
 const fresh=await planningWorkspace(t.caregiver.actor,t.householdId);assert.equal(fresh.household.home_version,2);assert.equal(fresh.resources.length,2);assert.ok(fresh.own_acknowledgements.some(a=>a.handover_id===reviewed.value.handover_id));
 const stale=bindState(current);await replaceHomePlan(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),zones:[],responsibilities:[]},randomUUID());
 await denied(prepareSession(t.caregiver.actor,stale),'STALE_STATE');await denied(acknowledgeHandover(t.caregiver.actor,reviewed.value.handover_id,{acknowledged_digest:reviewed.value.handover_digest},randomUUID()),'HANDOVER_CHANGED');
 const updated=await planningWorkspace(t.caregiver.actor,t.householdId);assert.equal(updated.household.home_version,3);assert.ok(updated.reviews.every(r=>r.invalidated_at));
});

test('unaccepted adult member cannot acknowledge or receive ownership',async()=>{
 const t=await testHousehold('single_cat'),u=await testIdentity();
 const membership=(await pool.query("insert into memberships(household_id,profile_id,role) values($1,$2,'caregiver') returning id",[t.householdId,u.actor.userId])).rows[0];
 const handover=(await pool.query("select id,digest from handovers where household_id=$1 and status='published' order by created_at desc limit 1",[t.householdId])).rows[0];
 await denied(acknowledgeHandover(u.actor,handover.id,{acknowledged_digest:handover.digest},randomUUID()),'MEMBERSHIP_NOT_ACCEPTED');
 assert.equal(membership.id.length,36);
});

test('content registry is immutable, fake approval fails, and new tables are read-only tenant scoped',async()=>{
 const t=await testHousehold(),other=await testHousehold('single_cat');
 assert.equal((await pool.query('select count(*)::int n from source_references')).rows[0].n,6);
 assert.ok((await pool.query('select count(*)::int n from protocol_sources')).rows[0].n>=6);
 const demo=(await pool.query("select id from protocol_versions where status='demo_only' limit 1")).rows[0];await denied(pool.query("update protocol_versions set status='approved' where id=$1",[demo.id]),'23514');
 const protocol=(await pool.query("insert into protocols(slug,scenario_family,pairing) values($1,'test','cat_dog') returning id",['approval-test-'+randomUUID()])).rows[0];
 const version=(await pool.query("insert into protocol_versions(slug,protocol_id,pairing,version,status,content,digest,source_ids) values($1,$2,'cat_dog','1','draft','{}',$3,'{}') returning id",['approval-version-'+randomUUID(),protocol.id,'1'.repeat(64)])).rows[0];
 await pool.query("update protocol_versions set status='in_review' where id=$1",[version.id]);await denied(pool.query("update protocol_versions set status='approved',reviewer_id=$2,reviewed_digest=$3,review_due_at=now()+interval '1 day' where id=$1",[version.id,t.owner.actor.userId,'1'.repeat(64)]),'23514');
 for(const table of ['home_zones','resources','pet_resource_access','home_responsibilities','plan_steps','plan_reviews','handover_acks']){
  const foreign=await authClient(t.owner.token).from(table).select('*').eq('household_id',other.householdId);assert.equal(foreign.error,null);assert.deepEqual(foreign.data,[]);
  assert.ok((await authClient(t.owner.token).from(table).insert({household_id:t.householdId})).error);
 }
 await assert.rejects(readAs(t.owner.actor,db=>db.query('select * from protocol_reviews')),(e:any)=>e.code==='42501');
});
