import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { digest } from '../content/fixtures';
import { handoverAckInput, homeInput, intakeInput, membershipAcceptInput, planDraftInput, planReviewInput } from '../contracts/phase23';
import { assertSession, DomainError, readAs, transaction, type Actor } from './db';
import { invalidate, ownerWrite } from './household';

const keyCheck=(key:string)=>{if(!/^[a-zA-Z0-9-]{16,100}$/.test(key))throw new DomainError('IDEMPOTENCY_KEY_REQUIRED',400);};
const sorted=(v:string[])=>[...v].sort();

async function scopedCase(db:pg.PoolClient,actor:Actor,caseId:string,lock=false) {
 const c=(await db.query(`select * from cases where id=$1 ${lock?'for update':''}`,[caseId])).rows[0];
 if(!c)throw new DomainError('SCOPE_MISMATCH',403);
 const h=(await db.query(`select * from households where id=$1 ${lock?'for update':''}`,[c.household_id])).rows[0];
 const m=(await db.query('select * from memberships where household_id=$1 and profile_id=$2 and revoked_at is null and (expires_at is null or expires_at>now())',[h.id,actor.userId])).rows[0];
 if(!m||h.status!=='active'||(h.expires_at&&new Date(h.expires_at)<=new Date()))throw new DomainError('SCOPE_MISMATCH',403);
 const participants=(await db.query('select cp.pet_id,cp.role,p.species,p.nickname from case_pets cp join pets p on p.id=cp.pet_id and p.household_id=cp.household_id where cp.case_id=$1 order by cp.pet_id',[caseId])).rows;
 if(m.case_scope&&!m.case_scope.includes(caseId))throw new DomainError('SCOPE_MISMATCH',403);
 if(m.pet_scope&&participants.some(p=>!m.pet_scope.includes(p.pet_id)))throw new DomainError('SCOPE_MISMATCH',403);
 return {c,h,m,participants};
}

function validateScenario(code:string,participants:any[]) {
 const species=sorted(participants.map(p=>p.species));
 // Fixtures illustrate a route; they do not define every eligible household.
 // Introduction sessions stay pair-specific. Broader situations only route to
 // coordination/clarification/help and never inherit a pair's practical module.
 const pairings:Record<string,string[]>={SC01:['cat'],SC02:['dog'],SC03:['cat','cat'],SC04:['dog','dog'],SC05:['cat','dog'],SC06:['cat','dog']};
 const expected=pairings[code];
 const minimum=code==='SC07'?3:code==='SC08'?2:1;
 if(!/^SC(0[1-9]|1[0-7])$/.test(code)||species.some(s=>!['cat','dog'].includes(s))||species.length<minimum||species.length>6||expected&&JSON.stringify(species)!==JSON.stringify(expected))throw new DomainError('SCENARIO_PARTICIPANT_MISMATCH',409);
 const newcomer=participants.find(p=>p.role==='newcomer');
 if(code==='SC05'&&newcomer?.species!=='cat')throw new DomainError('NEWCOMER_DIRECTION_MISMATCH',409);
 if(code==='SC06'&&newcomer?.species!=='dog')throw new DomainError('NEWCOMER_DIRECTION_MISMATCH',409);
 if(['SC01','SC02','SC03','SC04','SC05','SC06'].includes(code)&&!newcomer)throw new DomainError('NEWCOMER_REQUIRED',409);
}

