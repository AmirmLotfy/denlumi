import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { testIdentity } from '../tests/helpers';
import { pool } from '../packages/domain/db';
const origin=process.env.APP_ORIGIN!;
const trace:{operation:string;status:number}[]=[];
async function request(token:string|undefined,path:string,method='GET',value?:unknown,key=randomUUID(),extra:Record<string,string>={}) {
 const headers:Record<string,string>={'Content-Type':'application/json',Origin:origin,'Idempotency-Key':key,...extra};
 if(token)headers.Cookie=`denlumi_session=${token}`;
 const r=await fetch(origin+path,{method,headers,body:value===undefined?undefined:JSON.stringify(value)});
 return {status:r.status,body:await r.json()};
}
try {
 const owner=await testIdentity(),caregiver=await testIdentity(),stranger=await testIdentity();
 const input={nickname:'Fictional Phase 1 HTTP household',timezone:'Africa/Cairo',locale:'en',adult_acknowledged:true,notification_preferences:{internal_inbox:true,email:false}};
 for(const [title,token,extra,status] of [['no_session',undefined,{},401],['bearer_only',undefined,{Authorization:`Bearer ${owner.token}`},401],['wrong_origin',owner.token,{Origin:'https://untrusted.invalid'},403]] as const){
  const r=await request(token,'/api/households','POST',input,randomUUID(),extra);assert.equal(r.status,status);trace.push({operation:title,status:r.status});
 }
 const key=randomUUID(),created=await request(owner.token,'/api/households','POST',input,key);assert.equal(created.status,201);trace.push({operation:'create_household',status:201});
 assert.deepEqual((await request(owner.token,'/api/households','POST',input,key)).body,created.body);
 const id=created.body.household_id,path=`/api/households/${id}`;
 const graph=async(token=owner.token)=>(await request(token,path+'/graph')).body;
 const expected=async()=>{const g=await graph();return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};
 for(const [nickname,species] of [['Fictional Cat','cat'],['Fictional Dog','dog']]){
  const r=await request(owner.token,path+'/pets','POST',{...await expected(),nickname,species});assert.equal(r.status,200);
 }
 let g=await graph();assert.equal(g.pets.length,2);
 const c=await request(owner.token,path+'/cases','POST',{...await expected(),title:'Fictional mixed case',scenario_code:'SC06',participants:g.pets.map((p:any)=>({pet_id:p.id,role:p.species==='dog'?'newcomer':'resident'}))});assert.equal(c.status,200);
 g=await graph();assert.equal(g.pairs.length,1);assert.equal(g.contexts[0].status,'unreviewed');assert.equal(g.cases[0].support_level,'coordination_only');
 trace.push({operation:'pets_case_and_pair_context',status:200});
 const grant=await request(owner.token,path+'/memberships','POST',{...await expected(),profile_id:caregiver.actor.userId,role:'caregiver',pet_scope:null,case_scope:null,expires_at:null,adult_acknowledged:true});assert.equal(grant.status,200);
 assert.equal((await request(caregiver.token,path+'/graph')).status,403);
 const pending=(await request(caregiver.token,'/api/households')).body.pending_memberships.find((m:any)=>m.household_id===id);
 assert.equal((await request(caregiver.token,`/api/memberships/${pending.id}/accept`,'POST',{adult_acknowledged:true,expected_grant_version:pending.grant_version})).status,200);
 assert.equal((await request(caregiver.token,path+'/graph')).status,200);
 const forbidden=await request(caregiver.token,path+'/pets','POST',{...await expected(),nickname:'No permission',species:'cat'});assert.equal(forbidden.status,403);trace.push({operation:'caregiver_privileged_write_denied',status:403});
 assert.equal((await request(stranger.token,path+'/graph')).status,403);trace.push({operation:'foreign_tenant_read_denied',status:403});
 const stale=await expected();
 const edit=await request(owner.token,`/api/pets/${g.pets[0].id}`,'PATCH',{...stale,expected_pet_version:g.pets[0].version,nickname:'Updated fictional name',species:g.pets[0].species});assert.equal(edit.status,200);
 const rejected=await request(owner.token,path+'/pets','POST',{...stale,nickname:'Stale',species:'dog'});assert.equal(rejected.status,409);assert.equal(rejected.body.error,'STALE_STATE');trace.push({operation:'stale_owner_request_denied',status:409});
 const revoke=await request(owner.token,path+`/memberships/${grant.body.value.id}`,'DELETE',await expected());assert.equal(revoke.status,200);
 assert.equal((await request(caregiver.token,path+'/graph')).status,403);trace.push({operation:'revoked_caregiver_read_denied',status:403});
 const output={checked_at:new Date().toISOString(),result:'PASS',scope:'Real local HTTP and Supabase Auth; only fictional records. No provider call, email, professional approval or practical guidance.',trace};
 await mkdir('evidence/phase1',{recursive:true});await writeFile('evidence/phase1/http.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
}finally{await pool.end();}
