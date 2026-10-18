import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const origin=process.env.APP_ORIGIN!;
const headers=(cookie:string)=>({'Content-Type':'application/json',Origin:origin,Cookie:cookie});
const demo=await fetch(origin+'/api/demo',{method:'POST',headers:headers(''),body:JSON.stringify({fixture:'cat_cat',retention_acknowledged:true}),signal:AbortSignal.timeout(15000)});assert.equal(demo.status,200);const created=await demo.json();
const owner=demo.headers.getSetCookie().map(v=>v.split(';')[0]).find(v=>v.startsWith('denlumi_session='))!;
const turn=await fetch(origin+'/api/assistant/turn',{method:'POST',headers:headers(owner),body:JSON.stringify({household_id:created.householdId,message:'Retrieve the current fictional record.',use_model:false}),signal:AbortSignal.timeout(15000)});assert.equal(turn.status,200);const body=await turn.json();
assert.equal(body.answer_source,'database_template');assert.equal(body.brief.household_id,created.householdId);assert.ok(body.trace.some((x:any)=>x.method==='tools/list'&&x.http_status===200));assert.ok(body.trace.filter((x:any)=>x.method==='tools/call'&&x.http_status===200).length>=2);
const output={checked_at:new Date().toISOString(),result:'PASS',scope:'Real authenticated Streamable HTTP MCP through the local Next.js server and isolated Supabase; fictional records only.',protocol:'2025-11-25',trace:body.trace,household_id:created.householdId,safety_epoch:body.brief.safety_epoch,provider:body.provider};await mkdir('evidence/phase23',{recursive:true});await writeFile('evidence/phase23/mcp-http.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