export async function routeCase(actor:Actor,caseId:string,raw:unknown,key:string) {
 const i=intakeInput.parse(raw); keyCheck(key);
 const initial=await readAs(actor,db=>db.query('select household_id from cases where id=$1',[caseId]).then(r=>r.rows[0]));
 if(!initial)throw new DomainError('SCOPE_MISMATCH',403);
 return ownerWrite(actor,initial.household_id,i,key,{operation:'case_routed',case_id:caseId,...i},async(db,h)=>{
  const s=await scopedCase(db,actor,caseId,true); validateScenario(s.c.scenario_code,s.participants);
  const definition=(await db.query('select * from scenario_definitions where id=$1',[s.c.scenario_code])).rows[0];
  let level=definition.expected_demo_route,reason='SCENARIO_DEFAULT';
  if(i.answers.urgent===true){level='urgent_help';reason='REPORTED_URGENT_CONCERN';}
  else if(i.answers.professional_concern===true){level='professional_required';reason='REPORTED_PROFESSIONAL_CONCERN';}
  else if(i.unknowns.length||i.answers.needs_clarification===true){level='clarification_required';reason='INTAKE_UNKNOWNS';}
  await db.query('update cases set intake=$2,intake_schema_version=$3,support_level=$4,support_reason_code=$5,routed_at=now() where id=$1',[caseId,JSON.stringify({schema_version:'1',answers:i.answers,unknowns:i.unknowns}),i.intake_schema_version,level,reason]);
  await invalidate(db,h,actor,'Case intake changed. Plans and handovers require fresh owner review. No physical state is verified.');
  return {case_id:caseId,scenario_code:s.c.scenario_code,support_level:level,support_reason_code:reason,demo_protocol_slug:definition.demo_protocol_slug,unknowns:i.unknowns,physical_state_verified:false};
 });
}

export async function caseContext(actor:Actor,caseId:string) {
 return readAs(actor,async db=>{
  const s=await scopedCase(db,actor,caseId);
  const d=(await db.query('select * from scenario_definitions where id=$1',[s.c.scenario_code])).rows[0];
  const versions=(await db.query(`select v.id,v.slug,v.digest,v.status,v.locale,v.pairing,v.newcomer_species,v.review_due_at,v.revoked_at,
   case when h.mode='demo' then v.status='demo_only' and h.fictional else v.status='approved' end mode_ok,
   exists(select 1 from protocol_scenarios ps where ps.protocol_version_id=v.id and ps.scenario_id=c.scenario_code) scenario_ok
   from cases c join households h on h.id=c.household_id join protocol_versions v on v.slug=$2 where c.id=$1`,[caseId,d.demo_protocol_slug])).rows;
  return {household:{id:s.h.id,mode:s.h.mode,fictional:s.h.fictional,safety_epoch:s.h.safety_epoch,home_version:s.h.home_version},case:s.c,participants:s.participants,scenario:d,protocol_candidates:versions.map(v=>({...v,eligible:Boolean(v.mode_ok&&v.scenario_ok&&v.locale===s.h.locale&&!v.revoked_at&&(!v.review_due_at||new Date(v.review_due_at)>new Date()))})),as_of:new Date().toISOString(),physical_state_verified:false};
 });
}

export async function replaceHomePlan(actor:Actor,householdId:string,raw:unknown,key:string) {
 const i=homeInput.parse(raw);
 return ownerWrite(actor,householdId,i,key,{operation:'home_plan_replaced',...i},async(db,h)=>{
  const version=h.home_version+1,petIds=[...new Set(i.zones.flatMap(z=>z.resources.flatMap(r=>r.pet_access.map(a=>a.pet_id))).concat(i.responsibilities.flatMap(r=>r.pet_id?[r.pet_id]:[])))];
  if(petIds.length&&(await db.query('select id from pets where household_id=$1 and id=any($2::uuid[])',[householdId,petIds])).rowCount!==petIds.length)throw new DomainError('SCOPE_MISMATCH',403);
  for(const responsibility of i.responsibilities){
   const m=(await db.query(`select m.* from memberships m join profiles p on p.id=m.profile_id
    where m.household_id=$1 and m.profile_id=$2 and m.accepted_at is not null
    and m.revoked_at is null and (m.expires_at is null or m.expires_at>now())
    and p.status='active' and m.role<>'reader' for share of m,p`,[householdId,responsibility.profile_id])).rows[0];
   if(!m||(m.pet_scope&&(responsibility.pet_id===null||!m.pet_scope.includes(responsibility.pet_id))))throw new DomainError('SCOPE_MISMATCH',403);
   if(m.case_scope&&(responsibility.pet_id===null||!(await db.query('select 1 from case_pets where household_id=$1 and pet_id=$2 and case_id=any($3::uuid[])',[householdId,responsibility.pet_id,m.case_scope])).rowCount))throw new DomainError('SCOPE_MISMATCH',403);
  }
  for(const z of i.zones){const zone=(await db.query('insert into home_zones(household_id,label,home_version,arrangement_note,reported_by,reported_at) values($1,$2,$3,$4,$5,now()) returning id',[householdId,z.label,version,z.arrangement_note,actor.userId])).rows[0];for(const r of z.resources){const resource=(await db.query('insert into resources(household_id,zone_id,kind,label,status) values($1,$2,$3,$4,$5) returning id',[householdId,zone.id,r.kind,r.label,r.status])).rows[0];for(const a of r.pet_access)await db.query('insert into pet_resource_access(household_id,pet_id,resource_id,access_plan,version) values($1,$2,$3,$4,$5)',[householdId,a.pet_id,resource.id,a.access_plan,version]);}}
  for(const r of i.responsibilities)await db.query('insert into home_responsibilities(household_id,home_version,profile_id,pet_id,label,status,note) values($1,$2,$3,$4,$5,$6,$7)',[householdId,version,r.profile_id,r.pet_id,r.label,r.status,r.note]);
  await db.query('update households set home_version=$2 where id=$1',[householdId,version]);
  await invalidate(db,{...h,safety_epoch:h.safety_epoch},actor,'Home arrangement records changed. Plans and handovers require fresh owner review. No physical state is verified.');
  return {household_id:householdId,home_version:version,zone_count:i.zones.length,resource_count:i.zones.reduce((n,z)=>n+z.resources.length,0)};
 });
}

