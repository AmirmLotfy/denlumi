import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readAs, transaction, assertSession, DomainError, type Actor } from './db';
import { digest } from '../content/fixtures';
import { stateInput, observationInput, pauseInput, confirmInput, type StateInput, type Brief } from '../contracts/phase0';

export async function listHouseholds(actor: Actor) {
 return readAs(actor, async db => (await db.query('select id,nickname,safety_epoch from households order by created_at desc')).rows);
}
export async function getBrief(actor: Actor, householdId: string, caseId?:string): Promise<Brief> {
 return readAs(actor, async db => {
  const h=(await db.query('select * from households where id=$1',[householdId])).rows[0];
  if(!h) throw new DomainError('SCOPE_MISMATCH',403);
  const c=(await db.query('select * from cases where household_id=$1 and ($2::uuid is null or id=$2) order by id limit 1',[householdId,caseId??null])).rows[0];
  if(!c) throw new DomainError('SCOPE_MISMATCH',403);
  const p=(await db.query('select p.*,v.slug,v.status protocol_status,v.pairing,v.source_ids,v.locale protocol_locale,v.revoked_at,v.review_due_at,v.digest current_protocol_digest from plan_revisions p join protocol_versions v on v.id=p.protocol_version_id where p.household_id=$1 and p.case_id=$2 order by revision_number desc limit 1',[householdId,c.id])).rows[0];
  if(!p) throw new DomainError('PROTOCOL_UNAVAILABLE');
  const m=(await db.query('select role from memberships where household_id=$1 and profile_id=$2',[householdId,actor.userId])).rows[0];
  const pets=(await db.query('select p.*,cp.role from pets p join case_pets cp on cp.pet_id=p.id and cp.household_id=p.household_id where cp.household_id=$1 and cp.case_id=$2 order by p.nickname',[householdId,c.id])).rows;
  const handovers=(await db.query('select id,body,safety_epoch,created_at from handovers where household_id=$1 and case_id=$2 order by safety_epoch desc,created_at desc limit 10',[householdId,c.id])).rows;
  const observations=(await db.query('select * from observations where household_id=$1 and case_id=$2 order by reported_at desc limit 15',[householdId,c.id])).rows;
  const holds=(await db.query("select policy_level,reason,reason_code from safety_holds where household_id=$1 and case_id=$2 and state='active' order by created_epoch desc",[householdId,c.id])).rows;
  const stale=p.safety_epoch!==h.safety_epoch||p.home_version!==h.home_version;
  const mapped=(await db.query('select 1 from protocol_scenarios where protocol_version_id=$1 and scenario_id=$2',[p.protocol_version_id,c.scenario_code])).rowCount;
  const reviewed=p.status==='reviewed'&&(await db.query('select 1 from plan_reviews where plan_revision_id=$1 and reviewed_digest=$2 and safety_epoch=$3 and invalidated_at is null and (expires_at is null or expires_at>now())',[p.id,p.digest,h.safety_epoch])).rowCount;
  // This is fictional display eligibility. Actual starts still perform their
  // own fresh authorization, handover acknowledgment and conflict checks.
  const guidanceAvailable=h.mode==='demo'&&h.fictional&&p.protocol_status==='demo_only'&&!p.revoked_at&&p.protocol_locale===h.locale&&(!p.review_due_at||new Date(p.review_due_at)>new Date())&&Boolean(mapped)&&p.protocol_digest===p.current_protocol_digest&&!stale&&!holds.length&&c.status==='active'&&c.support_level==='guided_preparation'&&!pets.some(pet=>pet.archived_at)&&(p.status==='demo_ready'||Boolean(reviewed));
  return {household_id:h.id,case_id:c.id,nickname:h.nickname,title:c.title,role:m.role,mode:h.mode,fictional:h.fictional,
   as_of:new Date().toISOString(),safety_epoch:h.safety_epoch,home_version:h.home_version,support_level:c.support_level,
   plan_revision_id:p.id,plan_status:p.status,current_step:p.current_step,protocol_version_id:p.protocol_version_id,
   protocol_slug:p.slug,protocol_status:p.protocol_status,pairing:p.pairing,source_ids:p.source_ids,
   guidance_available:guidanceAvailable,
   stale,physical_state_verified:false,pets,handovers,observations,holds};
 });
}
export async function caseHousehold(actor:Actor, caseId:string) {
 return readAs(actor,async db=>{
  const c=(await db.query('select household_id from cases where id=$1',[caseId])).rows[0];
  if(!c)throw new DomainError('SCOPE_MISMATCH',403); return c.household_id as string;
 });
}
async function current(db:pg.PoolClient,actor:Actor,input:StateInput,write:boolean) {
 await assertSession(db,actor);
 const c=(await db.query('select * from cases where id=$1',[input.case_id])).rows[0];
 if(!c)throw new DomainError('SCOPE_MISMATCH',403);
 const h=(await db.query('select * from households where id=$1 for update',[c.household_id])).rows[0];
 const m=(await db.query('select * from memberships where household_id=$1 and profile_id=$2 and revoked_at is null and (expires_at is null or expires_at>now()) for share',[h.id,actor.userId])).rows[0];
 if(!m||!m.accepted_at||h.status!=='active'||(h.expires_at&&new Date(h.expires_at)<=new Date()))throw new DomainError('SCOPE_MISMATCH',403);
 const pets=(await db.query('select pet_id from case_pets where case_id=$1',[c.id])).rows.map(r=>r.pet_id);
 if(!pets.length||(m.case_scope&&!m.case_scope.includes(c.id))||(m.pet_scope&&pets.some(id=>!m.pet_scope.includes(id))))throw new DomainError('SCOPE_MISMATCH',403);
 if(write&&m.role==='reader')throw new DomainError('FORBIDDEN',403);
 const p=(await db.query('select * from plan_revisions where household_id=$1 and case_id=$2 order by revision_number desc limit 1 for update',[h.id,c.id])).rows[0];
 const v=(await db.query('select * from protocol_versions where id=$1 for share',[p.protocol_version_id])).rows[0];
 return {h,c,m,p,v,pets};
}
function checkVersion(s:Awaited<ReturnType<typeof current>>,i:StateInput) {
 if(s.h.safety_epoch!==i.expected_safety_epoch||s.h.home_version!==i.home_version||s.p.id!==i.plan_revision_id||s.v.id!==i.protocol_version_id)throw new DomainError('STALE_STATE');
}
async function checkProtocol(db:pg.PoolClient,s:Awaited<ReturnType<typeof current>>) {
 const mapped=(await db.query('select 1 from protocol_scenarios where protocol_version_id=$1 and scenario_id=$2',[s.v.id,s.c.scenario_code])).rowCount;
 if(s.h.mode!=='demo'||!s.h.fictional||s.v.status!=='demo_only'||s.v.revoked_at||(s.v.review_due_at&&new Date(s.v.review_due_at)<=new Date())||s.v.locale!==s.h.locale||!mapped||(s.p.protocol_digest&&s.p.protocol_digest!==s.v.digest))throw new DomainError('PROTOCOL_UNAVAILABLE');
}
async function mutate(actor:Actor,i:StateInput,key:string,body:unknown,action:(db:pg.PoolClient,s:Awaited<ReturnType<typeof current>>)=>Promise<unknown>,requiresContent=true) {
 if(!/^[a-zA-Z0-9-]{16,100}$/.test(key))throw new DomainError('IDEMPOTENCY_KEY_REQUIRED',400);
 return transaction(async db=>{
  const s=await current(db,actor,i,true);
  // Authorization is checked before replay, so revoked members cannot recover cached data.
  const prior=(await db.query('select * from private.idempotency where household_id=$1 and actor_id=$2 and key=$3',[s.h.id,actor.userId,key])).rows[0];
  if(prior) { if(prior.body_hash!==digest(body))throw new DomainError('IDEMPOTENCY_MISMATCH'); return prior.result; }
  checkVersion(s,i);
  if(requiresContent)await checkProtocol(db,s); // Safety-decreasing stop remains allowed after content withdrawal.
  const result=await action(db,s);
  await db.query('insert into private.idempotency(household_id,actor_id,key,body_hash,result) values($1,$2,$3,$4,$5)',[s.h.id,actor.userId,key,digest(body),JSON.stringify(result)]);
  return result;
 });
}
async function pause(db:pg.PoolClient,s:Awaited<ReturnType<typeof current>>,actor:Actor,reason:string,observationId:string|null,level='clarification') {
 const epoch=s.h.safety_epoch+1;
 await db.query('update households set safety_epoch=$2 where id=$1',[s.h.id,epoch]);
 await db.query("update cases set status='paused',support_level=case when support_level in ('professional_required','urgent_help') then support_level else $2 end where household_id=$1",[s.h.id,level==='professional'?'professional_required':'clarification_required']);
 await db.query("update sessions set state='paused',interruption_reason='household_stop' where household_id=$1 and state in ('active','interrupted')",[s.h.id]);
 await db.query("update plan_steps set status='canceled' where household_id=$1 and status not in ('completed','canceled')",[s.h.id]);
 await db.query("update task_occurrences set state='canceled' where household_id=$1 and plan_step_id is not null and state not in ('reported_done','skipped','canceled')",[s.h.id]);
 await db.query("update plan_revisions set status='stale' where household_id=$1",[s.h.id]);
 await db.query('update plan_reviews set invalidated_at=coalesce(invalidated_at,now()) where household_id=$1',[s.h.id]);
 await db.query("update handovers set status='superseded' where household_id=$1 and status='published'",[s.h.id]);
 await db.query('insert into safety_holds(household_id,case_id,origin_observation_id,policy_level,reason,created_epoch) values($1,$2,$3,$4,$5,$6)',[s.h.id,s.c.id,observationId,level,reason,epoch]);
 await db.query("update outbox_events set state='canceled' where household_id=$1 and state in ('pending','processing') and expected_safety_epoch<$2",[s.h.id,epoch]);
 const body={schema_version:'1',summary:reason,physical_state_verified:false};
 await db.query("insert into handovers(household_id,case_id,safety_epoch,body,digest,status,published_at,actor_id,source_observation_id) values($1,$2,$3,$4,$5,'published',now(),$6,$7)",[s.h.id,s.c.id,epoch,JSON.stringify(body),digest(body),actor.userId,observationId]);
 await db.query("insert into outbox_events(household_id,event_type,expected_safety_epoch) values($1,'internal_handover',$2)",[s.h.id,epoch]);
 await db.query("insert into audit_events(household_id,actor_id,event_type,safety_epoch) values($1,$2,'guidance_paused',$3)",[s.h.id,actor.userId,epoch]);
 const effective=(await db.query('select support_level from cases where id=$1',[s.c.id])).rows[0].support_level;
 return {status:'guidance_paused',as_of:new Date().toISOString(),safety_epoch:epoch,support_level:effective,source_ids:s.v.source_ids,physical_state_verified:false};
}
export async function prepareSession(actor:Actor,raw:unknown) {
 const i=stateInput.parse(raw);
 return transaction(async db=>{
  const s=await current(db,actor,i,true);checkVersion(s,i);await checkProtocol(db,s);
  if(!['demo_ready','reviewed'].includes(s.p.status)||s.p.safety_epoch!==s.h.safety_epoch||(await db.query('select 1 from safety_holds where household_id=$1',[s.h.id])).rowCount)throw new DomainError('GUIDANCE_PAUSED');
  if(s.p.status==='reviewed'){
   const reviewed=(await db.query('select 1 from plan_reviews where plan_revision_id=$1 and reviewed_digest=$2 and safety_epoch=$3 and invalidated_at is null and (expires_at is null or expires_at>now())',[s.p.id,s.p.digest,s.h.safety_epoch])).rowCount;
   const acknowledged=(await db.query("select 1 from handovers h join handover_acks a on a.handover_id=h.id and a.household_id=h.household_id where h.plan_revision_id=$1 and h.status='published' and a.profile_id=$2 and a.acknowledged_digest=h.digest",[s.p.id,actor.userId])).rowCount;
   if(!reviewed||!acknowledged)throw new DomainError('HANDOVER_ACK_REQUIRED');
  }
  return {status:'demo_preflight_only',as_of:new Date().toISOString(),safety_epoch:s.h.safety_epoch,support_level:s.c.support_level,source_ids:s.v.source_ids,physical_state_verified:false,notice:'Fictional state check only. No session starts and no animal handling is authorized.'};
 });
}
export async function recordObservation(actor:Actor,raw:unknown,key:string) {
 const i=observationInput.parse(raw);
 if(i.target_pet_id===i.actor_pet_id&&i.actor_pet_id)throw new DomainError('INVALID_DIRECTION',400);
 return mutate(actor,i,key,{operation:'observation',...i},async(db,s)=>{
  for(const id of [i.actor_pet_id,i.target_pet_id])if(id&&!s.pets.includes(id))throw new DomainError('SCOPE_MISMATCH',403);
  const id=randomUUID(),hash=digest(i);
  await db.query('insert into observations(id,household_id,case_id,reporter_id,raw_report,actor_pet_id,target_pet_id,assertion,source_kind,observed_at,digest) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,s.h.id,s.c.id,actor.userId,i.raw_report,i.actor_pet_id,i.target_pet_id,i.assertion,i.source_kind,i.observed_at,hash]);
  const paused=await pause(db,s,actor,'A fictional report awaits human confirmation. Software guidance is paused for clarification.',id);
  return {...paused,observation_id:id,digest:hash,observation_status:'draft'};
 });
}
// Only the authenticated human HTTP route calls this. It is absent from MCP/tools/list.
export async function confirmObservation(actor:Actor,raw:unknown,key:string) {
 const i=confirmInput.parse(raw);
 return mutate(actor,i,key,{operation:'confirm',...i},async(db,s)=>{
  const o=(await db.query('select * from observations where id=$1 and household_id=$2 and case_id=$3 for update',[i.observation_id,s.h.id,s.c.id])).rows[0];
  if(!o||o.reporter_id!==actor.userId)throw new DomainError('SCOPE_MISMATCH',403);
  if(o.digest!==i.digest||o.status!=='draft')throw new DomainError('DRAFT_CHANGED');
  if(!o.actor_pet_id)throw new DomainError('CLARIFICATION_REQUIRED');
  await db.query("update observations set status='confirmed',confirmed_at=now() where id=$1",[o.id]);
  return pause(db,s,actor,`A caregiver confirmed the fictional report (${o.assertion}). Guidance remains paused; no professional assessment is recorded.`,o.id,o.assertion==='affirmed'?'professional':'clarification');
 });
}
export async function pauseGuidance(actor:Actor,raw:unknown,key:string) {
 const i=pauseInput.parse(raw);
 return mutate(actor,i,key,{operation:'pause',...i},(db,s)=>pause(db,s,actor,'A caregiver stopped software guidance. Review the household update before any future guidance.',null),false);
}
