import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../packages/domain/db';
import { authClient } from '../packages/domain/auth';
import { testHousehold } from './helpers';
import { householdGraph } from '../packages/domain/household';
import { draftPrivateSummary } from '../packages/domain/records';
import { claimTask,createRoutine,generateOccurrences,listDueTasks,listInbox,processOutbox,reportTask,updateRoutine } from '../packages/domain/routines';

after(()=>pool.end());
const denied=(promise:Promise<unknown>,code:string)=>assert.rejects(promise,(error:any)=>error.code===code);
const expected=async(t:any)=>{const graph=await householdGraph(t.owner.actor,t.householdId);return {expected_state_version:graph.household.state_version,expected_safety_epoch:graph.household.safety_epoch};};
const schedule={schema_version:'1',timezone:'UTC',frequency:'daily',local_time:'00:01',days_of_week:[],dst_policy:'wall_clock_first_valid'};

async function routineFixture(){
 const t=await testHousehold('cat_dog');
 const pets=(await householdGraph(t.owner.actor,t.householdId)).pets;
 const created=await createRoutine(t.owner.actor,t.householdId,{...await expected(t),pet_id:pets[0].id,kind:'water',instruction:'Original fictional owner instruction.',schedule_spec:schedule},randomUUID()) as any;
 const ruleId=created.value.routine_rule_id;
 const date=new Date(Date.now()-86400000).toISOString().slice(0,10);
 await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t),from_date:date,through_date:date},randomUUID());
 const task=(await pool.query('select * from task_occurrences where routine_rule_id=$1',[ruleId])).rows[0];
 return {...t,pets,ruleId,task};
}
async function edit(t:any,petId=t.pets[0].id){
 return updateRoutine(t.owner.actor,t.householdId,t.ruleId,{...await expected(t),expected_rule_version:1,pet_id:petId,kind:'rest',instruction:'Revised fictional owner instruction.',schedule_spec:schedule,status:'active'},randomUUID());
}
async function event(t:any,recipientId:string|null=t.owner.actor.userId){
 const payload={schema_version:'1',...(recipientId?{recipient_id:recipientId}:{})};
 return (await pool.query("insert into outbox_events(household_id,event_type,payload,expected_safety_epoch,idempotency_key,state,expires_at) select id,'routine_due',$2,safety_epoch,$3,'pending',now()+interval '1 day' from households where id=$1 returning id",[t.householdId,JSON.stringify(payload),randomUUID()])).rows[0].id as string;
}
async function processOne(id:string){
 for(let n=0;n<30;n++){const result=(await processOutbox(50)).find(item=>item.id===id);if(result)return result;}
 throw Error('OWN_OUTBOX_EVENT_NOT_PROCESSED');
}

test('routine pet reassignment is rejected before it can transfer historical reports or scope',async()=>{
 const t=await routineFixture();
 await claimTask(t.owner.actor,t.task.id,{expected_state:'planned'},randomUUID());
 const report=await reportTask(t.owner.actor,t.task.id,{report:'done',performed_at:null,note:'Original pet report.'},randomUUID());
 await pool.query('update memberships set pet_scope=$3 where household_id=$1 and profile_id=$2',[t.householdId,t.caregiver.actor.userId,[t.pets[1].id]]);
 await denied(edit(t,t.pets[1].id),'ROUTINE_PET_IMMUTABLE');
 assert.equal((await pool.query('select pet_id,version from routine_rules where id=$1',[t.ruleId])).rows[0].pet_id,t.pets[0].id);
 assert.deepEqual((await listDueTasks(t.caregiver.actor,t.householdId)).tasks,[]);
 await denied(claimTask(t.caregiver.actor,t.task.id,{expected_state:'planned'},randomUUID()),'SCOPE_MISMATCH');
 await denied(reportTask(t.caregiver.actor,t.task.id,{report:'done',performed_at:null,note:null},randomUUID()),'SCOPE_MISMATCH');
 for(const table of ['task_occurrences','task_claims','task_reports']){
  const read=await authClient(t.caregiver.token).from(table).select('*').eq('household_id',t.householdId);
  assert.equal(read.error,null);
  assert.deepEqual(read.data,[],`${table} exposed a different pet's history`);
 }
 assert.equal((await pool.query('select task_occurrence_id from task_reports where id=$1',[report.task_report_id])).rows[0].task_occurrence_id,t.task.id);
});

