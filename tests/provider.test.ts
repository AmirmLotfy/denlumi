import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../packages/domain/db';
import { converse,pollyUsage,reserveProvider,transcribeUsage } from '../packages/domain/providers';
import { getBrief,pauseGuidance } from '../packages/domain/state';
import { bindState } from '../packages/contracts/phase0';
import { testHousehold } from './helpers';
import { randomUUID } from 'node:crypto';
after(async()=>pool.end());
test('model unavailable does not disable database reads or pause',async()=>{
 const t=await testHousehold();process.env.BEDROCK_ENABLED='false';
 await assert.rejects(converse(t.owner.actor,t.householdId,[],[]),{code:'BEDROCK_NOT_ENABLED'});
 const b=await getBrief(t.owner.actor,t.householdId);
 await pauseGuidance(t.owner.actor,{...bindState(b),reason:'provider unavailable'},randomUUID());
 assert.equal((await getBrief(t.owner.actor,t.householdId)).safety_epoch,2);
});
test('durable provider call budget refuses overrun without an AWS request',async()=>{
 const t=await testHousehold();process.env.PROVIDER_DAILY_CALL_LIMIT='1';
 await reserveProvider(t.owner.actor,t.householdId,'test-no-network');
 await assert.rejects(reserveProvider(t.owner.actor,t.householdId,'test-no-network'),{code:'PROVIDER_BUDGET_EXHAUSTED'});
});
test('one actor cannot reserve provider calls concurrently across several households',async()=>{
 const first=await testHousehold(),homes=[first.householdId];
 for(let index=0;index<5;index++){
  const other=await testHousehold('single_cat');homes.push(other.householdId);
  await pool.query("insert into memberships(household_id,profile_id,role,accepted_at) values($1,$2,'caregiver',now())",[other.householdId,first.owner.actor.userId]);
 }
 process.env.PROVIDER_DAILY_CALL_LIMIT='1';
 const results=await Promise.allSettled(homes.map(id=>reserveProvider(first.owner.actor,id,'test-no-network')));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(results.filter(result=>result.status==='rejected'&&(result.reason as {code?:string}).code==='PROVIDER_BUDGET_EXHAUSTED').length,5);
 assert.equal((await pool.query('select count(*)::integer n from private.provider_calls where actor_id=$1',[first.owner.actor.userId])).rows[0].n,1);
});
test('speech usage records bounded units without retaining the input text',async()=>{
 const privateMarker='fictional-private-marker-'+randomUUID();
 const polly=pollyUsage(privateMarker);
 assert.equal(polly.source,'app_measured');assert.equal(polly.input_characters,[...privateMarker].length);
 assert.ok(!JSON.stringify(polly).includes(privateMarker));
 const oneSecond=transcribeUsage(32000),maximum=transcribeUsage(480000);
 assert.equal(oneSecond.input_audio_seconds,1);
 assert.equal(maximum.input_audio_seconds,15);
 assert.ok(!JSON.stringify(maximum).includes(privateMarker));
 const t=await testHousehold('single_dog');
 const id=await reserveProvider(t.owner.actor,t.householdId,'polly-test',polly);
 const stored=(await pool.query('select usage from private.provider_calls where id=$1',[id])).rows[0].usage;
 assert.deepEqual(stored,polly);
 assert.ok(!JSON.stringify(stored).includes(privateMarker));
});
