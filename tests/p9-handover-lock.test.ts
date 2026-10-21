import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../packages/domain/db';
import {acknowledgeHandover} from '../packages/domain/planning';
import {reconcileWithdrawnProtocols} from '../packages/domain/sessions';
import {withdrawalHome,withdrawalVersion} from './withdrawal-fixture';
import {testIdentity} from './helpers';
import {pauseGuidance,getBrief} from '../packages/domain/state';
import {bindState} from '../packages/contracts/phase0';

after(()=>pool.end());
const outcome=<T>(promise:Promise<T>)=>promise.then(value=>({ok:true as const,value}),error=>({ok:false as const,error}));
async function waitingOn(pid:number){
 for(let i=0;i<150;i++){
  if((await pool.query("select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock'",[pid])).rowCount)return;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 assert.fail('Expected task-owned concurrent operation to wait on the held row');
}

test('acknowledgement and real scoped withdrawal complete without a handover/household lock cycle',async()=>{
 const version=await withdrawalVersion('cat_cat'),home=await withdrawalHome(version,'none');
 await pool.query('update protocol_versions set revoked_at=now() where id=$1',[version.id]);
 const client=await pool.connect(),originalConnect=pool.connect,originalQuery=client.query;
 const pid=(await client.query('select pg_backend_pid() pid')).rows[0].pid;
 let resume!:()=>void,reached!:()=>void;
 const gate=new Promise<void>(resolve=>resume=resolve),atInsert=new Promise<void>(resolve=>reached=resolve);
 let intercepted=false;
 (client as any).query=async function(...args:any[]){
  if(!intercepted&&typeof args[0]==='string'&&args[0].startsWith('insert into private.idempotency')){intercepted=true;reached();await gate;}
  return (originalQuery as any).apply(this,args);
 };
 // Only the acknowledgement receives this instrumented connection. The real
 // withdrawal obtains its own ordinary pool connection while this one waits.
 (pool as any).connect=async()=>{pool.connect=originalConnect;return client;};
 const ack=outcome(acknowledgeHandover(home.owner.actor,home.handover.id,{acknowledged_digest:home.handover.digest},randomUUID()));
 let worker:ReturnType<typeof outcome<Awaited<ReturnType<typeof reconcileWithdrawnProtocols>>>>|undefined;
 try{
  await Promise.race([atInsert,ack.then(result=>{if(!result.ok)throw result.error;throw Error('Acknowledgement skipped the expected insert');})]);
  worker=outcome(reconcileWithdrawnProtocols({protocol_version_ids:[version.id]}));
  await waitingOn(pid);resume();
  const [ackResult,workerResult]=await Promise.all([ack,worker]);
  assert.equal(ackResult.ok,true,ackResult.ok?'':ackResult.error.code);
  assert.equal(workerResult.ok,true,workerResult.ok?'':workerResult.error.code);
  if(workerResult.ok)assert.equal(workerResult.value.invalidated_plans.length,1);
  assert.equal((await pool.query("select status from handovers where id=$1",[home.handover.id])).rows[0].status,'superseded');
 }finally{
  resume();pool.connect=originalConnect;await Promise.all([ack,worker]);client.query=originalQuery;
 }
});

test('acknowledgement waits on household before handover and rereads superseded content',async()=>{
 const home=await withdrawalHome(await withdrawalVersion('dog_dog'),'none');
 const concurrent=await pool.connect();let ack:ReturnType<typeof outcome<unknown>>|undefined;
 try{
  await concurrent.query("begin;set local lock_timeout='500ms'");
  const pid=(await concurrent.query('select pg_backend_pid() pid')).rows[0].pid;
  await concurrent.query('select id from households where id=$1 for update',[home.householdId]);
  ack=outcome(acknowledgeHandover(home.owner.actor,home.handover.id,{acknowledged_digest:home.handover.digest},randomUUID()));
  await waitingOn(pid);
  await concurrent.query("update handovers set status='superseded' where id=$1",[home.handover.id]);
  await concurrent.query('commit');
  const result=await ack;assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'HANDOVER_CHANGED');
  assert.equal((await pool.query('select count(*)::int n from handover_acks where handover_id=$1 and profile_id=$2',[home.handover.id,home.owner.actor.userId])).rows[0].n,0);
 }finally{await concurrent.query('rollback');concurrent.release();if(ack)await ack;}
});

