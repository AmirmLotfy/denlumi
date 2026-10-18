import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { pool,transaction } from '../packages/domain/db';
import { testHousehold,testIdentity } from './helpers';
import { householdGraph,createHousehold,transferOwnership,revokeMembership } from '../packages/domain/household';
import { authClient } from '../packages/domain/auth';
import { previewPrivateRecord,authorizePrivateRecord,downloadPrivateExport,viewSharedRecord,revokePrivateShare,archivePrivatePet,requestHouseholdDeletion,processHouseholdDeletion,cleanupDueDemoHousehold,cleanupDueDemoHouseholds,householdDeletionStatus,prepareExpiredDemoDeletion,recoverExpiredDemoDeletion,draftPrivateSummary,listPrivateRecords,renderPrivateSummary } from '../packages/domain/records';
import { createRoutine,generateOccurrences,reportTask,listInbox } from '../packages/domain/routines';
import { draftPlan,replaceHomePlan } from '../packages/domain/planning';
after(()=>pool.end());
const denied=(p:Promise<unknown>,code:string)=>assert.rejects(p,(e:any)=>e.code===code);
const expected=async(actor:any,id:string)=>{const g=await householdGraph(actor,id);return {expected_state_version:g.household.state_version,expected_safety_epoch:g.household.safety_epoch};};
const email=async(userId:string)=>(await pool.query('select email from auth.users where id=$1',[userId])).rows[0].email;
const execFileAsync=promisify(execFile);
async function cleanupCli(...args:string[]){return execFileAsync(process.execPath,['--env-file=.env.local','--import=tsx',fileURLToPath(new URL('../scripts/run-phase9-demo-cleanup.ts',import.meta.url)),...args],{cwd:fileURLToPath(new URL('..',import.meta.url)),timeout:20000,maxBuffer:10000});}
async function viewSessionCli(...args:string[]){return execFileAsync(process.execPath,['--env-file=.env.local','--import=tsx',fileURLToPath(new URL('../scripts/run-phase9-view-session-prune.ts',import.meta.url)),...args],{cwd:fileURLToPath(new URL('..',import.meta.url)),timeout:20000,maxBuffer:10000});}
async function preview(t:any,purpose:'export'|'share'='export',format:'text'|'html'='text'){
 return previewPrivateRecord(t.owner.actor,{household_id:t.householdId,case_id:t.caseId,...await expected(t.owner.actor,t.householdId),purpose,format,recipient_address:purpose==='share'?await email(t.caregiver.actor.userId):null,expires_at:new Date(Date.now()+3600000).toISOString()},randomUUID());
}
const approval=(t:any,p:any)=>({household_id:t.householdId,summary_id:p.value.summary_id,expected_state_version:p.state_version,expected_safety_epoch:p.safety_epoch,reviewed_digest:p.value.digest,purpose:p.value.purpose,format:p.value.format,recipient_address:p.value.recipient_address,expires_at:p.value.expires_at,scope:p.value.scope,confirm_exact_content:true});
async function observation(t:any){const pets=(await householdGraph(t.owner.actor,t.householdId)).pets;const id=randomUUID();await pool.query("insert into observations(id,household_id,case_id,reporter_id,raw_report,actor_pet_id,target_pet_id,assertion,source_kind,observed_at,reported_at,digest,normalized_observation) values($1,$2,$3,$4,$5,$6,$7,'negated','typed','2026-09-22T08:00:00Z','2026-09-22T08:05:00Z',$8,$9)",[id,t.householdId,t.caseId,t.caregiver.actor.userId,'<script>alert(1)</script> Nora did not chase Finn; meaning is uncertain.',pets[0].id,pets[1]?.id??null,'1'.repeat(64),JSON.stringify({schema_version:'1',values:{},unknowns:['meaning']})]);return {id,pets};}

test('private factual preview preserves direction, negative report, times, uncertainty and provenance; HTML is escaped',async()=>{
 const t=await testHousehold(),o=await observation(t),p=await preview(t,'export','html');
 assert.equal(p.value.body.observations[0].id,o.id);assert.equal(p.value.body.observations[0].actor_pet_id,o.pets[0].id);assert.equal(p.value.body.observations[0].target_pet_id,o.pets[1].id);assert.equal(p.value.body.observations[0].assertion,'negated');assert.equal(new Date(p.value.body.observations[0].observed_at).toISOString(),'2026-09-22T08:00:00.000Z');assert.equal(new Date(p.value.body.observations[0].reported_at).toISOString(),'2026-09-22T08:05:00.000Z');assert.deepEqual(p.value.body.observations[0].normalized_observation.unknowns,['meaning']);assert.ok(p.value.scope.source_ids.includes(o.id));assert.ok(!p.value.content.includes('<script>'));assert.match(p.value.content,/&lt;script&gt;/);assert.equal(p.value.body.diagnosis_generated,false);
 await assert.rejects(pool.query('update professional_summaries set content_text=$2 where id=$1',[p.value.summary_id,'changed']));
 const a=await authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID());const downloaded=await downloadPrivateExport(t.owner.actor,a.value.export_id);assert.equal(downloaded.content,p.value.content);assert.equal(downloaded.digest,p.value.digest);
 const draft=await draftPrivateSummary(t.caregiver.actor,t.householdId,t.caseId);assert.equal(draft.private_draft_only,true);assert.equal(draft.can_send,false);
 assert.ok(renderPrivateSummary({note:'<img src=x onerror=alert(1)>'},'html').includes('&lt;img'));
});