test('database prevents changing the routine pet independently of application checks',async()=>{
 const t=await routineFixture();
 await assert.rejects(pool.query('update routine_rules set pet_id=$2 where id=$1',[t.ruleId,t.pets[1].id]),(error:any)=>error.code==='23514');
});

test('routine history reads retain saved instruction and kind after a same-pet rule edit',async()=>{
 const t=await routineFixture();
 await reportTask(t.owner.actor,t.task.id,{report:'done',performed_at:null,note:null},randomUUID());
 await edit(t);
 const old=(await listDueTasks(t.owner.actor,t.householdId)).tasks.find(task=>task.id===t.task.id);
 assert.equal(old?.instruction,'Original fictional owner instruction.');
 assert.equal(old?.kind,'water');
 assert.equal(old?.pet_id,t.pets[0].id);
 assert.equal(old?.reports.length,1);
});

test('private record uses occurrence kind and instruction rather than the current routine',async()=>{
 const t=await routineFixture();
 await reportTask(t.owner.actor,t.task.id,{report:'done',performed_at:null,note:null},randomUUID());
 await edit(t);
 const summary=await draftPrivateSummary(t.owner.actor,t.householdId,t.caseId);
 assert.equal(summary.body.routine_reports.length,1);
 assert.equal(summary.body.routine_reports[0].kind,'water');
 assert.equal(summary.body.routine_reports[0].instruction,'Original fictional owner instruction.');
 assert.equal(summary.body.routine_reports[0].pet_id,t.pets[0].id);
});

test('database preserves occurrence source and saved rule history while allowing state changes',async()=>{
 const t=await routineFixture();
 await assert.rejects(pool.query("update task_occurrences set rule_snapshot=jsonb_set(rule_snapshot,'{instruction}',to_jsonb('Rewritten history'::text)) where id=$1",[t.task.id]),(error:any)=>error.code==='23514');
 const another=await createRoutine(t.owner.actor,t.householdId,{...await expected(t),pet_id:t.pets[1].id,kind:'rest',instruction:'Other pet record.',schedule_spec:schedule},randomUUID()) as any;
 await assert.rejects(pool.query('update task_occurrences set routine_rule_id=$2 where id=$1',[t.task.id,another.value.routine_rule_id]),(error:any)=>error.code==='23514');
 assert.equal((await claimTask(t.caregiver.actor,t.task.id,{expected_state:'planned'},randomUUID())).state,'claimed');
});

for(const state of ['expired','suspended'] as const){
 test(`inbox refuses ${state} household access despite a valid member session`,async()=>{
  const t=await testHousehold('single_cat'),id=await event(t);
  assert.equal((await processOne(id)).state,'delivered');
  assert.equal((await listInbox(t.owner.actor,t.householdId)).items.length,1);
  if(state==='expired')await pool.query("update households set expires_at=now()-interval '1 second' where id=$1",[t.householdId]);
  else await pool.query("update households set status='suspended' where id=$1",[t.householdId]);
  await denied(listInbox(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 });
 test(`outbox cancels ${state} household delivery even while the event is unexpired`,async()=>{
  const t=await testHousehold('single_cat'),id=await event(t);
  if(state==='expired')await pool.query("update households set expires_at=now()-interval '1 second' where id=$1",[t.householdId]);
  else await pool.query("update households set status='suspended' where id=$1",[t.householdId]);
  assert.equal((await processOne(id)).state,'canceled');
  assert.equal((await pool.query('select count(*)::int n from deliveries where outbox_event_id=$1',[id])).rows[0].n,0);
 });
}

test('outbox rejects a disabled targeted recipient and excludes them from household delivery',async()=>{
 const t=await testHousehold('single_cat');
 await pool.query("update profiles set status='disabled' where id=$1",[t.caregiver.actor.userId]);
 const targeted=await event(t,t.caregiver.actor.userId);
 assert.equal((await processOne(targeted)).state,'canceled');
 const broadcast=await event(t,null);
 assert.equal((await processOne(broadcast)).state,'delivered');
 assert.deepEqual((await pool.query('select recipient_id from deliveries where outbox_event_id=any($1::uuid[])',[ [targeted,broadcast] ])).rows,[{recipient_id:t.owner.actor.userId}]);
});