test('acknowledgement rechecks membership after a household lock wait',async()=>{
 const home=await withdrawalHome(await withdrawalVersion('cat_dog'),'none');
 const member=await testIdentity();
 await pool.query("insert into memberships(household_id,profile_id,role,accepted_at) values($1,$2,'caregiver',now())",[home.householdId,member.actor.userId]);
 const concurrent=await pool.connect();let ack:ReturnType<typeof outcome<unknown>>|undefined;
 try{
  await concurrent.query('begin');const pid=(await concurrent.query('select pg_backend_pid() pid')).rows[0].pid;
  await concurrent.query('select id from households where id=$1 for update',[home.householdId]);
  ack=outcome(acknowledgeHandover(member.actor,home.handover.id,{acknowledged_digest:home.handover.digest},randomUUID()));
  await waitingOn(pid);
  await concurrent.query('update memberships set revoked_at=now() where household_id=$1 and profile_id=$2',[home.householdId,member.actor.userId]);
  await concurrent.query('commit');
  const result=await ack;assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'SCOPE_MISMATCH');
 }finally{await concurrent.query('rollback');concurrent.release();if(ack)await ack;}
});

async function acknowledgementCounts(handoverId:string,userId:string){
 return (await pool.query(`select
  (select count(*)::int from handover_acks where handover_id=$1::uuid and profile_id=$2) acknowledgements,
  (select count(*)::int from private.idempotency where actor_id=$2 and result->>'handover_id'=$1::text) receipts`,[handoverId,userId])).rows[0];
}
const denied=(promise:Promise<unknown>,code:string)=>assert.rejects(promise,(error:any)=>error.code===code);

for(const restriction of ['suspended','deleting','expired'] as const)test(`acknowledgement refuses ${restriction} households for fresh writes and exact receipt retries`,async()=>{
 const home=await withdrawalHome(await withdrawalVersion('cat_cat'),'none'),key=randomUUID();
 const fresh=await testIdentity();await pool.query("insert into memberships(household_id,profile_id,role,accepted_at) values($1,$2,'caregiver',now())",[home.householdId,fresh.actor.userId]);
 const body={acknowledged_digest:home.handover.digest};
 await acknowledgeHandover(home.owner.actor,home.handover.id,body,key);
 const before=await acknowledgementCounts(home.handover.id,home.owner.actor.userId);
 if(restriction==='expired')await pool.query("update households set expires_at=now()-interval '1 second' where id=$1",[home.householdId]);
 else await pool.query('update households set status=$2 where id=$1',[home.householdId,restriction]);
 await denied(acknowledgeHandover(fresh.actor,home.handover.id,body,randomUUID()),'SCOPE_MISMATCH');
 await denied(acknowledgeHandover(home.owner.actor,home.handover.id,body,key),'SCOPE_MISMATCH');
 assert.deepEqual(await acknowledgementCounts(home.handover.id,home.owner.actor.userId),before);
 assert.deepEqual(await acknowledgementCounts(home.handover.id,fresh.actor.userId),{acknowledgements:0,receipts:0});
});

test('stale published epoch denies a new acknowledgement while authorized exact replay remains a historical receipt',async()=>{
 const home=await withdrawalHome(await withdrawalVersion('dog_dog'),'none'),key=randomUUID();
 const fresh=await testIdentity();await pool.query("insert into memberships(household_id,profile_id,role,accepted_at) values($1,$2,'caregiver',now())",[home.householdId,fresh.actor.userId]);
 const body={acknowledged_digest:home.handover.digest};
 const receipt=await acknowledgeHandover(home.owner.actor,home.handover.id,body,key);
 const before=await acknowledgementCounts(home.handover.id,home.owner.actor.userId);
 await pool.query('update households set safety_epoch=safety_epoch+1 where id=$1',[home.householdId]);
 assert.equal((await pool.query('select status from handovers where id=$1',[home.handover.id])).rows[0].status,'published');
 await denied(acknowledgeHandover(fresh.actor,home.handover.id,body,randomUUID()),'HANDOVER_CHANGED');
 assert.deepEqual(await acknowledgeHandover(home.owner.actor,home.handover.id,body,key),receipt);
 assert.deepEqual(await acknowledgementCounts(home.handover.id,home.owner.actor.userId),before);
 assert.deepEqual(await acknowledgementCounts(home.handover.id,fresh.actor.userId),{acknowledgements:0,receipts:0});
});