test('private export shows recorded plan revision changes and scoped step provenance',async()=>{
 const t=await testHousehold(),foreign=await testHousehold('single_cat');
 await replaceHomePlan(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),zones:[{key:'fictional-zone',label:'Recorded room',arrangement_note:'Owner-entered fictional layout',resources:[]}],responsibilities:[]},randomUUID());
 const drafted=await draftPlan(t.owner.actor,t.caseId,{...await expected(t.owner.actor,t.householdId),locale:'en'},randomUUID()) as any;
 const stepRows=(await pool.query('select id,step_key,status,plan_revision_id from plan_steps where household_id=$1 and plan_revision_id=$2 order by sequence',[t.householdId,drafted.value.plan_revision_id])).rows;
 const p=await preview(t),history=p.value.body.plan_history;
 assert.equal(history.length,2);
 assert.equal(history[0].id,t.planId);assert.equal(history[0].recorded_input_changes_from_previous_revision,null);
 assert.equal(history[1].id,drafted.value.plan_revision_id);assert.equal(history[1].home_version,2);
 assert.ok(history[1].recorded_input_changes_from_previous_revision.includes('home_digest'));
 assert.ok(history[1].recorded_input_changes_from_previous_revision.includes('home_version'));
 assert.deepEqual(history[1].steps.map((step:any)=>({id:step.id,step_key:step.step_key,status:step.status,plan_revision_id:step.plan_revision_id})),stepRows);
 assert.ok(p.value.scope.source_ids.includes(t.planId));assert.ok(p.value.scope.source_ids.includes(drafted.value.plan_revision_id));
 for(const step of stepRows)assert.ok(p.value.scope.source_ids.includes(step.id));
 assert.ok(!p.value.scope.source_ids.includes(foreign.planId));
 const authorized=await authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID());
 const downloaded=await downloadPrivateExport(t.owner.actor,authorized.value.export_id);
 assert.equal(downloaded.content,p.value.content);
 assert.match(downloaded.content,/recorded_input_changes_from_previous_revision/);
 assert.match(downloaded.content,/review-records/);
});

test('AT042 exact approval rejects every changed binding; valid retries deduplicate and cross-purpose replay is rejected',async()=>{
 const t=await testHousehold(),p=await preview(t,'share'),i=approval(t,p),key=randomUUID();
 for(const changed of [{recipient_address:'other@denlumi.invalid'},{reviewed_digest:'0'.repeat(64)},{purpose:'export',recipient_address:null},{format:'html'},{expires_at:new Date(Date.now()+1800000).toISOString()},{scope:{...i.scope,pet_ids:i.scope.pet_ids.slice(0,1)}}])await denied(authorizePrivateRecord(t.owner.actor,{...i,...changed},randomUUID()),'AUTHORIZATION_MISMATCH');
 const a=await authorizePrivateRecord(t.owner.actor,i,key);assert.deepEqual(await authorizePrivateRecord(t.owner.actor,i,key),a);await denied(authorizePrivateRecord(t.owner.actor,{...i,reviewed_digest:'0'.repeat(64)},key),'IDEMPOTENCY_MISMATCH');
 assert.equal((await pool.query('select count(*)::int n from action_authorizations where household_id=$1',[t.householdId])).rows[0].n,1);
 assert.equal((await pool.query('select count(*)::int n from share_grants where household_id=$1',[t.householdId])).rows[0].n,1);
 const current={...i,...await expected(t.owner.actor,t.householdId)};await denied(authorizePrivateRecord(t.owner.actor,current,randomUUID()),'STALE_STATE');
});

test('AT043/044 grant locator grants nothing; verified recipient, current session and revocation are enforced',async()=>{
 const t=await testHousehold(),foreign=await testIdentity(),p=await preview(t,'share'),a=await authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID());
 await denied(viewSharedRecord(foreign.actor,a.value.grant_id),'SCOPE_MISMATCH');await denied(viewSharedRecord(t.owner.actor,a.value.grant_id),'SCOPE_MISMATCH');
 assert.equal((await viewSharedRecord(t.caregiver.actor,a.value.grant_id)).content,p.value.content);
 await revokePrivateShare(t.owner.actor,{household_id:t.householdId,grant_id:a.value.grant_id,...await expected(t.owner.actor,t.householdId)},randomUUID());await denied(viewSharedRecord(t.caregiver.actor,a.value.grant_id),'SHARE_UNAVAILABLE');
 const e=await preview(t),authorized=await authorizePrivateRecord(t.owner.actor,approval(t,e),randomUUID());await denied(downloadPrivateExport(foreign.actor,authorized.value.export_id),'SCOPE_MISMATCH');await denied(downloadPrivateExport(t.caregiver.actor,authorized.value.export_id),'FORBIDDEN');
});

test('fresh auth and expired preview/session fail closed without consuming authorization',async()=>{
 const t=await testHousehold(),p=await preview(t,'share');
 await pool.query("update auth.sessions set created_at=now()-interval '11 minutes' where id=$1",[t.owner.actor.sessionId]);await denied(authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID()),'FRESH_AUTH_REQUIRED');
 await pool.query('update auth.sessions set created_at=now() where id=$1',[t.owner.actor.sessionId]);
 const a=await authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID());await viewSharedRecord(t.caregiver.actor,a.value.grant_id);
 await pool.query("update private.record_view_sessions set expires_at=now()-interval '1 second' where grant_id=$1",[a.value.grant_id]);await denied(viewSharedRecord(t.caregiver.actor,a.value.grant_id),'FRESH_AUTH_REQUIRED');
 const expired=await preview(t);await pool.query("update auth.sessions set created_at=now()-interval '31 minutes' where id=$1",[t.caregiver.actor.sessionId]);await denied(viewSharedRecord(t.caregiver.actor,a.value.grant_id),'FRESH_AUTH_REQUIRED');
 await denied(previewPrivateRecord(t.owner.actor,{household_id:t.householdId,case_id:t.caseId,...await expected(t.owner.actor,t.householdId),purpose:'export',format:'text',recipient_address:null,expires_at:new Date(Date.now()-1000).toISOString()},randomUUID()),'INVALID_EXPIRY');assert.ok(expired.value.summary_id);
});