export async function planningWorkspace(actor:Actor,householdId:string) {
 return readAs(actor,async db=>{
  if(!(await db.query('select 1 from households where id=$1',[householdId])).rowCount)throw new DomainError('SCOPE_MISMATCH',403);
  const h=await db.query('select id,nickname,home_version,safety_epoch,state_version from households where id=$1',[householdId]);
  const z=await db.query('select * from home_zones where household_id=$1 order by home_version,label',[householdId]);
  const r=await db.query('select * from resources where household_id=$1',[householdId]);
  const a=await db.query('select * from pet_resource_access where household_id=$1',[householdId]);
  const d=await db.query('select * from home_responsibilities where household_id=$1',[householdId]);
  const p=await db.query('select * from plan_revisions where household_id=$1 order by case_id,revision_number',[householdId]);
  const rv=await db.query('select * from plan_reviews where household_id=$1 order by created_at',[householdId]);
  const ho=await db.query("select * from handovers where household_id=$1 order by created_at",[householdId]);
  const ack=await db.query('select * from handover_acks where household_id=$1 and profile_id=$2',[householdId,actor.userId]);
  const sessions=await db.query('select id,case_id,plan_revision_id,state,safety_epoch,started_by,created_at,interruption_reason from sessions where household_id=$1 order by created_at desc',[householdId]);
  return {household:h.rows[0],zones:z.rows,resources:r.rows,pet_resource_access:a.rows,responsibilities:d.rows,plans:p.rows,reviews:rv.rows,handovers:ho.rows,own_acknowledgements:ack.rows,sessions:sessions.rows,as_of:new Date().toISOString(),physical_state_verified:false};
 });
}