for(const restriction of ['case','pet'] as const)test(`matching case and pet scope can acknowledge; narrowed ${restriction} scope refuses fresh and replayed work`,async()=>{
 const home=await withdrawalHome(await withdrawalVersion('cat_dog'),'none'),member=await testIdentity(),fresh=await testIdentity(),key=randomUUID();
 const pets=(await pool.query('select pet_id from case_pets where household_id=$1 and case_id=$2 order by pet_id',[home.householdId,home.caseId])).rows.map(row=>row.pet_id);
 for(const identity of [member,fresh])await pool.query("insert into memberships(household_id,profile_id,role,accepted_at,case_scope,pet_scope) values($1,$2,'caregiver',now(),$3,$4)",[home.householdId,identity.actor.userId,[home.caseId],pets]);
 const body={acknowledged_digest:home.handover.digest},receipt=await acknowledgeHandover(member.actor,home.handover.id,body,key);
 assert.equal(receipt.handover_id,home.handover.id);assert.deepEqual(await acknowledgeHandover(member.actor,home.handover.id,body,key),receipt);
 const before=await acknowledgementCounts(home.handover.id,member.actor.userId);
 if(restriction==='case')await pool.query('update memberships set case_scope=$3 where household_id=$1 and profile_id=any($2::uuid[])',[home.householdId,[member.actor.userId,fresh.actor.userId],[]]);
 else await pool.query('update memberships set pet_scope=$3 where household_id=$1 and profile_id=any($2::uuid[])',[home.householdId,[member.actor.userId,fresh.actor.userId],[pets[0]]]);
 await denied(acknowledgeHandover(fresh.actor,home.handover.id,body,randomUUID()),'SCOPE_MISMATCH');
 await denied(acknowledgeHandover(member.actor,home.handover.id,body,key),'SCOPE_MISMATCH');
 assert.deepEqual(await acknowledgementCounts(home.handover.id,member.actor.userId),before);
 assert.deepEqual(await acknowledgementCounts(home.handover.id,fresh.actor.userId),{acknowledgements:0,receipts:0});
});

for(const change of ['pause','withdrawal'] as const)test(`current ${change} handover can be acknowledged without clearing paused guidance`,async()=>{
 const version=await withdrawalVersion('cat_cat'),home=await withdrawalHome(version,'none');
 if(change==='pause')await pauseGuidance(home.owner.actor,{...home.state,reason:'Fictional pause for handover authorization check'},randomUUID());
 else {await pool.query('update protocol_versions set revoked_at=now() where id=$1',[version.id]);await reconcileWithdrawnProtocols({protocol_version_ids:[version.id]});}
 const handover=(await pool.query("select id,digest from handovers where household_id=$1 and case_id=$2 and status='published' order by created_at desc limit 1",[home.householdId,home.caseId])).rows[0];
 const state=async()=>(await pool.query('select h.safety_epoch,c.status,c.support_level,p.status plan_status from households h join cases c on c.household_id=h.id join plan_revisions p on p.case_id=c.id where h.id=$1 and p.id=$2',[home.householdId,home.state.plan_revision_id])).rows[0];
 const before=await state();assert.equal(before.plan_status,'stale');assert.equal(before.status,'paused');
 const receipt=await acknowledgeHandover(home.owner.actor,handover.id,{acknowledged_digest:handover.digest},randomUUID());
 assert.equal(receipt.handover_id,handover.id);assert.deepEqual(await state(),before);
});

test('acknowledgement receipt keys bind the exact handover even when two versions have identical digests',async()=>{
 const home=await withdrawalHome(await withdrawalVersion('cat_cat'),'none'),key=randomUUID();
 const reason='Fictional repeated pause for exact-target receipt proof';
 const currentHandover=async()=>(await pool.query("select id,digest from handovers where household_id=$1 and case_id=$2 and status='published'",[home.householdId,home.caseId])).rows[0];
 await pauseGuidance(home.owner.actor,{...bindState(await getBrief(home.owner.actor,home.householdId)),reason},randomUUID());
 const first=await currentHandover(),receipt=await acknowledgeHandover(home.owner.actor,first.id,{acknowledged_digest:first.digest},key);
 await pauseGuidance(home.owner.actor,{...bindState(await getBrief(home.owner.actor,home.householdId)),reason},randomUUID());
 const second=await currentHandover();assert.notEqual(second.id,first.id);assert.equal(second.digest,first.digest);
 await denied(acknowledgeHandover(home.owner.actor,second.id,{acknowledged_digest:second.digest},key),'IDEMPOTENCY_MISMATCH');
 assert.deepEqual(await acknowledgeHandover(home.owner.actor,first.id,{acknowledged_digest:first.digest},key),receipt);
 assert.deepEqual(await acknowledgementCounts(second.id,home.owner.actor.userId),{acknowledgements:0,receipts:0});
 const fresh=await acknowledgeHandover(home.owner.actor,second.id,{acknowledged_digest:second.digest},randomUUID());assert.equal(fresh.handover_id,second.id);
});