test('local view-session prune preserves a fresh-session denial marker and removes only an expired exact grant after freshness ends',async()=>{
 const t=await testHousehold(),other=await testHousehold('single_cat');
 const p=await preview(t,'share'),a=await authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID());
 const q=await preview(other,'share'),b=await authorizePrivateRecord(other.owner.actor,approval(other,q),randomUUID());
 await viewSharedRecord(t.caregiver.actor,a.value.grant_id);
 await viewSharedRecord(other.caregiver.actor,b.value.grant_id);
 await assert.rejects(viewSessionCli('--apply','--grant-id',a.value.grant_id,'--limit','0'),(e:any)=>/Limit must be an integer/.test(e.stderr));
 await pool.query("update private.record_view_sessions set expires_at=now()-interval '1 second' where grant_id=$1",[a.value.grant_id]);
 await denied(viewSharedRecord(t.caregiver.actor,a.value.grant_id),'FRESH_AUTH_REQUIRED');
 const held=JSON.parse((await viewSessionCli('--grant-id',a.value.grant_id)).stdout);
 assert.equal(held.expired,1);assert.equal(held.held_for_fresh_session,1);assert.equal(held.eligible,0);
 const blocked=JSON.parse((await viewSessionCli('--apply','--grant-id',a.value.grant_id,'--limit','1')).stdout);
 assert.equal(blocked.removed,0);
 assert.equal((await pool.query('select 1 from private.record_view_sessions where grant_id=$1',[a.value.grant_id])).rowCount,1);
 await pool.query("update auth.sessions set created_at=now()-interval '31 minutes' where id=$1",[t.caregiver.actor.sessionId]);
 const eligible=JSON.parse((await viewSessionCli('--grant-id',a.value.grant_id)).stdout);
 assert.equal(eligible.eligible,1);assert.equal(eligible.held_for_fresh_session,0);
 const applied=JSON.parse((await viewSessionCli('--apply','--grant-id',a.value.grant_id,'--limit','1')).stdout);
 assert.equal(applied.removed,1);assert.equal((await pool.query('select 1 from private.record_view_sessions where grant_id=$1',[a.value.grant_id])).rowCount,0);
 assert.equal(JSON.parse((await viewSessionCli('--apply','--grant-id',a.value.grant_id,'--limit','1')).stdout).removed,0);
 await denied(viewSharedRecord(t.caregiver.actor,a.value.grant_id),'FRESH_AUTH_REQUIRED');
 assert.equal((await pool.query('select 1 from private.record_view_sessions where grant_id=$1',[b.value.grant_id])).rowCount,1);
 assert.equal((await viewSharedRecord(other.caregiver.actor,b.value.grant_id)).content,q.value.content);
});

test('scope, stale epoch, unverified recipient and direct Data API access are denied',async()=>{
 const t=await testHousehold(),other=await testHousehold(),p=await preview(t);
 await denied(authorizePrivateRecord(t.caregiver.actor,approval(t,p),randomUUID()),'FORBIDDEN');await denied(draftPrivateSummary(t.owner.actor,other.householdId,other.caseId),'SCOPE_MISMATCH');
 await pool.query('update memberships set pet_scope=$3 where household_id=$1 and profile_id=$2',[t.householdId,t.caregiver.actor.userId,[]]);await denied(draftPrivateSummary(t.caregiver.actor,t.householdId,t.caseId),'SCOPE_MISMATCH');
 await denied(previewPrivateRecord(t.owner.actor,{household_id:t.householdId,case_id:t.caseId,...await expected(t.owner.actor,t.householdId),purpose:'share',format:'text',recipient_address:'unverified@denlumi.invalid',expires_at:new Date(Date.now()+60000).toISOString()},randomUUID()),'VERIFIED_RECIPIENT_REQUIRED');
 await pool.query('update households set safety_epoch=safety_epoch+1 where id=$1',[t.householdId]);await denied(authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID()),'STALE_STATE');
 for(const table of ['professional_summaries','action_authorizations','private_exports','share_grants']){const read=await authClient(t.owner.token).from(table).select('*');assert.equal(read.error,null);assert.deepEqual(read.data,[]);const write=await authClient(t.owner.token).from(table).insert({household_id:t.householdId});assert.ok(write.error);}
});

test('AT034 archive preserves attributed history and cancels future work without generating a replacement narrative',async()=>{
 const t=await testHousehold('single_cat'),o=await observation(t),pet=o.pets[0];
 const rule=await createRoutine(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),pet_id:pet.id,kind:'water',instruction:'Owner-entered water routine.',schedule_spec:{schema_version:'1',timezone:'Africa/Cairo',frequency:'daily',local_time:'08:00',days_of_week:[],dst_policy:'wall_clock_first_valid'}},randomUUID()) as any;
 await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),from_date:'2026-09-23',through_date:'2026-09-24'},randomUUID());
 const result=await archivePrivatePet(t.owner.actor,{household_id:t.householdId,pet_id:pet.id,expected_pet_version:pet.version,...await expected(t.owner.actor,t.householdId),confirm_archive:true},randomUUID());assert.equal(result.value.history_preserved,true);
 assert.equal((await pool.query('select raw_report from observations where id=$1',[o.id])).rows[0].raw_report,'<script>alert(1)</script> Nora did not chase Finn; meaning is uncertain.');
 assert.equal((await pool.query('select status from routine_rules where id=$1',[rule.value.routine_rule_id])).rows[0].status,'archived');assert.equal((await pool.query("select count(*)::int n from task_occurrences where household_id=$1 and state<>'canceled'",[t.householdId])).rows[0].n,0);
 const generated=await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),from_date:'2026-09-25',through_date:'2026-09-25'},randomUUID()) as any;assert.equal(generated.value.created,0);
 assert.equal((await draftPrivateSummary(t.owner.actor,t.householdId,t.caseId)).body.observations.length,1);
});

