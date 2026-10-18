import type pg from 'pg';
import { createHash,randomUUID,timingSafeEqual } from 'node:crypto';
import { transaction,assertSession,DomainError,type Actor } from './db';
import { invalidate } from './household';
import { digest } from '../content/fixtures';
import { recordPreviewInput,recordAuthorizeInput,revokeShareInput,archivePetInput,deletionInput } from '../contracts/phase7';

const freshMinutes=10;
export const retentionNotice='Expiry disables access but does not itself erase stored snapshots. New fictional samples that accepted the displayed retention notice may have local primary household records deleted by a cleanup worker no earlier than seven days after creation; cleanup may be delayed. Other private records remain until owner deletion or a published account policy. Primary cleanup is verified only when the deletion status is completed and primary_cleanup_verified is true. Historical backup expiry is not configured or verified; backups and copies previously downloaded by recipients cannot be recalled. Account identity and other households are not deleted.';
export const demoRetentionNotice='New fictional samples lose access after 24 hours. If the local cleanup worker runs, primary household records are eligible for deletion seven days after creation. Cleanup can be delayed while the worker is not running. Historical backup expiry is not configured or verified, and downloaded copies cannot be recalled. Older samples without this recorded notice are excluded from automatic cleanup.';
const keyCheck=(key:string)=>{if(!/^[a-zA-Z0-9-]{16,100}$/.test(key))throw new DomainError('IDEMPOTENCY_KEY_REQUIRED',400);};
const iso=(v:string|Date)=>new Date(v).toISOString();
const byteDigest=(v:string)=>createHash('sha256').update(v).digest('hex');
const escapeHtml=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderPrivateSummary(body:unknown,format:'text'|'html'){
 const text='Denlumi private factual record\nReported information, not a diagnosis or physical verification.\n\n'+JSON.stringify(body,null,2);
 return format==='html'?'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Private factual record</title></head><body><h1>Private factual record</h1><pre>'+escapeHtml(text)+'</pre></body></html>':text;
}
async function freshAuth(db:pg.PoolClient,actor:Actor,minutes=freshMinutes){
 await assertSession(db,actor);
 if(!(await db.query('select 1 from auth.sessions where id=$1 and user_id=$2 and created_at>now()-($3::int*interval \'1 minute\')',[actor.sessionId,actor.userId,minutes])).rowCount)throw new DomainError('FRESH_AUTH_REQUIRED',401);
}
async function access(db:pg.PoolClient,actor:Actor,householdId:string,owner=false,allowExpiredForDeletion=false){
 await assertSession(db,actor);
 const h=(await db.query('select * from households where id=$1 for share',[householdId])).rows[0];
 const m=(await db.query('select * from memberships where household_id=$1 and profile_id=$2 and accepted_at is not null and revoked_at is null and (expires_at is null or expires_at>now())',[householdId,actor.userId])).rows[0];
 if(!h||h.status!=='active'||(!allowExpiredForDeletion&&h.expires_at&&new Date(h.expires_at)<=new Date())||!m)throw new DomainError('SCOPE_MISMATCH',403);
 if(owner&&(m.role!=='owner'||h.owner_id!==actor.userId||m.pet_scope!==null||m.case_scope!==null))throw new DomainError('FORBIDDEN',403);
 return {h,m};
}
async function ownerWrite(actor:Actor,id:string,input:{expected_state_version:number;expected_safety_epoch:number},key:string,body:any,run:(db:pg.PoolClient,h:any)=>Promise<any>){
 keyCheck(key);return transaction(async db=>{
  const h=(await db.query('select * from households where id=$1 for update',[id])).rows[0];
  await access(db,actor,id,true);
  if(body.operation==='private_record_authorized')await freshAuth(db,actor);
  const prior=(await db.query('select * from private.idempotency where household_id=$1 and actor_id=$2 and key=$3',[id,actor.userId,key])).rows[0];
  if(prior){if(prior.body_hash!==digest(body))throw new DomainError('IDEMPOTENCY_MISMATCH');return prior.result;}
  if(h.state_version!==input.expected_state_version||h.safety_epoch!==input.expected_safety_epoch)throw new DomainError('STALE_STATE');
  const value=await run(db,h);await db.query('update households set state_version=state_version+1 where id=$1',[id]);
  const epoch=(await db.query('select safety_epoch from households where id=$1',[id])).rows[0].safety_epoch;
  const result={value,state_version:h.state_version+1,safety_epoch:epoch};
  await db.query('insert into private.idempotency(household_id,actor_id,key,body_hash,result) values($1,$2,$3,$4,$5)',[id,actor.userId,key,digest(body),JSON.stringify(result)]);
  await db.query('insert into audit_events(household_id,actor_id,event_type,safety_epoch) values($1,$2,$3,$4)',[id,actor.userId,body.operation,epoch]);return result;
 });
}
async function snapshot(db:pg.PoolClient,actor:Actor,householdId:string,caseId:string){
 const {h,m}=await access(db,actor,householdId);
 const c=(await db.query('select id,title,scenario_code,support_level,status,intake from cases where household_id=$1 and id=$2',[householdId,caseId])).rows[0];
 const pets=(await db.query('select p.id,p.nickname,p.species,p.archived_at,cp.role from case_pets cp join pets p on p.id=cp.pet_id and p.household_id=cp.household_id where cp.household_id=$1 and cp.case_id=$2 order by p.id',[householdId,caseId])).rows;
 if(!c||!pets.length||(m.case_scope&&!m.case_scope.includes(caseId))||(m.pet_scope&&pets.some(p=>!m.pet_scope.includes(p.id))))throw new DomainError('SCOPE_MISMATCH',403);
 const observations=(await db.query('select id,reporter_id,raw_report,actor_pet_id,target_pet_id,assertion,source_kind,status,observed_at,reported_at,confirmed_at,normalized_observation,context_snapshot,supersedes_id,correction_reason from observations where household_id=$1 and case_id=$2 order by reported_at,id',[householdId,caseId])).rows;
 const plans=(await db.query('select p.id,p.revision_number,p.status,p.safety_epoch,p.home_version,p.locale,p.current_step,p.created_at,p.digest,p.participant_digest,p.intake_digest,p.home_digest,p.protocol_version_id,p.protocol_digest recorded_protocol_digest,v.status protocol_status,v.digest protocol_digest,v.revoked_at,v.review_due_at from plan_revisions p join protocol_versions v on v.id=p.protocol_version_id where p.household_id=$1 and p.case_id=$2 order by p.revision_number',[householdId,caseId])).rows;
 const planSteps=(await db.query('select s.id,s.plan_revision_id,s.step_key,s.sequence,s.status,s.prerequisite_snapshot,s.created_at from plan_steps s join plan_revisions p on p.id=s.plan_revision_id and p.household_id=s.household_id where s.household_id=$1 and p.case_id=$2 order by p.revision_number,s.sequence,s.id',[householdId,caseId])).rows;
 const stepsByPlan=new Map<string,typeof planSteps>();
 for(const step of planSteps){const steps=stepsByPlan.get(step.plan_revision_id)??[];steps.push(step);stepsByPlan.set(step.plan_revision_id,steps);}
 const planHistory=plans.map((plan,index)=>({
  ...plan,
  recorded_input_changes_from_previous_revision:index===0?null:(['participant_digest','intake_digest','home_digest','protocol_version_id','recorded_protocol_digest','home_version','locale'] as const).filter(field=>plan[field]!==plans[index-1][field]),
  steps:stepsByPlan.get(plan.id)??[],
 }));
 const sessions=(await db.query('select id,state,started_by,created_at,ended_at,interruption_reason,protocol_version_id from sessions where household_id=$1 and case_id=$2 order by created_at,id',[householdId,caseId])).rows;
 const handovers=(await db.query('select id,actor_id,body,status,safety_epoch,created_at from handovers where household_id=$1 and case_id=$2 order by created_at,id',[householdId,caseId])).rows;
 const routine_reports=(await db.query('select tr.id,tr.reporter_id,tr.report,tr.corrected_report,tr.performed_at,tr.note,tr.supersedes_id,tr.created_at,r.pet_id,r.kind,t.due_at from task_reports tr join task_occurrences t on t.id=tr.task_occurrence_id and t.household_id=tr.household_id join routine_rules r on r.id=t.routine_rule_id and r.household_id=t.household_id where tr.household_id=$1 and r.pet_id=any($2::uuid[]) order by tr.created_at,tr.id',[householdId,pets.map(p=>p.id)])).rows;
 const sourceIds=[...observations,...plans,...planSteps,...sessions,...handovers,...routine_reports].map(r=>r.id).sort();
 const body={schema_version:'1',as_of:new Date().toISOString(),household_id:householdId,case:c,participants:pets,observations,plan_history:planHistory,sessions,handovers,routine_reports,unanswered_questions:c.intake?.unknowns??[],source_labels:{observations:'Attributed reports; drafts are unconfirmed. Corrections do not erase earlier reports.',routine_reports:'Caregiver reports; completion does not establish eating, treatment or physical action.',plans:'Recorded revision inputs and step states at preview time. Changed input fields compare stored values with the previous revision; they do not explain the cause or reconstruct past step states. Demo-only review is not professional approval.'},safety_epoch:h.safety_epoch,physical_state_verified:false,diagnosis_generated:false};
 return {body,scope:{case_id:caseId,pet_ids:pets.map(p=>p.id).sort(),source_ids:sourceIds},h};
}
/** Read-only scoped MCP helper: returns no stored preview, authorization, grant or export. */
export async function draftPrivateSummary(actor:Actor,householdId:string,caseId:string){return transaction(async db=>{const s=await snapshot(db,actor,householdId,caseId);return {body:s.body,source_ids:s.scope.source_ids,as_of:s.body.as_of,safety_epoch:s.h.safety_epoch,support_level:s.body.case.support_level,private_draft_only:true,can_send:false};});}
async function recipient(db:pg.PoolClient,address:string){
 const user=(await db.query("select u.id,lower(u.email) email from auth.users u join profiles p on p.id=u.id where lower(u.email)=lower($1) and u.email_confirmed_at is not null and p.status='active' and (u.banned_until is null or u.banned_until<now())",[address])).rows[0];
 if(!user)throw new DomainError('VERIFIED_RECIPIENT_REQUIRED',400);return user;
}
function canonical(v:any):any{return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;}
function binding(s:any){return {owner_id:s.created_by,summary_id:s.id,digest:s.digest,purpose:s.purpose,format:s.format,recipient_address:s.recipient_address,recipient_id:s.recipient_id,scope:s.scope,expires_at:iso(s.expires_at)};}
export async function previewPrivateRecord(actor:Actor,raw:unknown,key:string){
 const i=recordPreviewInput.parse(raw);
 return ownerWrite(actor,i.household_id,i,key,{operation:'private_record_preview',...i},async(db,h)=>{
  await access(db,actor,i.household_id,true);
  const expires=new Date(i.expires_at);if(expires<=new Date()||expires.getTime()>Date.now()+72*3600000)throw new DomainError('INVALID_EXPIRY',400);
  if((i.purpose==='share')!==(i.recipient_address!==null))throw new DomainError('DESTINATION_REQUIRED',400);
  const r=i.recipient_address?await recipient(db,i.recipient_address):null;
  const s=await snapshot(db,actor,i.household_id,i.case_id),id=randomUUID(),content=renderPrivateSummary(s.body,i.format),contentDigest=byteDigest(content);
  await db.query('insert into professional_summaries(id,household_id,case_id,created_by,body,source_event_ids,scope,digest,content_text,format,purpose,recipient_address,recipient_id,expires_at,state_version,safety_epoch) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[id,i.household_id,i.case_id,actor.userId,JSON.stringify(s.body),s.scope.source_ids,JSON.stringify(s.scope),contentDigest,content,i.format,i.purpose,r?.email??null,r?.id??null,expires,h.state_version+1,h.safety_epoch]);
  return {summary_id:id,digest:contentDigest,content,body:s.body,scope:s.scope,purpose:i.purpose,format:i.format,recipient_address:r?.email??null,expires_at:expires.toISOString(),retention_notice:retentionNotice};
 });
}
export async function authorizePrivateRecord(actor:Actor,raw:unknown,key:string){
 const i=recordAuthorizeInput.parse(raw);
 return ownerWrite(actor,i.household_id,i,key,{operation:'private_record_authorized',...i},async(db,h)=>{
  await access(db,actor,i.household_id,true);await freshAuth(db,actor);
  const s=(await db.query('select * from professional_summaries where household_id=$1 and id=$2 for update',[i.household_id,i.summary_id])).rows[0];
  if(!s||s.created_by!==actor.userId)throw new DomainError('SCOPE_MISMATCH',403);
  if(s.state_version!==h.state_version||s.safety_epoch!==h.safety_epoch)throw new DomainError('STALE_STATE');
  const currentProtocols=(await db.query('select p.id,p.status,v.status protocol_status,v.digest protocol_digest,v.revoked_at,v.review_due_at from plan_revisions p join protocol_versions v on v.id=p.protocol_version_id where p.household_id=$1 and p.case_id=$2 order by p.revision_number',[i.household_id,s.case_id])).rows;
  const protocolBinding=(rows:any[])=>rows.map(p=>({id:p.id,status:p.status,protocol_status:p.protocol_status,protocol_digest:p.protocol_digest,revoked_at:p.revoked_at?iso(p.revoked_at):null,review_due_at:p.review_due_at?iso(p.review_due_at):null}));
  if(digest(protocolBinding(currentProtocols))!==digest(protocolBinding(s.body.plan_history)))throw new DomainError('STALE_STATE');
  if(new Date(s.expires_at)<=new Date()||new Date(s.created_at).getTime()<Date.now()-10*60000)throw new DomainError('PREVIEW_EXPIRED');
  const candidate={...binding(s),owner_id:actor.userId,digest:i.reviewed_digest,purpose:i.purpose,format:i.format,recipient_address:i.recipient_address,scope:i.scope,expires_at:iso(i.expires_at)};
  if(digest(canonical(candidate))!==digest(canonical(binding(s))))throw new DomainError('AUTHORIZATION_MISMATCH');
  if(s.recipient_address){const r=await recipient(db,s.recipient_address);if(r.id!==s.recipient_id)throw new DomainError('AUTHORIZATION_MISMATCH');}
  if((await db.query('select 1 from action_authorizations where household_id=$1 and summary_id=$2',[i.household_id,s.id])).rowCount)throw new DomainError('AUTHORIZATION_CONSUMED');
  const authorizationId=randomUUID(),id=randomUUID();
  await db.query('insert into action_authorizations(id,household_id,summary_id,owner_id,action_kind,payload_digest,expires_at,consumed_at,idempotency_key) values($1,$2,$3,$4,$5,$6,now()+interval \'10 minutes\',now(),$7)',[authorizationId,i.household_id,s.id,actor.userId,s.purpose,digest(canonical(binding(s))),key]);
  if(s.purpose==='export')await db.query('insert into private_exports(id,household_id,summary_id,authorization_id,owner_id,mime_type,content_text,digest,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,i.household_id,s.id,authorizationId,actor.userId,s.format==='html'?'text/html':'text/plain',s.content_text,s.digest,s.expires_at]);
  else await db.query('insert into share_grants(id,household_id,summary_id,authorization_id,recipient_id,recipient_address,scope,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8)',[id,i.household_id,s.id,authorizationId,s.recipient_id,s.recipient_address,JSON.stringify(s.scope),s.expires_at]);
  return {authorization_id:authorizationId,...(s.purpose==='export'?{export_id:id}:{grant_id:id}),expires_at:iso(s.expires_at),externally_sent:false,notice:'Access is private. A downloaded copy cannot be remotely recalled.'};
 });
}
export async function listPrivateRecords(actor:Actor,householdId:string){return transaction(async db=>{const {h}=await access(db,actor,householdId,true);return {household_id:householdId,state_version:h.state_version,safety_epoch:h.safety_epoch,summaries:(await db.query('select id,case_id,digest,purpose,format,recipient_address,expires_at,created_at from professional_summaries where household_id=$1 order by created_at desc',[householdId])).rows,exports:(await db.query('select id,summary_id,mime_type,expires_at from private_exports where household_id=$1',[householdId])).rows,grants:(await db.query('select id,summary_id,recipient_address,expires_at,revoked_at from share_grants where household_id=$1',[householdId])).rows,retention_notice:retentionNotice};});}
export async function downloadPrivateExport(actor:Actor,exportId:string){return transaction(async db=>{await assertSession(db,actor);const e=(await db.query('select * from private_exports where id=$1',[exportId])).rows[0];if(!e)throw new DomainError('SCOPE_MISMATCH',403);const {h}=await access(db,actor,e.household_id,true);if(e.owner_id!==actor.userId)throw new DomainError('FORBIDDEN',403);if(new Date(e.expires_at)<=new Date())throw new DomainError('EXPORT_EXPIRED',410);return {content:e.content_text,mime_type:e.mime_type,digest:e.digest,filename:`denlumi-private-${e.id}.${e.mime_type==='text/html'?'html':'txt'}`,current_safety_epoch:h.safety_epoch,historical_snapshot:true};});}
export async function viewSharedRecord(actor:Actor,grantId:string){return transaction(async db=>{
 await freshAuth(db,actor,30);
 const g=(await db.query('select g.*,h.status household_status,h.expires_at household_expiry from share_grants g join households h on h.id=g.household_id where g.id=$1 for share of g,h',[grantId])).rows[0];
 if(!g||g.recipient_id!==actor.userId||g.household_status!=='active'||(g.household_expiry&&new Date(g.household_expiry)<=new Date()))throw new DomainError('SCOPE_MISMATCH',403);
 if(g.revoked_at||new Date(g.expires_at)<=new Date())throw new DomainError('SHARE_UNAVAILABLE',410);
 const r=await recipient(db,g.recipient_address);if(r.id!==actor.userId)throw new DomainError('SCOPE_MISMATCH',403);
 await db.query('insert into private.record_view_sessions(grant_id,session_id,expires_at) values($1,$2,least($3,now()+interval \'30 minutes\')) on conflict do nothing',[g.id,actor.sessionId,g.expires_at]);
 if(!(await db.query('select 1 from private.record_view_sessions where grant_id=$1 and session_id=$2 and expires_at>now()',[g.id,actor.sessionId])).rowCount)throw new DomainError('FRESH_AUTH_REQUIRED',401);
 const s=(await db.query('select * from professional_summaries where id=$1 and household_id=$2',[g.summary_id,g.household_id])).rows[0];
 return {content:s.content_text,mime_type:s.format==='html'?'text/html':'text/plain',digest:s.digest,scope:g.scope,historical_snapshot:true,notice:'Private factual snapshot, not a diagnosis. Downloaded copies cannot be recalled.'};
});}
export async function revokePrivateShare(actor:Actor,raw:unknown,key:string){const i=revokeShareInput.parse(raw);return ownerWrite(actor,i.household_id,i,key,{operation:'private_share_revoked',...i},async db=>{await access(db,actor,i.household_id,true);const g=(await db.query('select * from share_grants where household_id=$1 and id=$2',[i.household_id,i.grant_id])).rows[0];if(!g)throw new DomainError('SCOPE_MISMATCH',403);if(!g.revoked_at)await db.query('update share_grants set revoked_at=now() where id=$1',[g.id]);return {grant_id:g.id,revoked:true,downloaded_copies_recalled:false};});}
export async function archivePrivatePet(actor:Actor,raw:unknown,key:string){const i=archivePetInput.parse(raw);return ownerWrite(actor,i.household_id,i,key,{operation:'pet_archived',...i},async(db,h)=>{
 await access(db,actor,i.household_id,true);
 const p=(await db.query('select * from pets where household_id=$1 and id=$2 for update',[i.household_id,i.pet_id])).rows[0];if(!p||p.version!==i.expected_pet_version||p.archived_at)throw new DomainError('STALE_STATE');
 await db.query('update pets set archived_at=now(),version=version+1 where id=$1',[p.id]);
 await db.query("update routine_rules set status='archived',version=version+1,updated_at=now() where household_id=$1 and pet_id=$2 and status<>'archived'",[i.household_id,p.id]);
 await db.query("update task_occurrences t set state='canceled' where t.household_id=$1 and t.state in ('planned','claimed') and (t.routine_rule_id in (select id from routine_rules where household_id=$1 and pet_id=$2) or t.plan_step_id is not null) and not exists(select 1 from task_reports tr where tr.task_occurrence_id=t.id)",[i.household_id,p.id]);
 await db.query("update sessions set state='canceled',ended_at=now(),interruption_reason='household_pet_archived' where household_id=$1 and state in ('preflight','active','paused','interrupted')",[i.household_id]);
 await db.query("update plan_steps set status='canceled' where household_id=$1 and status not in ('completed','canceled')",[i.household_id]);
 await invalidate(db,h,actor,'A pet was archived. Original attributed history remains. Dependent guidance needs fresh review; no physical state is verified.');
 return {pet_id:p.id,archived:true,history_preserved:true};
});}

function deletionResult(r:any){return {request_id:r.id,household_id:r.household_id,status:r.status,primary_cleanup_verified:r.primary_cleanup_verified,last_error_code:r.last_error_code,retention_notice:retentionNotice,account_identity_deleted:false};}
/** A possession credential for deletion of one expired, consented fictional sample only. */
export async function recoverExpiredDemoDeletion(code:string){
 assertLocalDeletion();
 const match=/^d1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/.exec(code);
 if(!match)throw new DomainError('RECOVERY_UNAVAILABLE',403);
 const householdId=match[1],actual=Buffer.from(createHash('sha256').update(code).digest('hex'),'hex');
 const requestId=await transaction(async db=>{
  await db.query('select pg_advisory_xact_lock(hashtext($1))',[`delete:${householdId}`]);
  const first=(await db.query('select * from private.demo_deletion_codes where household_id=$1',[householdId])).rows[0];
  if(!first||!timingSafeEqual(actual,Buffer.from(first.code_hash,'hex'))||new Date(first.expires_at)<=new Date())throw new DomainError('RECOVERY_UNAVAILABLE',403);
  // Deletion jobs lock request, household, then code. Keep that order on retry.
  const prior=first.request_id?(await db.query('select * from private.deletion_requests where id=$1 for update',[first.request_id])).rows[0]:null;
  const h=(await db.query('select * from households where id=$1 for update',[householdId])).rows[0];
  const credential=(await db.query('select * from private.demo_deletion_codes where household_id=$1 for update',[householdId])).rows[0];
  if(!credential||!timingSafeEqual(actual,Buffer.from(credential.code_hash,'hex'))||new Date(credential.expires_at)<=new Date()||
   !h||h.owner_id!==credential.owner_id||h.mode!=='demo'||!h.fictional||!h.demo_retention_acknowledged_at||
   !h.expires_at||new Date(h.expires_at)>new Date()||!h.demo_purge_at||new Date(h.demo_purge_at)<=new Date())throw new DomainError('RECOVERY_UNAVAILABLE',403);
  if(prior){if(h.status!=='deleting'||prior.household_id!==householdId||prior.owner_id!==h.owner_id)throw new DomainError('RECOVERY_UNAVAILABLE',403);return prior.id as string;}
  if(h.status!=='active'||credential.request_id)throw new DomainError('RECOVERY_UNAVAILABLE',403);
  const created=(await db.query('insert into private.deletion_requests(household_id,owner_id,idempotency_key,body_hash) values($1,$2,$3,$4) returning id',
   [householdId,h.owner_id,randomUUID(),digest({operation:'demo_code_deletion',householdId})])).rows[0];
  await disableHouseholdForDeletion(db,householdId);
  await db.query('update private.demo_deletion_codes set request_id=$2,redeemed_at=now() where household_id=$1',[householdId,created.id]);
  return created.id as string;
 });
 return processDeletionJob(requestId);
}
/** Minimal owner-only deletion metadata for an expired fictional demo. This does not reopen household reads. */
export async function prepareExpiredDemoDeletion(actor:Actor,householdId:string){return transaction(async db=>{
 await assertSession(db,actor);
 const h=(await db.query("select id,owner_id,mode,fictional,status,expires_at,state_version,safety_epoch from households where id=$1",[householdId])).rows[0];
 const m=(await db.query('select role,pet_scope,case_scope from memberships where household_id=$1 and profile_id=$2 and accepted_at is not null and revoked_at is null and (expires_at is null or expires_at>now())',[householdId,actor.userId])).rows[0];
 if(!h||h.mode!=='demo'||!h.fictional||h.status!=='active'||!h.expires_at||new Date(h.expires_at)>new Date()||h.owner_id!==actor.userId||!m||m.role!=='owner'||m.pet_scope!==null||m.case_scope!==null)throw new DomainError('SCOPE_MISMATCH',403);
 return {household_id:h.id,expected_state_version:h.state_version,expected_safety_epoch:h.safety_epoch,expired:true,deletion_only:true};
});}
function assertLocalDeletion(){const url=new URL(process.env.DATABASE_URL!);if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55432')throw new DomainError('LOCAL_DELETION_ONLY',403);}
async function disableHouseholdForDeletion(db:pg.PoolClient,householdId:string){
 await db.query("update households set status='deleting',state_version=state_version+1,safety_epoch=safety_epoch+1 where id=$1",[householdId]);
 await db.query('update memberships set revoked_at=coalesce(revoked_at,now()) where household_id=$1',[householdId]);
 await db.query('update share_grants set revoked_at=now() where household_id=$1 and revoked_at is null',[householdId]);
 await db.query("update outbox_events set state='canceled' where household_id=$1 and state in ('pending','processing')",[householdId]);
 await db.query("update sessions set state='canceled',ended_at=now(),interruption_reason='household_deletion' where household_id=$1 and state in ('preflight','active','paused','interrupted')",[householdId]);
}
export async function requestHouseholdDeletion(actor:Actor,raw:unknown,key:string){const i=deletionInput.parse(raw);keyCheck(key);return transaction(async db=>{
 await freshAuth(db,actor);await db.query('select pg_advisory_xact_lock(hashtext($1))',[`delete:${i.household_id}`]);
 const prior=(await db.query('select * from private.deletion_requests where owner_id=$1 and idempotency_key=$2',[actor.userId,key])).rows[0];if(prior){if(prior.body_hash!==digest(i))throw new DomainError('IDEMPOTENCY_MISMATCH');return deletionResult(prior);}
 const h=(await db.query('select * from households where id=$1 for update',[i.household_id])).rows[0];await access(db,actor,i.household_id,true,true);
 if(h.state_version!==i.expected_state_version||h.safety_epoch!==i.expected_safety_epoch)throw new DomainError('STALE_STATE');
 const r=(await db.query('insert into private.deletion_requests(household_id,owner_id,idempotency_key,body_hash) values($1,$2,$3,$4) returning *',[h.id,actor.userId,key,digest(i)])).rows[0];
 await disableHouseholdForDeletion(db,h.id);
 return deletionResult(r);
});}
export async function householdDeletionStatus(actor:Actor,requestId:string){return transaction(async db=>{await assertSession(db,actor);const r=(await db.query('select * from private.deletion_requests where id=$1 and owner_id=$2',[requestId,actor.userId])).rows[0];if(!r)throw new DomainError('SCOPE_MISMATCH',403);return deletionResult(r);});}
const cleanupTables=['private.demo_deletion_codes','private.record_view_sessions','public.share_grants','public.private_exports','public.action_authorizations','public.professional_summaries','public.deliveries','public.task_reports','public.task_claims','public.task_occurrences','public.routine_rules','public.handover_acks','public.handovers','public.safety_holds','public.observations','public.session_pets','public.sessions','public.plan_reviews','public.plan_steps','public.plan_revisions','public.pet_resource_access','public.resources','public.home_zones','public.home_responsibilities','public.pair_contexts','public.pet_pairs','private.membership_pet_scopes','private.membership_case_scopes','public.case_pets','public.cases','public.pets','public.audit_events','public.outbox_events','private.idempotency','private.provider_calls','private.household_creations','public.memberships','public.households'] as const;
async function processDeletionJob(requestId:string){
 const selected=await transaction(async db=>{const r=(await db.query('select * from private.deletion_requests where id=$1 for update',[requestId])).rows[0];if(!r)throw new DomainError('SCOPE_MISMATCH',403);if(r.status==='completed'||(r.status==='processing'&&new Date(r.processing_at).getTime()>Date.now()-120000))return {run:false,r};await db.query("update private.deletion_requests set status='processing',processing_at=now(),attempts=attempts+1,last_error_code=null where id=$1",[r.id]);return {run:true,r};});
 if(!selected.run)return deletionResult(selected.r);
 try{return await transaction(async db=>{
  const r=(await db.query('select * from private.deletion_requests where id=$1 for update',[requestId])).rows[0];
  const h=(await db.query('select * from households where id=$1 for update',[r.household_id])).rows[0];if(!h||h.status!=='deleting')throw new DomainError('DELETION_STATE_INVALID');
  const tenantTables=(await db.query("select table_schema||'.'||table_name name from information_schema.columns where column_name='household_id' and table_schema in ('public','private') and table_name<>'deletion_requests' order by table_schema,table_name")).rows.map(x=>x.name);
  if(tenantTables.some(name=>!(cleanupTables as readonly string[]).includes(name)))throw new DomainError('CLEANUP_SCHEMA_CHANGED');
  await db.query("select set_config('denlumi.deleting_household',$1,true)",[h.id]);
  for(const table of cleanupTables){
   if(table==='private.record_view_sessions')await db.query('delete from private.record_view_sessions where grant_id in (select id from share_grants where household_id=$1)',[h.id]);
   else await db.query(`delete from ${table} where ${table==='public.households'?'id':'household_id'}=$1`,[h.id]);
  }
  for(const table of tenantTables){if((await db.query(`select 1 from ${table} where household_id=$1 limit 1`,[h.id])).rowCount)throw new DomainError('CLEANUP_NOT_VERIFIED');}
  if((await db.query('select 1 from households where id=$1',[h.id])).rowCount)throw new DomainError('CLEANUP_NOT_VERIFIED');
  await db.query('set constraints all immediate');
  const done=(await db.query("update private.deletion_requests set status='completed',primary_cleanup_verified=true,completed_at=now(),last_error_code=null where id=$1 returning *",[r.id])).rows[0];return deletionResult(done);
 });}catch(e){return transaction(async db=>{const failed=(await db.query("update private.deletion_requests set status='failed',primary_cleanup_verified=false,last_error_code=$2 where id=$1 returning *",[requestId,e instanceof DomainError?e.code:'PRIMARY_CLEANUP_FAILED'])).rows[0];return deletionResult(failed);});}
}
export async function processHouseholdDeletion(actor:Actor,requestId:string){
 assertLocalDeletion();
 await transaction(async db=>{await freshAuth(db,actor);if(!(await db.query('select 1 from private.deletion_requests where id=$1 and owner_id=$2',[requestId,actor.userId])).rowCount)throw new DomainError('SCOPE_MISMATCH',403);});
 return processDeletionJob(requestId);
}
/** Privileged one-shot local worker entry. It never selects unconsented, live or young households. */
export async function cleanupDueDemoHousehold(householdId:string){
 assertLocalDeletion();
 if(!/^[a-f0-9-]{36}$/i.test(householdId))throw new DomainError('INVALID_INPUT',400);
 const queued=await transaction(async db=>{
  const h=(await db.query('select * from households where id=$1 for update',[householdId])).rows[0];
  if(!h||h.mode!=='demo'||!h.fictional||!['active','deleting'].includes(h.status)||!h.demo_retention_acknowledged_at||!h.demo_purge_at||new Date(h.expires_at)>new Date()||new Date(h.demo_purge_at)>new Date()||new Date(h.created_at).getTime()>Date.now()-7*86400000)return null;
  if(h.status==='deleting'){
   const prior=(await db.query('select id from private.deletion_requests where household_id=$1 and idempotency_key=$2',[h.id,`demo-retention-${h.id}`])).rows[0];
   return prior?.id??null;
  }
  if((await db.query('select 1 from private.deletion_requests where household_id=$1',[h.id])).rowCount)return null;
  const key=`demo-retention-${h.id}`;
  const r=(await db.query('insert into private.deletion_requests(household_id,owner_id,idempotency_key,body_hash) values($1,$2,$3,$4) returning *',[h.id,h.owner_id,key,digest({operation:'demo_retention',household_id:h.id})])).rows[0];
  await disableHouseholdForDeletion(db,h.id);
  return r.id as string;
 });
 if(!queued)return {status:'not_due_or_not_consented',primary_cleanup_verified:false,last_error_code:null};
 return processDeletionJob(queued);
}
/** Bounded serial operator batch; IDs are explicit and every row is checked again under lock. */
export async function cleanupDueDemoHouseholds(householdIds:string[]){
 assertLocalDeletion();
 if(!Array.isArray(householdIds)||householdIds.length<1||householdIds.length>20||new Set(householdIds).size!==householdIds.length||householdIds.some(id=>!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)))throw new DomainError('INVALID_INPUT',400);
 const result={attempted:householdIds.length,completed:0,failed:0,skipped:0,processing:0};
 for(const id of householdIds){
  const item=await cleanupDueDemoHousehold(id);
  if(item.status==='completed')result.completed++;
  else if(item.status==='failed')result.failed++;
  else if(item.status==='processing')result.processing++;
  else result.skipped++;
 }
 return result;
}