export async function draftPlan(actor:Actor,caseId:string,raw:unknown,key:string) {
 const i=planDraftInput.parse(raw);keyCheck(key);
 const initial=await readAs(actor,db=>db.query('select household_id from cases where id=$1',[caseId]).then(r=>r.rows[0]));if(!initial)throw new DomainError('SCOPE_MISMATCH',403);
 return ownerWrite(actor,initial.household_id,i,key,{operation:'plan_drafted',case_id:caseId,...i},async(db,h)=>{
  const s=await scopedCase(db,actor,caseId,true);if(!s.c.routed_at)throw new DomainError('INTAKE_REQUIRED');if(['professional_required','urgent_help','clarification_required'].includes(s.c.support_level))throw new DomainError('GUIDANCE_PAUSED');
  const d=(await db.query('select * from scenario_definitions where id=$1',[s.c.scenario_code])).rows[0];
  const v=(await db.query(`select v.* from protocol_versions v join protocol_scenarios ps on ps.protocol_version_id=v.id where v.slug=$1 and ps.scenario_id=$2 and v.locale=$3 order by v.created_at desc limit 1`,[d.demo_protocol_slug,s.c.scenario_code,i.locale])).rows[0];
  if(!v||(s.h.mode==='demo'?(v.status!=='demo_only'||!s.h.fictional):(v.status!=='approved'))||v.revoked_at||(v.review_due_at&&new Date(v.review_due_at)<=new Date()))throw new DomainError('PROTOCOL_UNAVAILABLE');
  const homeRows=(await db.query('select label,arrangement_note from home_zones where household_id=$1 and home_version=$2 order by label',[s.h.id,s.h.home_version])).rows;
  const participantDigest=digest(s.participants.map(p=>({pet_id:p.pet_id,role:p.role,species:p.species})));const intakeDigest=digest(s.c.intake);const homeDigest=digest(homeRows);const revision=(await db.query('select coalesce(max(revision_number),0)+1 n from plan_revisions where case_id=$1',[caseId])).rows[0].n;
  const planDigest=digest({case_id:caseId,revision,participantDigest,intakeDigest,homeDigest,protocolDigest:v.digest,safety_epoch:s.h.safety_epoch,home_version:s.h.home_version,locale:i.locale});
  const id=randomUUID();await db.query('insert into plan_revisions(id,household_id,case_id,protocol_version_id,revision_number,safety_epoch,home_version,participant_digest,digest,status,current_step,locale,intake_digest,home_digest,protocol_digest) values($1,$2,$3,$4,$5,$6,$7,$8,$9,\'draft\',\'owner-review\',$10,$11,$12,$13)',[id,s.h.id,caseId,v.id,revision,s.h.safety_epoch,s.h.home_version,participantDigest,planDigest,i.locale,intakeDigest,homeDigest,v.digest]);
  for(const [n,step] of ['review-records','confirm-home-record','publish-handover'].entries())await db.query('insert into plan_steps(household_id,plan_revision_id,step_key,sequence,prerequisite_snapshot) values($1,$2,$3,$4,$5)',[s.h.id,id,step,n,JSON.stringify({schema_version:'1',values:{},unknowns:s.c.intake.unknowns??[]})]);
  return {plan_revision_id:id,revision_number:revision,digest:planDigest,status:'draft',protocol_status:v.status,demo_only:v.status==='demo_only'};
 });
}

export async function reviewPlan(actor:Actor,planId:string,raw:unknown,key:string) {
 const i=planReviewInput.parse(raw);keyCheck(key);
 const initial=await readAs(actor,db=>db.query('select household_id from plan_revisions where id=$1',[planId]).then(r=>r.rows[0]));if(!initial)throw new DomainError('SCOPE_MISMATCH',403);
 return ownerWrite(actor,initial.household_id,i,key,{operation:'plan_reviewed',plan_revision_id:planId,...i},async(db,h)=>{
  const p=(await db.query('select * from plan_revisions where id=$1 and household_id=$2 for update',[planId,h.id])).rows[0];if(!p)throw new DomainError('SCOPE_MISMATCH',403);if(p.status!=='draft'||p.digest!==i.reviewed_digest||p.safety_epoch!==h.safety_epoch||p.home_version!==h.home_version)throw new DomainError('STALE_STATE');
  await db.query('insert into plan_reviews(household_id,plan_revision_id,reviewer_id,reviewed_digest,safety_epoch) values($1,$2,$3,$4,$5)',[h.id,p.id,actor.userId,p.digest,h.safety_epoch]);await db.query("update plan_revisions set status='reviewed' where id=$1",[p.id]);await db.query("update handovers set status='superseded' where household_id=$1 and case_id=$2 and status='published'",[h.id,p.case_id]);
  const body={schema_version:'1',summary:'The owner reviewed this fictional record revision. No practical animal guidance or physical state is verified.',physical_state_verified:false,plan_revision_id:p.id,plan_digest:p.digest};const hd=digest(body);const handover=(await db.query("insert into handovers(household_id,case_id,safety_epoch,body,digest,status,published_at,actor_id,plan_revision_id) values($1,$2,$3,$4,$5,'published',now(),$6,$7) returning id",[h.id,p.case_id,h.safety_epoch,JSON.stringify(body),hd,actor.userId,p.id])).rows[0];return {plan_revision_id:p.id,status:'reviewed',handover_id:handover.id,handover_digest:hd};
 });
}

