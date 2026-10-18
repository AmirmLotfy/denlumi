import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pool} from '../packages/domain/db';
const origin=process.env.APP_ORIGIN!;
if(origin!=='http://127.0.0.1:3400')throw Error('Isolated local app required');
const demo=await fetch(origin+'/api/demo',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({fixture:'cat_dog',retention_acknowledged:true})});
assert.equal(demo.status,200);const home=await demo.json();
const cookie=demo.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
try{
 const reply=await fetch(origin+'/api/assistant/turn',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({household_id:home.householdId,message:'Read the current fictional household state.',intent:'current_plan',use_model:true}),signal:AbortSignal.timeout(25000)});
 const data=await reply.json();
 const calls=(await pool.query("select provider,outcome,request_id,error_code from private.provider_calls where household_id=$1 and provider='bedrock' order by created_at",[home.householdId])).rows;
 const out={checked_at:new Date().toISOString(),http_status:reply.status,answer_source:data.answer_source,provider:data.provider,trace:data.trace,chat_history_used:data.chat_history_used,safety_epoch:data.brief?.safety_epoch,bedrock_calls:calls,scope:'Real authenticated local conversation endpoint. One bounded AWS Bedrock attempt, no professional animal advice or model-generated guidance.'};
 await mkdir('evidence/phase6',{recursive:true});await writeFile('evidence/phase6/bedrock-app.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
 assert.equal(reply.status,200);assert.equal(data.brief.household_id,home.householdId);assert.equal(data.answer_source,'database_template');assert.equal(data.chat_history_used,false);
 assert.equal(data.provider.status,'blocked');assert.equal(calls.length,1);assert.equal(calls[0].outcome,'blocked');
 assert.ok(data.trace.some((t:{method:string})=>t.method==='tools/list'));assert.ok(data.trace.some((t:{method:string})=>t.method==='tools/call'));
}finally{await pool.end();}
