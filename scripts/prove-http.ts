import { mkdir,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const origin=process.env.APP_ORIGIN!;
const call=async(path:string,options:RequestInit={})=>{
 const r=await fetch(origin+path,{...options,signal:AbortSignal.timeout(15000)});
 const type=r.headers.get('content-type')??'';const value=type.includes('json')?await r.json():await r.text();
 if(!r.ok)throw new Error(`${path} ${r.status} ${JSON.stringify(value)}`);return {response:r,value};
};
const headers=(cookie:string,key?:string)=>({'Content-Type':'application/json','Origin':origin,'Cookie':cookie,...(key?{'Idempotency-Key':key}:{})});
const started=new Date().toISOString();
const demo=await call('/api/demo',{method:'POST',headers:headers(''),body:JSON.stringify({fixture:'cat_dog',retention_acknowledged:true})});
const cookies=demo.response.headers.getSetCookie().map(v=>v.split(';')[0]);
const owner=cookies.find(v=>v.startsWith('denlumi_session='))!,caregiver=cookies.find(v=>v.startsWith('denlumi_caregiver='))!;
if(!owner||!caregiver)throw new Error('Demo sessions missing');
const initial=(await call('/api/households',{headers:{Cookie:owner}})).value as {brief:any};
const state=(b:any)=>({case_id:b.case_id,expected_safety_epoch:b.safety_epoch,plan_revision_id:b.plan_revision_id,home_version:b.home_version,protocol_version_id:b.protocol_version_id});
const first=(await call('/api/assistant/turn',{method:'POST',headers:headers(owner),body:JSON.stringify({household_id:initial.brief.household_id,message:'What is the current fictional plan?',use_model:true})})).value as any;
const observation=(await call('/api/actions',{method:'POST',headers:headers(owner,randomUUID()),body:JSON.stringify({operation:'record',input:{...state(initial.brief),raw_report:'I am not sure whether Finn moved quickly toward Nora.',actor_pet_id:initial.brief.pets[0].id,target_pet_id:initial.brief.pets[1].id,assertion:'uncertain',source_kind:'typed',observed_at:null}})})).value as any;
let stale:{http_status:number;body:any};
{
 const r=await fetch(origin+'/api/actions',{method:'POST',headers:headers(caregiver,randomUUID()),body:JSON.stringify({operation:'preflight',caregiver:true,input:state(initial.brief)}),signal:AbortSignal.timeout(15000)});
 stale={http_status:r.status,body:await r.json()};
}
const fresh=(await call('/api/assistant/turn',{method:'POST',headers:headers(owner),body:JSON.stringify({household_id:initial.brief.household_id,message:'Why is the current plan paused?',use_model:false})})).value as any;
const output={
 checked_at:new Date().toISOString(),started_at:started,scope:'Local fictional Phase 0 HTTP proof; tokens and user IDs omitted.',
 authentication:{provider:'local Supabase Auth',owner_cookie_received:true,caregiver_cookie_received:true},
 initial:{household_id:initial.brief.household_id,pairing:initial.brief.pairing,protocol_status:initial.brief.protocol_status,safety_epoch:initial.brief.safety_epoch},
 mcp:first.trace,first_answer_source:first.answer_source,bedrock_attempt:first.provider,
 observation:{status:observation.status,observation_status:observation.observation_status,safety_epoch:observation.safety_epoch,physical_state_verified:observation.physical_state_verified},
 stale_caregiver:stale,
 fresh_conversation:{chat_history_used:fresh.chat_history_used,safety_epoch:fresh.brief.safety_epoch,answer:fresh.answer,mcp:fresh.trace},
 result:stale.http_status===409&&stale.body.error==='STALE_STATE'&&fresh.brief.safety_epoch===2?'PASS':'FAIL'
};
await mkdir('evidence/phase0',{recursive:true});await writeFile('evidence/phase0/http-flow.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