export async function acknowledgeHandover(actor:Actor,handoverId:string,raw:unknown,key:string) {
 const i=handoverAckInput.parse(raw);keyCheck(key);
 return transaction(async db=>{
  await assertSession(db,actor);
  const candidate=(await db.query('select household_id from handovers where id=$1',[handoverId])).rows[0];
  if(!candidate)throw new DomainError('SCOPE_MISMATCH',403);
  // Safety writes and withdrawal workers lock the household before its
  // handovers. The idempotency insert also acquires a household FK lock.
  const household=(await db.query('select id,status,expires_at,safety_epoch from households where id=$1 for update',[candidate.household_id])).rows[0];
  if(!household||household.status!=='active'||(household.expires_at&&new Date(household.expires_at)<=new Date()))throw new DomainError('SCOPE_MISMATCH',403);
  await assertSession(db,actor);
  const ho=(await db.query('select * from handovers where id=$1 and household_id=$2 for update',[handoverId,household.id])).rows[0];
  if(!ho||!ho.case_id)throw new DomainError('SCOPE_MISMATCH',403);
  const m=(await db.query('select * from memberships where household_id=$1 and profile_id=$2 and revoked_at is null and (expires_at is null or expires_at>now())',[ho.household_id,actor.userId])).rows[0];
  if(!m)throw new DomainError('SCOPE_MISMATCH',403);if(!m.accepted_at)throw new DomainError('MEMBERSHIP_NOT_ACCEPTED');
  if(m.case_scope&&!m.case_scope.includes(ho.case_id))throw new DomainError('SCOPE_MISMATCH',403);
  if(m.pet_scope){
   const participants=(await db.query('select pet_id from case_pets where household_id=$1 and case_id=$2',[household.id,ho.case_id])).rows;
   if(participants.some(p=>!m.pet_scope.includes(p.pet_id)))throw new DomainError('SCOPE_MISMATCH',403);
  }
  const prior=(await db.query('select * from private.idempotency where household_id=$1 and actor_id=$2 and key=$3',[ho.household_id,actor.userId,key])).rows[0];
  if(prior){if(prior.body_hash!==digest(i)||prior.result?.handover_id!==ho.id)throw new DomainError('IDEMPOTENCY_MISMATCH');return prior.result;}
  if(ho.status!=='published'||ho.safety_epoch!==household.safety_epoch||ho.digest!==i.acknowledged_digest)throw new DomainError('HANDOVER_CHANGED');
  const id=randomUUID();await db.query('insert into handover_acks(id,household_id,handover_id,profile_id,acknowledged_digest) values($1,$2,$3,$4,$5)',[id,ho.household_id,ho.id,actor.userId,ho.digest]);
  const result={acknowledgement_id:id,handover_id:ho.id,digest:ho.digest};
  await db.query('insert into private.idempotency(household_id,actor_id,key,body_hash,result) values($1,$2,$3,$4,$5)',[ho.household_id,actor.userId,key,digest(i),JSON.stringify(result)]);return result;
 });
}

export async function acceptMembership(actor:Actor,membershipId:string,raw:unknown) {
 const input=membershipAcceptInput.parse(raw);return transaction(async db=>{
  await assertSession(db,actor);
  const initial=(await db.query('select household_id from memberships where id=$1 and profile_id=$2',[membershipId,actor.userId])).rows[0];
  if(!initial)throw new DomainError('SCOPE_MISMATCH',403);
  const h=(await db.query("select id from households where id=$1 and status='active' and (expires_at is null or expires_at>now()) for update",[initial.household_id])).rows[0];
  const m=(await db.query('select * from memberships where id=$1 and profile_id=$2 and revoked_at is null and (expires_at is null or expires_at>now()) for update',[membershipId,actor.userId])).rows[0];
  if(!h||!m)throw new DomainError('SCOPE_MISMATCH',403);
  if(m.grant_version!==input.expected_grant_version)throw new DomainError('STALE_STATE');
  if(!m.accepted_at){
   await db.query('update memberships set accepted_at=now() where id=$1',[m.id]);
   await db.query("insert into audit_events(household_id,actor_id,event_type,safety_epoch) select $1,$2,'membership_accepted',safety_epoch from households where id=$1",[m.household_id,actor.userId]);
  }
  return {membership_id:m.id,accepted:true};
 });
}
