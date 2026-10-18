import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { digest } from '../content/fixtures';
import { occurrenceGenerationInput,routineInput,routineUpdateInput,taskClaimInput,taskCorrectionInput,taskReportInput } from '../contracts/phase45';
import { assertSession,DomainError,readAs,transaction,type Actor } from './db';
import { ownerWrite } from './household';

const keyCheck=(key:string)=>{if(!/^[a-zA-Z0-9-]{16,100}$/.test(key))throw new DomainError('IDEMPOTENCY_KEY_REQUIRED',400);};

function localParts(zone:string,instant:number){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);
 const get=(t:string)=>parts.find(p=>p.type===t)?.value??'';
 return {date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`};
}

// R0 recurrence rule: keep the requested wall-clock time. During a spring gap,
// choose the first valid minute after it; during an autumn overlap, choose the
// first occurrence. The occurrence key remains the requested local wall time.
export function wallClockInstant(date:string,time:string,zone:string){
 const nominal=Date.parse(`${date}T${time}:00Z`),matches:number[]=[];let firstAfter:number|undefined;
 for(let ms=nominal-18*3600_000;ms<=nominal+18*3600_000;ms+=60_000){
  const local=localParts(zone,ms);
  if(local.date===date&&local.time===time)matches.push(ms);
  if(firstAfter===undefined&&local.date===date&&local.time>time)firstAfter=ms;
 }
 const selected=matches[0]??firstAfter;
 if(selected===undefined)throw new DomainError('INVALID_LOCAL_TIME',400);
 return new Date(selected).toISOString();
}

function dates(from:string,through:string){const out:string[]=[];for(let d=new Date(`${from}T12:00:00Z`),end=new Date(`${through}T12:00:00Z`);d<=end;d=new Date(d.getTime()+86400_000))out.push(d.toISOString().slice(0,10));return out;}

async function memberForTask(db:pg.PoolClient,actor:Actor,taskId:string,write=true){
 await assertSession(db,actor);const task=(await db.query('select * from task_occurrences where id=$1 for update',[taskId])).rows[0];if(!task)throw new DomainError('SCOPE_MISMATCH',403);
 const m=(await db.query('select * from memberships where household_id=$1 and profile_id=$2 and accepted_at is not null and revoked_at is null and (expires_at is null or expires_at>now())',[task.household_id,actor.userId])).rows[0];
 if(!m||write&&m.role==='reader')throw new DomainError('SCOPE_MISMATCH',403);
 const h=(await db.query('select * from households where id=$1',[task.household_id])).rows[0];
 if(!h||h.status!=='active'||h.expires_at&&new Date(h.expires_at)<=new Date())throw new DomainError('SCOPE_MISMATCH',403);
 let petId:string|null=null;
 if(task.routine_rule_id){
  petId=(await db.query('select pet_id from routine_rules where id=$1 and household_id=$2',[task.routine_rule_id,task.household_id])).rows[0]?.pet_id??null;
  if(!petId||m.pet_scope&&!m.pet_scope.includes(petId))throw new DomainError('SCOPE_MISMATCH',403);
  if(m.case_scope&&!(await db.query('select 1 from case_pets where household_id=$1 and pet_id=$2 and case_id=any($3::uuid[])',[task.household_id,petId,m.case_scope])).rowCount)throw new DomainError('SCOPE_MISMATCH',403);
 }else{
  const p=(await db.query('select p.*,c.status case_status,c.support_level,v.status protocol_status,v.revoked_at,v.review_due_at from plan_steps s join plan_revisions p on p.id=s.plan_revision_id and p.household_id=s.household_id join cases c on c.id=p.case_id and c.household_id=p.household_id join protocol_versions v on v.id=p.protocol_version_id where s.id=$1 and s.household_id=$2',[task.plan_step_id,task.household_id])).rows[0];
  if(!p||m.case_scope&&!m.case_scope.includes(p.case_id))throw new DomainError('SCOPE_MISMATCH',403);
  if(m.pet_scope&&(await db.query('select 1 from case_pets where household_id=$1 and case_id=$2 and not(pet_id=any($3::uuid[])) limit 1',[task.household_id,p.case_id,m.pet_scope])).rowCount)throw new DomainError('SCOPE_MISMATCH',403);
  if(task.expected_safety_epoch!==h.safety_epoch||p.safety_epoch!==h.safety_epoch||p.home_version!==h.home_version||p.status!=='reviewed'||p.case_status!=='active'||p.support_level!=='guided_preparation')throw new DomainError('STALE_STATE');
  if(p.revoked_at||p.review_due_at&&new Date(p.review_due_at)<=new Date()||h.mode==='demo'&&(!h.fictional||p.protocol_status!=='demo_only')||h.mode!=='demo'&&p.protocol_status!=='approved')throw new DomainError('PROTOCOL_UNAVAILABLE');
  if((await db.query("select 1 from safety_holds where household_id=$1 and case_id=$2 and state='active'",[task.household_id,p.case_id])).rowCount)throw new DomainError('GUIDANCE_PAUSED');
 }
 return {task,m,petId};
}

export async function createRoutine(actor:Actor,householdId:string,raw:unknown,key:string){const i=routineInput.parse(raw);return ownerWrite(actor,householdId,i,key,{operation:'routine_created',...i},async(db)=>{
 if(!(await db.query('select 1 from pets where id=$1 and household_id=$2 and archived_at is null',[i.pet_id,householdId])).rowCount)throw new DomainError('SCOPE_MISMATCH',403);
 const id=randomUUID();await db.query('insert into routine_rules(id,household_id,pet_id,created_by,kind,instruction,schedule_spec) values($1,$2,$3,$4,$5,$6,$7)',[id,householdId,i.pet_id,actor.userId,i.kind,i.instruction,JSON.stringify(i.schedule_spec)]);
 return {routine_rule_id:id,kind:i.kind,schedule_spec:i.schedule_spec,source:'owner_entered',medical_guidance:false};
});}

export async function updateRoutine(actor:Actor,householdId:string,ruleId:string,raw:unknown,key:string){const i=routineUpdateInput.parse(raw);return ownerWrite(actor,householdId,i,key,{operation:'routine_updated',routine_rule_id:ruleId,...i},async(db)=>{const rule=(await db.query('select * from routine_rules where id=$1 and household_id=$2 for update',[ruleId,householdId])).rows[0];if(!rule)throw new DomainError('SCOPE_MISMATCH',403);if(rule.version!==i.expected_rule_version)throw new DomainError('STALE_STATE');if(!(await db.query('select 1 from pets where id=$1 and household_id=$2 and archived_at is null',[i.pet_id,householdId])).rowCount)throw new DomainError('SCOPE_MISMATCH',403);const future=(await db.query("select id from task_occurrences where household_id=$1 and routine_rule_id=$2 and due_at>now() and state in ('planned','claimed') for update",[householdId,ruleId])).rows.map(r=>r.id);if(future.length){await db.query("update task_occurrences set state='canceled' where id=any($1::uuid[])",[future]);await db.query("update outbox_events set state='canceled' where household_id=$1 and state='pending' and payload->>'task_occurrence_id'=any($2::text[])",[householdId,future]);}const updated=(await db.query('update routine_rules set pet_id=$3,kind=$4,instruction=$5,schedule_spec=$6,status=$7,version=version+1,updated_at=now() where id=$1 and household_id=$2 returning version,status',[ruleId,householdId,i.pet_id,i.kind,i.instruction,JSON.stringify(i.schedule_spec),i.status])).rows[0];return {routine_rule_id:ruleId,version:updated.version,status:updated.status,canceled_future_occurrences:future.length,history_preserved:true};});}

export async function generateOccurrences(actor:Actor,householdId:string,raw:unknown,key:string){const i=occurrenceGenerationInput.parse(raw);return ownerWrite(actor,householdId,i,key,{operation:'routine_occurrences_generated',...i},async(db,h)=>{
 const dayList=dates(i.from_date,i.through_date);if(dayList.length>370)throw new DomainError('RANGE_TOO_LARGE',400);
 const rules=(await db.query("select * from routine_rules where household_id=$1 and status='active' order by id",[householdId])).rows;let created=0;
 for(const rule of rules){
  if(!(await db.query('select 1 from pets where id=$1 and household_id=$2 and archived_at is null',[rule.pet_id,householdId])).rowCount)continue;
  const spec=rule.schedule_spec as {timezone:string;frequency:'daily'|'weekly';local_time:string;days_of_week:number[];dst_policy:string};
  for(const date of dayList){const dow=new Date(`${date}T12:00:00Z`).getUTCDay();if(spec.frequency==='weekly'&&!spec.days_of_week.includes(dow))continue;
   const occurrenceKey=`v${rule.version}:${date}T${spec.local_time}[${spec.timezone}]`;
   const result=await db.query("insert into task_occurrences(household_id,routine_rule_id,assigned_to,due_at,expected_safety_epoch,occurrence_key,rule_snapshot) values($1,$2,$3,$4,$5,$6,$7) on conflict(routine_rule_id,occurrence_key) do nothing returning id,due_at",[householdId,rule.id,rule.created_by,wallClockInstant(date,spec.local_time,spec.timezone),h.safety_epoch,occurrenceKey,JSON.stringify({schema_version:'1',kind:rule.kind,instruction:rule.instruction,schedule_spec:spec,rule_version:rule.version})]);created+=result.rowCount??0;
   if(result.rows[0])await db.query("insert into outbox_events(household_id,event_type,payload,expected_safety_epoch,idempotency_key,not_before,state) values($1,'routine_due',$2,$3,$4,$5,'pending')",[householdId,JSON.stringify({schema_version:'1',task_occurrence_id:result.rows[0].id,recipient_id:rule.created_by}),h.safety_epoch,`routine:${result.rows[0].id}:${rule.created_by}`,result.rows[0].due_at]);
  }
 }
 return {created,rule_count:rules.length,from_date:i.from_date,through_date:i.through_date,dst_policy:'wall_clock_first_valid'};
});}

export async function listDueTasks(actor:Actor,householdId:string,windowHours=168){return readAs(actor,async db=>{
 const h=(await db.query('select id,safety_epoch from households where id=$1',[householdId])).rows[0];if(!h)throw new DomainError('SCOPE_MISMATCH',403);
 const rows=(await db.query(`select o.id,o.due_at,o.state,o.expected_safety_epoch,r.kind,r.instruction,r.pet_id,p.nickname,
  coalesce(jsonb_agg(jsonb_build_object('id',tr.id,'reporter_id',tr.reporter_id,'report',tr.report,'corrected_report',tr.corrected_report,'performed_at',tr.performed_at,'created_at',tr.created_at) order by tr.created_at) filter(where tr.id is not null),'[]') reports
  from task_occurrences o join routine_rules r on r.id=o.routine_rule_id join pets p on p.id=r.pet_id left join task_reports tr on tr.task_occurrence_id=o.id
  where o.household_id=$1 and o.due_at<=now()+($2::text||' hours')::interval group by o.id,r.id,p.id order by o.due_at,o.id`,[householdId,windowHours])).rows;
 return {household_id:householdId,as_of:new Date().toISOString(),safety_epoch:h.safety_epoch,tasks:rows.map(r=>({...r,has_report:r.reports.length>0,ingestion_verified:false})),notice:'No report means no recorded completion or ingestion.'};
});}

export async function listInbox(actor:Actor,householdId:string){return transaction(async db=>{await assertSession(db,actor);const membership=(await db.query(`select 1 from memberships where household_id=$1 and profile_id=$2 and accepted_at is not null and revoked_at is null and (expires_at is null or expires_at>now())`,[householdId,actor.userId])).rowCount;if(!membership)throw new DomainError('SCOPE_MISMATCH',403);const rows=(await db.query(`select d.id,d.status,d.created_at,d.last_error_code,e.event_type,e.payload,e.expected_safety_epoch
 from deliveries d join outbox_events e on e.id=d.outbox_event_id and e.household_id=d.household_id where d.household_id=$1 and d.recipient_id=$2 order by d.created_at desc`,[householdId,actor.userId])).rows;return {household_id:householdId,recipient_id:actor.userId,items:rows,as_of:new Date().toISOString(),delivery_statuses_are_distinct:true};});}

export async function claimTask(actor:Actor,id:string,raw:unknown,key:string){const i=taskClaimInput.parse(raw);keyCheck(key);return transaction(async db=>{const x=await memberForTask(db,actor,id);const body={operation:'task_claimed',task_occurrence_id:id,...i};const prior=(await db.query('select * from private.idempotency where household_id=$1 and actor_id=$2 and key=$3',[x.task.household_id,actor.userId,key])).rows[0];if(prior){if(prior.body_hash!==digest(body))throw new DomainError('IDEMPOTENCY_MISMATCH');return prior.result;}if(x.task.state!==i.expected_state||!['planned','claimed'].includes(x.task.state))throw new DomainError('STALE_STATE');await db.query("insert into task_claims(household_id,task_occurrence_id,profile_id,state) values($1,$2,$3,'claimed') on conflict(task_occurrence_id,profile_id,state) do nothing",[x.task.household_id,id,actor.userId]);await db.query("update task_occurrences set state='claimed' where id=$1 and state='planned'",[id]);const result={task_occurrence_id:id,state:'claimed',claimed_by:actor.userId};await db.query('insert into private.idempotency(household_id,actor_id,key,body_hash,result) values($1,$2,$3,$4,$5)',[x.task.household_id,actor.userId,key,digest(body),JSON.stringify(result)]);return result;});}

async function effectiveTaskState(db:pg.PoolClient,id:string){
 const reports=(await db.query(`select r.* from task_reports r where r.task_occurrence_id=$1 and not exists(select 1 from task_reports c where c.supersedes_id=r.id) order by r.created_at,r.id`,[id])).rows;
 const values=reports.map(r=>r.report==='correction'?r.corrected_report:r.report);const distinct=[...new Set(values)];return distinct.length===1?(distinct[0]==='done'?'reported_done':distinct[0]):'uncertain';
}

export async function reportTask(actor:Actor,id:string,raw:unknown,key:string){const parsed=(raw as any)?.report==='correction'?taskCorrectionInput.parse(raw):taskReportInput.parse(raw);keyCheck(key);return transaction(async db=>{const x=await memberForTask(db,actor,id);const body={operation:'task_reported',task_occurrence_id:id,...parsed};const prior=(await db.query('select * from private.idempotency where household_id=$1 and actor_id=$2 and key=$3',[x.task.household_id,actor.userId,key])).rows[0];if(prior){if(prior.body_hash!==digest(body))throw new DomainError('IDEMPOTENCY_MISMATCH');return prior.result;}if(['canceled'].includes(x.task.state))throw new DomainError('STALE_STATE');let supersedes:string|null=null,corrected:string|null=null;if(parsed.report==='correction'){supersedes=parsed.supersedes_id;corrected=parsed.corrected_report;const old=(await db.query('select * from task_reports where id=$1 and task_occurrence_id=$2',[supersedes,id])).rows[0];if(!old||old.reporter_id!==actor.userId)throw new DomainError('SCOPE_MISMATCH',403);}
 const reportId=randomUUID();await db.query('insert into task_reports(id,household_id,task_occurrence_id,reporter_id,report,corrected_report,performed_at,note,supersedes_id,idempotency_key,body_hash) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[reportId,x.task.household_id,id,actor.userId,parsed.report,corrected,parsed.performed_at,parsed.note,supersedes,key,digest(body)]);const state=await effectiveTaskState(db,id);await db.query('update task_occurrences set state=$2 where id=$1',[id,state]);const active=(await db.query(`select reporter_id,report,corrected_report,performed_at from task_reports r where task_occurrence_id=$1 and not exists(select 1 from task_reports c where c.supersedes_id=r.id) order by created_at,id`,[id])).rows.map(r=>({...r,performed_at:r.performed_at?new Date(r.performed_at).toISOString():null}));const result={task_report_id:reportId,task_occurrence_id:id,effective_state:state,reports:active,conflict:state==='uncertain'&&new Set(active.map(r=>r.report==='correction'?r.corrected_report:r.report)).size>1,ingestion_verified:false};await db.query('insert into private.idempotency(household_id,actor_id,key,body_hash,result) values($1,$2,$3,$4,$5)',[x.task.household_id,actor.userId,key,digest(body),JSON.stringify(result)]);return result;});}

export type DeliveryOutcome='success'|'failure'|'uncertain';
export async function processOutbox(limit=50,outcome:DeliveryOutcome='success'){return transaction(async db=>{
 const events=(await db.query("select * from outbox_events where state='pending' and (not_before is null or not_before<=now()) order by created_at,id for update skip locked limit $1",[limit])).rows;const results=[];
 for(const event of events){const h=(await db.query('select * from households where id=$1',[event.household_id])).rows[0];
  if(!h||event.expected_safety_epoch!==h.safety_epoch||(event.expires_at&&new Date(event.expires_at)<=new Date())){await db.query("update outbox_events set state='canceled' where id=$1",[event.id]);results.push({id:event.id,state:'canceled',reason:'STALE_OR_EXPIRED'});continue;}
  const requested=event.payload?.recipient_id as string|undefined;
  const members=(await db.query(`select m.*,p.status profile_status from memberships m join profiles p on p.id=m.profile_id
   where m.household_id=$1 and m.accepted_at is not null and m.revoked_at is null and (m.expires_at is null or m.expires_at>now())
   and ($2::uuid is null or m.profile_id=$2)`,[event.household_id,requested??null])).rows;
  if(!members.length||h.notification_preferences?.internal_inbox!==true){await db.query("update outbox_events set state='canceled' where id=$1",[event.id]);results.push({id:event.id,state:'canceled',reason:'RECIPIENT_NOT_AUTHORIZED'});continue;}
  const status=outcome==='success'?'delivered':outcome==='failure'?'failed':'uncertain';let inserted=0;
  for(const member of members){const result=await db.query(`insert into deliveries(household_id,outbox_event_id,channel,recipient_id,attempt,status,last_error_code)
    values($1,$2,'internal',$3,$4,$5,$6) on conflict(outbox_event_id,channel,recipient_id) do nothing`,[event.household_id,event.id,member.profile_id,event.attempts+1,status,outcome==='failure'?'INTERNAL_DELIVERY_FAILED':outcome==='uncertain'?'DELIVERY_OUTCOME_UNKNOWN':null]);inserted+=result.rowCount??0;}
  await db.query('update outbox_events set state=$2,attempts=attempts+1 where id=$1',[event.id,outcome==='success'?'done':outcome==='failure'?'failed':'uncertain']);results.push({id:event.id,state:status,deliveries:inserted,deduplicated:inserted===0});
 }
 return results;
});}