test('whole-household deletion disables reads first, removes primary history/exports/idempotency and preserves other households',async()=>{
 const t=await testHousehold(),other=await testHousehold(),o=await observation(t),p=await preview(t,'share'),a=await authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID());await viewSharedRecord(t.caregiver.actor,a.value.grant_id);
 // Include a guarded session history row and its deferred participant invariant.
 await transaction(async db=>{const plan=(await db.query('select * from plan_revisions where household_id=$1 limit 1',[t.householdId])).rows[0];const sid=randomUUID();await db.query("insert into sessions(id,household_id,case_id,plan_revision_id,protocol_version_id,started_by,state,safety_epoch,home_version,plan_digest,idempotency_key) values($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10)",[sid,t.householdId,t.caseId,plan.id,plan.protocol_version_id,t.owner.actor.userId,plan.safety_epoch,plan.home_version,plan.digest,randomUUID()]);for(const pet of o.pets)await db.query('insert into session_pets(household_id,session_id,case_id,pet_id) values($1,$2,$3,$4)',[t.householdId,sid,t.caseId,pet.id]);});
 const rule=await createRoutine(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),pet_id:o.pets[0].id,kind:'water',instruction:'Owner report.',schedule_spec:{schema_version:'1',timezone:'Africa/Cairo',frequency:'daily',local_time:'08:00',days_of_week:[],dst_policy:'wall_clock_first_valid'}},randomUUID()) as any;
 await generateOccurrences(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),from_date:'2026-09-22',through_date:'2026-09-22'},randomUUID());const task=(await pool.query('select id from task_occurrences where routine_rule_id=$1',[rule.value.routine_rule_id])).rows[0];await reportTask(t.caregiver.actor,task.id,{report:'uncertain',performed_at:null,note:'No physical action verified.'},randomUUID());
 const input={household_id:t.householdId,...await expected(t.owner.actor,t.householdId),confirm_household_deletion:true},key=randomUUID();const request=await requestHouseholdDeletion(t.owner.actor,input,key);assert.equal(request.status,'pending');assert.equal(request.primary_cleanup_verified,false);assert.deepEqual(await requestHouseholdDeletion(t.owner.actor,input,key),request);
 await denied(listPrivateRecords(t.owner.actor,t.householdId),'SCOPE_MISMATCH');await denied(listInbox(t.caregiver.actor,t.householdId),'SCOPE_MISMATCH');await denied(viewSharedRecord(t.caregiver.actor,a.value.grant_id),'SCOPE_MISMATCH');await denied(householdDeletionStatus(other.owner.actor,request.request_id),'SCOPE_MISMATCH');
 const done=await processHouseholdDeletion(t.owner.actor,request.request_id);assert.equal(done.status,'completed');assert.equal(done.primary_cleanup_verified,true);assert.equal(done.account_identity_deleted,false);assert.match(done.retention_notice,/backup expiry is not configured/);
 assert.equal((await pool.query('select count(*)::int n from private.idempotency where household_id=$1',[t.householdId])).rows[0].n,0);assert.equal((await pool.query('select count(*)::int n from households where id=$1',[t.householdId])).rows[0].n,0);assert.ok(await householdGraph(other.owner.actor,other.householdId));assert.deepEqual(await processHouseholdDeletion(t.owner.actor,request.request_id),done);
});

