import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../apps/web/app/api/transcription/route';
import { testHousehold } from './helpers';
import { pool } from '../packages/domain/db';
after(()=>pool.end());
test('transcription authenticates and scopes before provider work; invalid formats and oversized PCM never reserve paid calls',async()=>{
 const t=await testHousehold(),other=await testHousehold();process.env.SPEECH_ENABLED='true';
 const request=(bytes:number,overrides:Record<string,string>={})=>new Request(`${process.env.APP_ORIGIN}/api/transcription`,{method:'POST',headers:{Host:'127.0.0.1:3400',Origin:process.env.APP_ORIGIN!,Authorization:`Bearer ${t.owner.token}`,'Content-Type':'audio/pcm;rate=16000;channels=1','X-Denlumi-Household':t.householdId,...overrides},body:new Uint8Array(bytes)});
 assert.equal((await POST(request(3200,{Authorization:'Bearer forged'}))).status,401);
 assert.equal((await POST(request(3200,{'X-Denlumi-Household':other.householdId}))).status,403);
 assert.equal((await POST(request(3200,{'Content-Type':'audio/wav'}))).status,415);
 assert.equal((await POST(request(480002))).status,413);
 assert.equal((await POST(request(3000))).status,400);
 assert.equal((await POST(request(3201))).status,400);
 assert.equal((await pool.query('select count(*)::int n from private.provider_calls where household_id=$1',[t.householdId])).rows[0].n,0);
});
