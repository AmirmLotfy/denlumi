import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../packages/domain/db';
import { processOutbox } from '../packages/domain/routines';
import { reconcileWithdrawnProtocols } from '../packages/domain/sessions';
import { withdrawalHome,withdrawalVersion } from './withdrawal-fixture';
after(()=>pool.end());

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};};
const waitForBlock=async(blockerPid:number)=>{
 for(let i=0;i<150;i++){
  const rows=await pool.query("select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock'",[blockerPid]);
  if(rows.rowCount)return;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 throw new Error('EXPECTED_TASK_OWNED_WORKER_LOCK_WAIT');
};

test('exact event scope refuses invalid options before database admission',async()=>{
 const original=pool.connect;(pool as any).connect=async()=>{throw new Error('INVALID_SCOPE_REACHED_DATABASE');};
 const id=randomUUID();
 try{
  for(const scope of [null,{},[],{event_ids:[]},{event_ids:['invalid']},{event_ids:[id,id]},{event_ids:['abcdefab-0000-4000-8000-000000000000','ABCDEFAB-0000-4000-8000-000000000000']},{event_ids:Array.from({length:101},()=>randomUUID())},{event_ids:[id],extra:true}]){
   await assert.rejects(processOutbox(50,'success',scope as any),(error:any)=>error.code==='INVALID_OUTBOX_SCOPE');
  }
 }finally{pool.connect=original;}
});

test('outbox and withdrawal lock selected households in the same global order',async()=>{
 const version=await withdrawalVersion('cat_dog'),homes=[await withdrawalHome(version,'active'),await withdrawalHome(version,'none')].sort((a,b)=>a.householdId.localeCompare(b.householdId));
 const [first,second]=homes;
 // Chronological event fairness intentionally selects household B before A.
 // Neither this scope nor the withdrawal worker can reach prior fixtures.
 await pool.query("update outbox_events set created_at=now()-interval '2 hours' where id=$1",[second.queued]);
 await pool.query("update outbox_events set created_at=now()-interval '1 hour' where id=$1",[first.queued]);
 await pool.query('update protocol_versions set revoked_at=now() where id=$1',[version.id]);
 const withdrawalClient=await pool.connect(),originalQuery=withdrawalClient.query,originalConnect=pool.connect;
 const pid=(await withdrawalClient.query('select pg_backend_pid() pid')).rows[0].pid;
 const lockedFirst=deferred(),continueWithdrawal=deferred();
 let stopped=false,withdrawal:ReturnType<typeof reconcileWithdrawnProtocols>|undefined,outbox:ReturnType<typeof processOutbox>|undefined;
 (withdrawalClient as any).query=async function(...args:any[]){
  const value=await (originalQuery as any).apply(this,args);
  if(!stopped&&typeof args[0]==='string'&&args[0].includes('select safety_epoch from households')&&args[1]?.[0]===first.householdId){
   stopped=true;lockedFirst.resolve();await continueWithdrawal.promise;
  }
  return value;
 };
 try{
  // Reserve one connection for the withdrawal transaction, restoring Pool's
  // normal callback/promise API before any other query or worker is started.
  (pool as any).connect=async()=>withdrawalClient;
  withdrawal=reconcileWithdrawnProtocols({protocol_version_ids:[version.id]});
  pool.connect=originalConnect;
  await lockedFirst.promise;
  outbox=processOutbox(2,'success',{event_ids:homes.map(h=>h.queued)});
  await waitForBlock(pid);
  continueWithdrawal.resolve();
  const settled=await Promise.allSettled([withdrawal,outbox]);
  assert.deepEqual(settled.map(value=>value.status),['fulfilled','fulfilled'],JSON.stringify(settled.map(value=>value.status==='rejected'?{code:value.reason?.code,message:value.reason?.message}:value.value)));
  assert.equal((settled[0] as PromiseFulfilledResult<Awaited<typeof withdrawal>>).value!.invalidated_plans.length,2);
  assert.deepEqual((settled[1] as PromiseFulfilledResult<Awaited<typeof outbox>>).value,[],'Canceled events must be reselected after the household lock wait');
  const queue=(await pool.query('select state from outbox_events where id=any($1::uuid[]) order by id',[homes.map(h=>h.queued)])).rows;
  assert.deepEqual(queue.map(row=>row.state),['canceled','canceled']);
  assert.equal((await pool.query('select count(*)::int n from deliveries where outbox_event_id=any($1::uuid[])',[homes.map(h=>h.queued)])).rows[0].n,0);
 }finally{
  pool.connect=originalConnect;continueWithdrawal.resolve();
  if(withdrawal)await withdrawal.catch(()=>{});else withdrawalClient.release();
  if(outbox)await outbox.catch(()=>{});
  withdrawalClient.query=originalQuery;
 }
});

test('exact outbox scope preserves oldest-due limit selection and leaves other task-owned events pending',async()=>{
 const version=await withdrawalVersion('cat_cat'),older=await withdrawalHome(version,'none'),newer=await withdrawalHome(version,'none');
 await pool.query("update outbox_events set created_at=now()-interval '2 hours' where id=$1",[older.queued]);
 await pool.query("update outbox_events set created_at=now()-interval '1 hour' where id=$1",[newer.queued]);
 const result=await processOutbox(1,'success',{event_ids:[newer.queued,older.queued]});
 assert.equal(result.length,1);assert.equal(result[0].id,older.queued);assert.equal(result[0].state,'delivered');
 assert.equal((await pool.query('select state from outbox_events where id=$1',[newer.queued])).rows[0].state,'pending');
 assert.equal((await pool.query('select count(*)::int n from deliveries where outbox_event_id=$1',[newer.queued])).rows[0].n,0);
 assert.equal((await pool.query('select count(*)::int n from deliveries where outbox_event_id=$1',[older.queued])).rows[0].n,1);
 assert.deepEqual(await processOutbox(1,'success',{event_ids:[older.queued]}),[]);
});

test('outbox rechecks canceled and rescheduled selected events after household lock admission',async()=>{
 const version=await withdrawalVersion('dog_dog'),home=await withdrawalHome(version,'none');
 const rescheduled=(await pool.query("insert into outbox_events(household_id,event_type,payload,expected_safety_epoch,idempotency_key,state) values($1,'routine_due',$2,$3,$4,'pending') returning id",[home.householdId,JSON.stringify({schema_version:'1',recipient_id:home.owner.actor.userId}),home.state.expected_safety_epoch,randomUUID()])).rows[0].id;
 const human=await pool.connect();let worker:ReturnType<typeof processOutbox>|undefined;
 try{
  await human.query('begin');const pid=(await human.query('select pg_backend_pid() pid')).rows[0].pid;
  await human.query('select id from households where id=$1 for update',[home.householdId]);
  worker=processOutbox(2,'success',{event_ids:[home.queued,rescheduled]});
  await waitForBlock(pid);
  await human.query("update outbox_events set state='canceled' where id=$1",[home.queued]);
  await human.query("update outbox_events set not_before=now()+interval '1 day' where id=$1",[rescheduled]);
  await human.query('commit');
  assert.deepEqual(await worker,[]);
  assert.equal((await pool.query('select count(*)::int n from deliveries where outbox_event_id=any($1::uuid[])',[[home.queued,rescheduled]])).rows[0].n,0);
 }finally{await human.query('rollback');human.release();if(worker)await worker.catch(()=>{});}
});
