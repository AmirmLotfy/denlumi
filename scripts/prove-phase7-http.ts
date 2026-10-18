import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { testHousehold,testIdentity } from '../tests/helpers';
import { pool } from '../packages/domain/db';
const origin=process.env.APP_ORIGIN!;
if(origin!=='http://127.0.0.1:3400')throw Error('Local app required');
const fixture=await testHousehold(),outsider=await testIdentity();
async function call(payload:unknown,token=fixture.owner.token){return fetch(origin+'/api/records',{method:'POST',headers:{Origin:origin,Cookie:`denlumi_session=${token}`,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(payload)});}
async function data(payload:unknown,token=fixture.owner.token){const r=await call(payload,token);const b=await r.json();assert.ok(r.ok,JSON.stringify({status:r.status,body:b}));return b;}
async function expected(){const r=await data({action:'list',household_id:fixture.householdId});return {expected_state_version:r.state_version,expected_safety_epoch:r.safety_epoch};}
try{
 const signin=await fetch(origin+'/api/auth/signin',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:fixture.owner.email,password:fixture.owner.password})});
 assert.equal(signin.status,200);assert.ok(signin.headers.getSetCookie().some(c=>c.startsWith('denlumi_session=')));
 assert.equal((await signin.json()).signed_in,true);
 const invalid=await fetch(origin+'/api/auth/signin',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:fixture.owner.email,password:'incorrect-fixture-password'})});assert.equal(invalid.status,401);
 const recipient=(await pool.query('select email from auth.users where id=$1',[fixture.caregiver.actor.userId])).rows[0].email;
 const preview=await data({action:'preview',input:{household_id:fixture.householdId,case_id:fixture.caseId,...await expected(),purpose:'share',format:'html',recipient_address:recipient,expires_at:new Date(Date.now()+3600000).toISOString()}});
 const p=preview.value;
 const approval={household_id:fixture.householdId,summary_id:p.summary_id,reviewed_digest:p.digest,purpose:p.purpose,format:p.format,recipient_address:p.recipient_address,expires_at:p.expires_at,scope:p.scope,confirm_exact_content:true,expected_state_version:preview.state_version,expected_safety_epoch:preview.safety_epoch};
 const mismatch=await call({action:'authorize',input:{...approval,recipient_address:'changed@denlumi.invalid'}});assert.equal((await mismatch.json()).error,'AUTHORIZATION_MISMATCH');
 const grant=await data({action:'authorize',input:approval});assert.equal(grant.value.externally_sent,false);
 const shared=await data({action:'view_share',grant_id:grant.value.grant_id},fixture.caregiver.token);assert.equal(shared.content,p.content);
 const denied=await call({action:'view_share',grant_id:grant.value.grant_id},outsider.token);assert.equal(denied.status,403);
 await data({action:'revoke',input:{household_id:fixture.householdId,grant_id:grant.value.grant_id,...await expected()}});
 const revoked=await call({action:'view_share',grant_id:grant.value.grant_id},fixture.caregiver.token);assert.equal((await revoked.json()).error,'SHARE_UNAVAILABLE');
 const deletion=await data({action:'delete_request',input:{household_id:fixture.householdId,...await expected(),confirm_household_deletion:true}});assert.equal(deletion.status,'pending');
 const disabled=await call({action:'list',household_id:fixture.householdId});assert.equal(disabled.status,403);
 const done=await data({action:'delete_process',request_id:deletion.request_id});assert.equal(done.status,'completed');assert.equal(done.primary_cleanup_verified,true);
 const out={checked_at:new Date().toISOString(),result:'PASS',scope:'Real cookie-authenticated local HTTP + isolated Supabase, fictional verified test accounts. No external send or hosted resources.',checks:['password sign-in and invalid-password denial','exact preview','changed destination rejected','verified recipient read','wrong recipient denied','immediate revocation','access disabled before deletion','primary cleanup verified'],backup_erasure_verified:false};
 await mkdir('evidence/phase7',{recursive:true});await writeFile('evidence/phase7/http.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
}finally{await pool.end();}
