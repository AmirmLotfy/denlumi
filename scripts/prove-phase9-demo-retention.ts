import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { pool } from '../packages/domain/db';
import { cleanupDueDemoHousehold } from '../packages/domain/records';

const origin=process.env.APP_ORIGIN;
if(origin!=='http://127.0.0.1:3400')throw Error('Local production app required');
const target=new URL(process.env.DATABASE_URL??'');
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='55432')throw Error('Local Supabase database required');
const call=(payload:unknown)=>fetch(`${origin}/api/demo`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
try{
 const denied=await call({fixture:'single_cat'});
 assert.equal(denied.status,400);
 const accepted=await call({fixture:'single_cat',retention_acknowledged:true});
 assert.equal(accepted.status,200);
 const created=await accepted.json();
 assert.match(created.retention_notice,/seven days/);
 const before=(await pool.query('select mode,fictional,expires_at,created_at,demo_retention_acknowledged_at,demo_purge_at from households where id=$1',[created.householdId])).rows[0];
 assert.equal(before.mode,'demo');assert.equal(before.fictional,true);assert.ok(before.demo_retention_acknowledged_at);
 const accessHours=(new Date(before.expires_at).getTime()-new Date(before.created_at).getTime())/3600000;
 const purgeDays=(new Date(before.demo_purge_at).getTime()-new Date(before.created_at).getTime())/86400000;
 assert.ok(Math.abs(accessHours-24)<0.01);assert.ok(Math.abs(purgeDays-7)<0.01);
 await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours',demo_purge_at=now()-interval '1 day' where id=$1",[created.householdId]);
 const cleaned=await cleanupDueDemoHousehold(created.householdId);
 assert.equal(cleaned.status,'completed');assert.equal(cleaned.primary_cleanup_verified,true);
 assert.equal((await pool.query('select 1 from households where id=$1',[created.householdId])).rowCount,0);
 const request=(await pool.query('select status,primary_cleanup_verified from private.deletion_requests where household_id=$1',[created.householdId])).rows[0];
 assert.equal(request.status,'completed');assert.equal(request.primary_cleanup_verified,true);
 const evidence={checked_at:new Date().toISOString(),scope:'One task-created fictional household in unlinked localhost Supabase; no existing household was purged',missing_retention_acknowledgment_http_status:denied.status,consented_creation_http_status:accepted.status,access_expiry_hours:accessHours,primary_purge_eligibility_days:purgeDays,exact_id_cleanup_status:cleaned.status,primary_cleanup_verified:cleaned.primary_cleanup_verified,owner_identity_deleted:false,backup_erasure_verified:false,private_content_or_ids_emitted:false,limits:'The fixture was aged deliberately. This proves the one-shot local cleanup path, not a scheduler, customer notice comprehension, hosted backups or production retention.'};
 await mkdir('evidence/phase9',{recursive:true});await writeFile('evidence/phase9/demo-retention-http.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({missing_ack:denied.status,consented:accepted.status,cleanup:cleaned.status,verified:cleaned.primary_cleanup_verified}));
}finally{await pool.end();}
