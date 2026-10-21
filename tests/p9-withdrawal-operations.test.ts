import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../packages/domain/db';
import { reconcileWithdrawnProtocols } from '../packages/domain/sessions';
import { runWithdrawalDrill,withdrawalHome,withdrawalSnapshot,withdrawalVersion } from './withdrawal-fixture';
after(()=>pool.end());

test('trusted withdrawal scope refuses malformed, empty, duplicate, oversized or unknown options',async()=>{
 const originalConnect=pool.connect; (pool as any).connect=async()=>{throw new Error('INVALID_SCOPE_REACHED_DATABASE');};
 try{for(const raw of [null,{},[],{protocol_version_ids:[]},{protocol_version_ids:['bad']},{protocol_version_ids:['abcdefab-0000-4000-8000-000000000000','ABCDEFAB-0000-4000-8000-000000000000']},{protocol_version_ids:['00000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000000']},{protocol_version_ids:Array.from({length:101},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`)},{protocol_version_ids:['00000000-0000-4000-8000-000000000000'],household_id:'ignored'}]){
  await assert.rejects(reconcileWithdrawnProtocols(raw as any),(e:any)=>e.code==='INVALID_WITHDRAWAL_SCOPE');
 }}finally{pool.connect=originalConnect;}
});

test('bounded nine-household withdrawal preserves species, history, controls, pending prompts and replay integrity',async()=>{const result=await runWithdrawalDrill();assert.equal(result.invalidated_plans,9);});

test('withdrawal takes household lock before plan; human household-first write cannot deadlock',async()=>{
 const version=await withdrawalVersion('cat_cat'),home=await withdrawalHome(version,'active');
 await pool.query('update protocol_versions set revoked_at=now() where id=$1',[version.id]);
 const human=await pool.connect();let worker:ReturnType<typeof reconcileWithdrawnProtocols>|undefined;
 try{
  await human.query('begin');await human.query("set local lock_timeout='500ms'");
  const pid=(await human.query('select pg_backend_pid() pid')).rows[0].pid;
  await human.query('select id from households where id=$1 for update',[home.householdId]);
  worker=reconcileWithdrawnProtocols({protocol_version_ids:[version.id]});
  let blocked=false;
  for(let i=0;i<100;i++){
   const waiting=await pool.query("select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock'",[pid]);
   if(waiting.rowCount){blocked=true;break;}
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(blocked,true,'Worker must be waiting on the held household row');
  await human.query('select id from plan_revisions where id=$1 for update',[home.state.plan_revision_id]);
  await human.query('commit');assert.equal((await worker).invalidated_plans.length,1);
 }finally{await human.query('rollback');human.release();if(worker)await worker.catch(()=>{});}
});

test('worker rescans reviewed plans after waiting for a concurrent household write',async()=>{
 const version=await withdrawalVersion('cat_dog'),home=await withdrawalHome(version,'none');
 await pool.query('update protocol_versions set revoked_at=now() where id=$1',[version.id]);
 const human=await pool.connect();let worker:ReturnType<typeof reconcileWithdrawnProtocols>|undefined;
 try{
  await human.query('begin');const pid=(await human.query('select pg_backend_pid() pid')).rows[0].pid;
  await human.query('select id from households where id=$1 for update',[home.householdId]);
  worker=reconcileWithdrawnProtocols({protocol_version_ids:[version.id]});
  let blocked=false;
  for(let i=0;i<100;i++){
   if((await pool.query("select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock'",[pid])).rowCount){blocked=true;break;}
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(blocked,true);
  await human.query("update plan_revisions set status='stale' where id=$1",[home.state.plan_revision_id]);
  await human.query('commit');
  const before=await withdrawalSnapshot([home.householdId]);
  assert.deepEqual(await worker,{paused:[],invalidated_plans:[]});
  assert.deepEqual(await withdrawalSnapshot([home.householdId]),before);
 }finally{await human.query('rollback');human.release();if(worker)await worker.catch(()=>{});}
});

test('a failure after withdrawal updates rolls back epochs, plans, sessions, holds, handovers and queues',async()=>{
 const version=await withdrawalVersion('dog_dog'),home=await withdrawalHome(version,'interrupted'),second=await withdrawalHome(version,'active');
 await pool.query('update protocol_versions set revoked_at=now() where id=$1',[version.id]);
 const householdIds=[home.householdId,second.householdId],before=await withdrawalSnapshot(householdIds);
 let auditCount=0;
 const client=await pool.connect(),originalConnect=pool.connect,originalQuery=client.query;
 // Inject one application failure into this worker's connection only. No
 // trigger, schema alteration, database outage or provider failure is claimed.
 (client as any).query=function(...args:any[]){if(typeof args[0]==='string'&&args[0].includes("'protocol_withdrawn_paused'")&&++auditCount===2)return Promise.reject(new Error('P9_INJECTED_AUDIT_FAILURE'));return (originalQuery as any).apply(this,args);};
 (pool as any).connect=async()=>client;
 try{await assert.rejects(reconcileWithdrawnProtocols({protocol_version_ids:[version.id]}),/P9_INJECTED_AUDIT_FAILURE/);}
 finally{pool.connect=originalConnect;client.query=originalQuery;}
 assert.equal(auditCount,2);
 assert.deepEqual(await withdrawalSnapshot(householdIds),before);
 assert.equal((await reconcileWithdrawnProtocols({protocol_version_ids:[version.id]})).invalidated_plans.length,2);
});