test('expired demo access stays denied while its freshly authenticated owner can delete primary records',async()=>{
 const t=await testHousehold(),other=await testHousehold();
 const before=await expected(t.owner.actor,t.householdId);
 await pool.query("update households set expires_at=now()-interval '1 minute' where id=$1",[t.householdId]);
 await denied(householdGraph(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 await denied(listPrivateRecords(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 await denied(requestHouseholdDeletion(other.owner.actor,{household_id:t.householdId,...before,confirm_household_deletion:true},randomUUID()),'SCOPE_MISMATCH');
 await denied(requestHouseholdDeletion(t.caregiver.actor,{household_id:t.householdId,...before,confirm_household_deletion:true},randomUUID()),'FORBIDDEN');
 await denied(requestHouseholdDeletion(t.owner.actor,{household_id:t.householdId,...before,expected_state_version:before.expected_state_version+1,confirm_household_deletion:true},randomUUID()),'STALE_STATE');
 await pool.query("update auth.sessions set created_at=now()-interval '11 minutes' where id=$1",[t.owner.actor.sessionId]);
 await denied(requestHouseholdDeletion(t.owner.actor,{household_id:t.householdId,...before,confirm_household_deletion:true},randomUUID()),'FRESH_AUTH_REQUIRED');
 await pool.query('update auth.sessions set created_at=now() where id=$1',[t.owner.actor.sessionId]);
 const requested=await requestHouseholdDeletion(t.owner.actor,{household_id:t.householdId,...before,confirm_household_deletion:true},randomUUID());
 assert.equal(requested.status,'pending');
 const result=await processHouseholdDeletion(t.owner.actor,requested.request_id);
 assert.equal(result.status,'completed');assert.equal(result.primary_cleanup_verified,true);
 assert.equal((await pool.query('select 1 from households where id=$1',[t.householdId])).rowCount,0);
 assert.ok(await householdGraph(other.owner.actor,other.householdId));
});

test('expired demo deletion preparation exposes only versions to its owner and retains fresh-auth requirement',async()=>{
 const t=await testHousehold('single_dog',true),foreign=await testHousehold('single_cat',true);
 await denied(prepareExpiredDemoDeletion(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 await pool.query("update households set expires_at=now()-interval '1 minute' where id=$1",[t.householdId]);
 const prepared=await prepareExpiredDemoDeletion(t.owner.actor,t.householdId);
 assert.deepEqual(Object.keys(prepared).sort(),['deletion_only','expected_safety_epoch','expected_state_version','expired','household_id']);
 assert.equal(prepared.expired,true);assert.equal(prepared.deletion_only,true);
 await denied(prepareExpiredDemoDeletion(t.caregiver.actor,t.householdId),'SCOPE_MISMATCH');
 await denied(prepareExpiredDemoDeletion(foreign.owner.actor,t.householdId),'SCOPE_MISMATCH');
 await denied(householdGraph(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 await pool.query("update auth.sessions set created_at=now()-interval '11 minutes' where id=$1",[t.owner.actor.sessionId]);
 await denied(requestHouseholdDeletion(t.owner.actor,{household_id:t.householdId,expected_state_version:prepared.expected_state_version,expected_safety_epoch:prepared.expected_safety_epoch,confirm_household_deletion:true},randomUUID()),'FRESH_AUTH_REQUIRED');
 await pool.query('update auth.sessions set created_at=now() where id=$1',[t.owner.actor.sessionId]);
 const requested=await requestHouseholdDeletion(t.owner.actor,{household_id:t.householdId,expected_state_version:prepared.expected_state_version,expected_safety_epoch:prepared.expected_safety_epoch,confirm_household_deletion:true},randomUUID());
 assert.equal(requested.status,'pending');
 assert.equal((await processHouseholdDeletion(t.owner.actor,requested.request_id)).status,'completed');
});

test('expired fictional deletion code is exact, private, single-use and works without an owner session',async()=>{
 const t=await testHousehold('single_cat',true),other=await testHousehold('single_dog',true);
 const code=t.deletionRecoveryCode!;
 assert.match(code,new RegExp(`^d1\\.${t.householdId}\\.[A-Za-z0-9_-]{43}$`));
 const stored=(await pool.query('select code_hash,request_id from private.demo_deletion_codes where household_id=$1',[t.householdId])).rows[0];
 assert.equal(stored.code_hash,createHash('sha256').update(code).digest('hex'));
 assert.equal(stored.request_id,null);
 const direct=await authClient(t.owner.token).schema('private').from('demo_deletion_codes').select('*');
 assert.ok(direct.error);
 await denied(recoverExpiredDemoDeletion(code),'RECOVERY_UNAVAILABLE');
 await denied(recoverExpiredDemoDeletion(code.replace(t.householdId,other.householdId)),'RECOVERY_UNAVAILABLE');
 await denied(recoverExpiredDemoDeletion(code.slice(0,-1)+(code.endsWith('a')?'b':'a')),'RECOVERY_UNAVAILABLE');
 assert.equal((await pool.query('select status from households where id=$1',[t.householdId])).rows[0].status,'active');
 await pool.query("update households set expires_at=now()-interval '1 minute' where id=$1",[t.householdId]);
 await pool.query('delete from auth.sessions where id=$1',[t.owner.actor.sessionId]);
 await denied(householdGraph(t.owner.actor,t.householdId),'UNAUTHORIZED');
 const result=await recoverExpiredDemoDeletion(code);
 assert.equal(result.status,'completed');assert.equal(result.primary_cleanup_verified,true);
 assert.equal((await pool.query('select 1 from households where id=$1',[t.householdId])).rowCount,0);
 assert.equal((await pool.query('select 1 from private.demo_deletion_codes where household_id=$1',[t.householdId])).rowCount,0);
 await denied(recoverExpiredDemoDeletion(code),'RECOVERY_UNAVAILABLE');
 assert.ok(await householdGraph(other.owner.actor,other.householdId));
});

test('expired fictional deletion code leaves access disabled on cleanup failure and retries one request',async()=>{
 const t=await testHousehold('cat_cat',true),code=t.deletionRecoveryCode!;
 await pool.query("update households set expires_at=now()-interval '1 minute' where id=$1",[t.householdId]);
 await pool.query('create table private.phase9_code_cleanup_fixture(household_id uuid not null)');
 let requestId:string;
 try{
  const failed=await recoverExpiredDemoDeletion(code);
  assert.equal(failed.status,'failed');assert.equal(failed.last_error_code,'CLEANUP_SCHEMA_CHANGED');
  requestId=failed.request_id;
  assert.equal((await pool.query('select status from households where id=$1',[t.householdId])).rows[0].status,'deleting');
  assert.equal((await pool.query('select request_id from private.demo_deletion_codes where household_id=$1',[t.householdId])).rows[0].request_id,requestId);
  await denied(householdGraph(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 }finally{await pool.query('drop table private.phase9_code_cleanup_fixture');}
 const done=await recoverExpiredDemoDeletion(code);
 assert.equal(done.status,'completed');assert.equal(done.primary_cleanup_verified,true);
 assert.equal(done.request_id,requestId!);
 assert.equal((await pool.query('select attempts from private.deletion_requests where id=$1',[requestId!])).rows[0].attempts,2);
 assert.equal((await pool.query('select 1 from households where id=$1',[t.householdId])).rowCount,0);
});

test('expired deletion codes cannot extend the seven-day window or enroll older unconsented demos',async()=>{
 const t=await testHousehold('single_dog',true),unconsented=await testHousehold('single_cat');
 assert.equal(unconsented.deletionRecoveryCode,null);
 assert.equal((await pool.query('select 1 from private.demo_deletion_codes where household_id=$1',[unconsented.householdId])).rowCount,0);
 await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours',demo_purge_at=now()-interval '1 day' where id=$1",[t.householdId]);
 await pool.query("update private.demo_deletion_codes set issued_at=now()-interval '8 days',expires_at=now()-interval '1 day' where household_id=$1",[t.householdId]);
 await denied(recoverExpiredDemoDeletion(t.deletionRecoveryCode!),'RECOVERY_UNAVAILABLE');
 assert.equal((await pool.query('select status from households where id=$1',[t.householdId])).rows[0].status,'active');
 const worker=await cleanupDueDemoHousehold(t.householdId);
 assert.equal(worker.status,'completed');assert.equal(worker.primary_cleanup_verified,true);
 assert.equal((await pool.query('select 1 from households where id=$1',[unconsented.householdId])).rowCount,1);
});

test('local retention worker deletes only due consented fictional demo primary data',async()=>{
 const due=await testHousehold('cat_dog',true),unconsented=await testHousehold(),young=await testHousehold('single_cat',true);
 const liveOwner=await testIdentity();
 const live=await createHousehold(liveOwner.actor,{nickname:'Fictional live coordination',timezone:'Africa/Cairo',locale:'en',adult_acknowledged:true,notification_preferences:{internal_inbox:true,email:false}},randomUUID());
 const p=await preview(due),a=await authorizePrivateRecord(due.owner.actor,approval(due,p),randomUUID());
 assert.equal((await cleanupDueDemoHousehold(young.householdId)).status,'not_due_or_not_consented');
 assert.equal((await cleanupDueDemoHousehold(live.household_id)).status,'not_due_or_not_consented');
 const forged=await authClient(unconsented.owner.token).from('households').update({demo_retention_acknowledged_at:new Date().toISOString(),demo_purge_at:new Date(Date.now()+7*86400000).toISOString()}).eq('id',unconsented.householdId).select('id');
 assert.ok(forged.error||!forged.data?.length);
 assert.equal((await pool.query('select demo_retention_acknowledged_at from households where id=$1',[unconsented.householdId])).rows[0].demo_retention_acknowledged_at,null);
 await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours',demo_purge_at=now()-interval '1 day' where id=$1",[due.householdId]);
 await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours' where id=$1",[unconsented.householdId]);
 assert.equal((await cleanupDueDemoHousehold(unconsented.householdId)).status,'not_due_or_not_consented');
 const completed=await cleanupDueDemoHousehold(due.householdId);
 assert.equal(completed.status,'completed');assert.equal(completed.primary_cleanup_verified,true);
 assert.equal((await pool.query('select 1 from households where id=$1',[due.householdId])).rowCount,0);
 assert.equal((await pool.query('select 1 from private_exports where id=$1',[a.value.export_id])).rowCount,0);
 assert.equal((await pool.query('select 1 from households where id=$1',[unconsented.householdId])).rowCount,1);
 assert.ok(await householdGraph(young.owner.actor,young.householdId));
});

test('local retention worker leaves a failed demo disabled and retries only its own request',async()=>{
 const t=await testHousehold('single_dog',true);
 await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours',demo_purge_at=now()-interval '1 day' where id=$1",[t.householdId]);
 await pool.query('create table private.phase9_cleanup_fixture(household_id uuid not null)');
 try{
  const failed=await cleanupDueDemoHousehold(t.householdId);
  assert.equal(failed.status,'failed');assert.equal(failed.last_error_code,'CLEANUP_SCHEMA_CHANGED');
  assert.equal((await pool.query('select status from households where id=$1',[t.householdId])).rows[0].status,'deleting');
  await denied(householdGraph(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 }finally{await pool.query('drop table private.phase9_cleanup_fixture');}
 const done=await cleanupDueDemoHousehold(t.householdId);
 assert.equal(done.status,'completed');assert.equal(done.primary_cleanup_verified,true);
});

test('local operator CLI reports failed demo cleanup and retries only its exact task-created ID',async()=>{
 const t=await testHousehold('single_cat',true);
 await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours',demo_purge_at=now()-interval '1 day' where id=$1",[t.householdId]);
 const before=JSON.parse((await cleanupCli()).stdout);
 await pool.query('create table private.phase9_cli_cleanup_fixture(household_id uuid not null)');
 try{
  await assert.rejects(cleanupCli('--apply','--household-id',t.householdId),(e:any)=>{
   const result=JSON.parse(e.stdout);
   assert.equal(result.status,'failed');assert.equal(result.last_error_code,'CLEANUP_SCHEMA_CHANGED');
   assert.ok(!e.stdout.includes(t.householdId));return true;
  });
  const failed=JSON.parse((await cleanupCli()).stdout);
  assert.equal(failed.failed_demo_jobs,before.failed_demo_jobs+1);
  assert.equal(failed.ready,before.ready-1);
  assert.ok(!JSON.stringify(failed).includes(t.householdId));
  assert.equal((await pool.query('select status from households where id=$1',[t.householdId])).rows[0].status,'deleting');
  await denied(householdGraph(t.owner.actor,t.householdId),'SCOPE_MISMATCH');
 }finally{await pool.query('drop table private.phase9_cli_cleanup_fixture');}
 const done=JSON.parse((await cleanupCli('--apply','--household-id',t.householdId)).stdout);
 assert.equal(done.status,'completed');assert.equal(done.primary_cleanup_verified,true);
 assert.ok(!(await pool.query('select 1 from households where id=$1',[t.householdId])).rowCount);
 assert.equal(JSON.parse((await cleanupCli()).stdout).failed_demo_jobs,before.failed_demo_jobs);
});

test('bounded local retention batch processes explicit due IDs and skips an unconsented ID',async()=>{
 const first=await testHousehold('single_cat',true),second=await testHousehold('single_dog',true),unconsented=await testHousehold();
 for(const id of [first.householdId,second.householdId])await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours',demo_purge_at=now()-interval '1 day' where id=$1",[id]);
 await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours' where id=$1",[unconsented.householdId]);
 await denied(cleanupDueDemoHouseholds([first.householdId,first.householdId]),'INVALID_INPUT');
 const run=await cleanupDueDemoHouseholds([first.householdId,unconsented.householdId,second.householdId]);
 assert.deepEqual(run,{attempted:3,completed:2,failed:0,skipped:1,processing:0});
 assert.equal((await pool.query('select 1 from households where id=any($1::uuid[])',[[first.householdId,second.householdId]])).rowCount,0);
 assert.equal((await pool.query('select 1 from households where id=$1',[unconsented.householdId])).rowCount,1);
});

test('bounded operator CLI selects only explicitly scoped due consented demos',async()=>{
 const first=await testHousehold('single_cat',true),second=await testHousehold('single_dog',true),unconsented=await testHousehold(),unlisted=await testHousehold('cat_cat',true);
 for(const id of [first.householdId,second.householdId,unlisted.householdId])await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours',demo_purge_at=now()-interval '1 day' where id=$1",[id]);
 await pool.query("update households set created_at=now()-interval '8 days',expires_at=now()-interval '7 days 23 hours' where id=$1",[unconsented.householdId]);
 try{
  const scope=[first.householdId,second.householdId,unconsented.householdId].join(',');
  const result=JSON.parse((await cleanupCli('--apply','--limit','20','--household-ids',scope)).stdout);
  assert.deepEqual({mode:result.mode,scope:result.scope,attempted:result.attempted,completed:result.completed,failed:result.failed,skipped:result.skipped},{mode:'bounded_batch_apply',scope:'explicit_ids',attempted:2,completed:2,failed:0,skipped:0});
  assert.ok(!JSON.stringify(result).includes(first.householdId));
  assert.equal((await pool.query('select 1 from households where id=any($1::uuid[])',[[first.householdId,second.householdId]])).rowCount,0);
  assert.equal((await pool.query('select 1 from households where id=$1',[unconsented.householdId])).rowCount,1);
  assert.equal((await pool.query('select 1 from households where id=$1',[unlisted.householdId])).rowCount,1);
 }finally{await cleanupDueDemoHousehold(unlisted.householdId);}
});

test('cleanup failure remains disabled, visible and retryable; append-only records cannot be deleted outside explicit workflow',async()=>{
 const t=await testHousehold(),o=await observation(t);await assert.rejects(pool.query('delete from observations where id=$1',[o.id]));
 const request=await requestHouseholdDeletion(t.owner.actor,{household_id:t.householdId,...await expected(t.owner.actor,t.householdId),confirm_household_deletion:true},randomUUID());
 // A new unknown tenant table is a conservative cleanup blocker, not a silently skipped record store.
 await pool.query('create table private.phase7_cleanup_fixture(household_id uuid not null)');
 try{const failed=await processHouseholdDeletion(t.owner.actor,request.request_id);assert.equal(failed.status,'failed');assert.equal(failed.primary_cleanup_verified,false);assert.equal(failed.last_error_code,'CLEANUP_SCHEMA_CHANGED');await denied(listPrivateRecords(t.owner.actor,t.householdId),'SCOPE_MISMATCH');}finally{await pool.query('drop table private.phase7_cleanup_fixture');}
 assert.equal((await processHouseholdDeletion(t.owner.actor,request.request_id)).status,'completed');
});

// Expired database boundary fixtures avoid a timing-sensitive sleep and preserve immutable rows.
// Clone an exact, already-authorized snapshot into a separately dated historical fixture.
async function expiredArtifact(t:any,purpose:'export'|'share'){
 const p=await preview(t,purpose),a=await authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID());
 return transaction(async db=>{
  const summaryId=randomUUID(),authorizationId=randomUUID(),artifactId=randomUUID();
  await db.query(`insert into professional_summaries(id,household_id,case_id,created_by,body,source_event_ids,scope,digest,content_text,format,purpose,recipient_address,recipient_id,expires_at,state_version,safety_epoch,created_at)
   select $1,household_id,case_id,created_by,body,source_event_ids,scope,digest,content_text,format,purpose,recipient_address,recipient_id,now()-interval '1 hour',state_version,safety_epoch,now()-interval '2 hours' from professional_summaries where id=$2`,[summaryId,p.value.summary_id]);
  const cloned=(await db.query('select * from professional_summaries where id=$1',[summaryId])).rows[0];
  const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const binding={owner_id:cloned.created_by,summary_id:cloned.id,digest:cloned.digest,purpose:cloned.purpose,format:cloned.format,recipient_address:cloned.recipient_address,recipient_id:cloned.recipient_id,scope:cloned.scope,expires_at:new Date(cloned.expires_at).toISOString()};
  const payloadDigest=createHash('sha256').update(JSON.stringify(canonical(binding))).digest('hex');
  await db.query(`insert into action_authorizations(id,household_id,summary_id,owner_id,action_kind,payload_digest,expires_at,consumed_at,idempotency_key,created_at)
   select $1,household_id,$2,owner_id,action_kind,$5,now()-interval '110 minutes',now()-interval '119 minutes',$3,now()-interval '2 hours' from action_authorizations where id=$4`,[authorizationId,summaryId,randomUUID(),a.value.authorization_id,payloadDigest]);
  if(purpose==='export')await db.query(`insert into private_exports(id,household_id,summary_id,authorization_id,owner_id,mime_type,content_text,digest,expires_at,created_at)
   select $1,household_id,$2,$3,owner_id,mime_type,content_text,digest,now()-interval '1 hour',now()-interval '119 minutes' from private_exports where id=$4`,[artifactId,summaryId,authorizationId,a.value.export_id]);
  else await db.query(`insert into share_grants(id,household_id,summary_id,authorization_id,recipient_id,recipient_address,scope,expires_at,created_at)
   select $1,household_id,$2,$3,recipient_id,recipient_address,scope,now()-interval '1 hour',now()-interval '119 minutes' from share_grants where id=$4`,[artifactId,summaryId,authorizationId,a.value.grant_id]);
  return artifactId;
 });
}

test('actual expired grants and stored exports deny their otherwise authorized accounts without deleting bytes',async()=>{
 const t=await testHousehold();
 const grant=await expiredArtifact(t,'share');await denied(viewSharedRecord(t.caregiver.actor,grant),'SHARE_UNAVAILABLE');
 const exported=await expiredArtifact(t,'export');await denied(downloadPrivateExport(t.owner.actor,exported),'EXPORT_EXPIRED');
 assert.equal((await pool.query('select expires_at<now() expired from share_grants where id=$1',[grant])).rows[0].expired,true);
 assert.equal((await pool.query('select expires_at<now() expired,length(content_text)>0 retained from private_exports where id=$1',[exported])).rows[0].retained,true);
});

test('membership revocation and deleted authentication sessions invalidate cached access and approval replay',async()=>{
 const t=await testHousehold(),p=await preview(t,'share'),i=approval(t,p),key=randomUUID(),authorized=await authorizePrivateRecord(t.owner.actor,i,key);
 assert.equal((await draftPrivateSummary(t.caregiver.actor,t.householdId,t.caseId)).private_draft_only,true);
 const member=(await pool.query('select id from memberships where household_id=$1 and profile_id=$2',[t.householdId,t.caregiver.actor.userId])).rows[0];
 await revokeMembership(t.owner.actor,t.householdId,member.id,await expected(t.owner.actor,t.householdId),randomUUID());
 await denied(draftPrivateSummary(t.caregiver.actor,t.householdId,t.caseId),'SCOPE_MISMATCH');
 // Independent explicit external grants do not inherit membership; revoking that account's
 // authentication session must still block the grant immediately, without waiting for JWT expiry.
 await pool.query('delete from auth.sessions where id=$1',[t.caregiver.actor.sessionId]);
 await denied(viewSharedRecord(t.caregiver.actor,authorized.value.grant_id),'UNAUTHORIZED');
 await pool.query('delete from auth.sessions where id=$1',[t.owner.actor.sessionId]);
 await denied(listPrivateRecords(t.owner.actor,t.householdId),'UNAUTHORIZED');
 await denied(authorizePrivateRecord(t.owner.actor,i,key),'UNAUTHORIZED');
});

test('ownership transfer removes original owner private-export and authorization access immediately',async()=>{
 const t=await testHousehold(),p=await preview(t),a=await authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID());
 const pending=await preview(t,'share');
 await transferOwnership(t.owner.actor,t.householdId,{...await expected(t.owner.actor,t.householdId),new_owner_id:t.caregiver.actor.userId,confirm_transfer:true},randomUUID());
 await denied(downloadPrivateExport(t.owner.actor,a.value.export_id),'FORBIDDEN');
 await denied(listPrivateRecords(t.owner.actor,t.householdId),'FORBIDDEN');
 await denied(authorizePrivateRecord(t.owner.actor,approval(t,pending),randomUUID()),'FORBIDDEN');
 assert.equal((await listPrivateRecords(t.caregiver.actor,t.householdId)).household_id,t.householdId);
 // A new owner cannot recycle the previous owner's unconsumed approval, even using fresh state.
 await denied(authorizePrivateRecord(t.caregiver.actor,{...approval(t,pending),...await expected(t.caregiver.actor,t.householdId)},randomUUID()),'SCOPE_MISMATCH');
});

test('export retains the original report and appended correction with separate attribution and source IDs',async()=>{
 const t=await testHousehold(),o=await observation(t),correctionId=randomUUID();
 await pool.query("update observations set status='confirmed',confirmed_at=now() where id=$1",[o.id]);
 await pool.query(`insert into observations(id,household_id,case_id,reporter_id,raw_report,actor_pet_id,target_pet_id,assertion,source_kind,status,observed_at,reported_at,confirmed_at,digest,supersedes_id,correction_reason,normalized_observation)
 values($1,$2,$3,$4,'Correction: Finn may have approached Nora; the earlier direction was mistaken.',$5,$6,'uncertain','typed','confirmed','2026-09-22T08:00:00Z','2026-09-22T08:15:00Z',now(),$7,$8,'The original actor and target were reversed.',$9)`,[correctionId,t.householdId,t.caseId,t.caregiver.actor.userId,o.pets[1].id,o.pets[0].id,'2'.repeat(64),o.id,JSON.stringify({schema_version:'1',values:{correction:true},unknowns:['meaning']})]);
 await pool.query("update observations set status='corrected' where id=$1",[o.id]);
 const p=await preview(t),a=await authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID()),download=await downloadPrivateExport(t.owner.actor,a.value.export_id);
 const [original,corrected]=p.value.body.observations;
 assert.equal(original.id,o.id);assert.equal(original.status,'corrected');assert.equal(original.assertion,'negated');assert.equal(original.actor_pet_id,o.pets[0].id);
 assert.equal(corrected.id,correctionId);assert.equal(corrected.supersedes_id,o.id);assert.equal(corrected.actor_pet_id,o.pets[1].id);assert.equal(corrected.target_pet_id,o.pets[0].id);assert.equal(corrected.assertion,'uncertain');assert.equal(corrected.reporter_id,t.caregiver.actor.userId);assert.equal(new Date(corrected.reported_at).toISOString(),'2026-09-22T08:15:00.000Z');
 assert.ok(p.value.scope.source_ids.includes(o.id));assert.ok(p.value.scope.source_ids.includes(correctionId));assert.match(download.content,/Nora did not chase Finn/);assert.match(download.content,/Finn may have approached Nora/);assert.match(download.content,/The original actor and target were reversed/);
});

test('protocol withdrawal between preview and approval invalidates that approval without fabricating successful export',async()=>{
 const t=await testHousehold(),p=await preview(t),protocolId=p.value.body.plan_history[0].protocol_version_id;
 const before=(await pool.query('select revoked_at from protocol_versions where id=$1',[protocolId])).rows[0];
 try{
  await pool.query('update protocol_versions set revoked_at=now() where id=$1',[protocolId]);
  await denied(authorizePrivateRecord(t.owner.actor,approval(t,p),randomUUID()),'STALE_STATE');
  assert.equal((await pool.query('select count(*)::int n from action_authorizations where household_id=$1',[t.householdId])).rows[0].n,0);
  assert.equal((await pool.query('select count(*)::int n from private_exports where household_id=$1',[t.householdId])).rows[0].n,0);
  assert.equal((await draftPrivateSummary(t.owner.actor,t.householdId,t.caseId)).private_draft_only,true);
 }finally{await pool.query('update protocol_versions set revoked_at=$2 where id=$1',[protocolId,before.revoked_at]);}
});
