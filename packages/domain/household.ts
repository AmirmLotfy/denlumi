import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { transaction, readAs, assertSession, DomainError, type Actor } from './db';
import { digest } from '../content/fixtures';
import { householdInput, addPetInput, updatePetInput, caseInput, membershipInput, revokeInput, transferInput, participantInput } from '../contracts/household';
const keyCheck=(key:string)=>{if(!/^[a-zA-Z0-9-]{16,100}$/.test(key))throw new DomainError('IDEMPOTENCY_KEY_REQUIRED',400);};

export async function householdGraph(actor:Actor,id:string) {
 return readAs(actor,async db=>{
  const household=(await db.query('select id,nickname,timezone,locale,mode,fictional,state_version,safety_epoch,status from households where id=$1',[id])).rows[0];
  if(!household)throw new DomainError('SCOPE_MISMATCH',403);
  const pets=(await db.query('select * from pets where household_id=$1 order by created_at,id',[id])).rows;
  const cases=(await db.query('select * from cases where household_id=$1 order by created_at,id',[id])).rows;
  const participants=(await db.query('select * from case_pets where household_id=$1',[id])).rows;
  const pairs=(await db.query('select * from pet_pairs where household_id=$1',[id])).rows;
  const contexts=(await db.query('select * from pair_contexts where household_id=$1',[id])).rows;
  const membership=(await db.query('select id,role,pet_scope,case_scope,expires_at from memberships where household_id=$1 and profile_id=$2',[id,actor.userId])).rows[0];
  return {household,pets,cases,participants,pairs,contexts,membership,as_of:new Date().toISOString(),physical_state_verified:false};
 });
}
export async function ownerWrite(actor:Actor,id:string,input:{expected_state_version:number;expected_safety_epoch:number},key:string,body:unknown,run:(db:pg.PoolClient,h:any)=>Promise<unknown>) {
 keyCheck(key);
 return transaction(async db=>{
  await assertSession(db,actor);
  const h=(await db.query('select * from households where id=$1 for update',[id])).rows[0];
  const m=(await db.query('select * from memberships where household_id=$1 and profile_id=$2 and revoked_at is null and (expires_at is null or expires_at>now()) for share',[id,actor.userId])).rows[0];
  if(!h||!m||h.status!=='active'||(h.expires_at&&new Date(h.expires_at)<=new Date()))throw new DomainError('SCOPE_MISMATCH',403);
  if(m.role!=='owner'||h.owner_id!==actor.userId)throw new DomainError('FORBIDDEN',403);
  const prior=(await db.query('select * from private.idempotency where household_id=$1 and actor_id=$2 and key=$3',[id,actor.userId,key])).rows[0];
  if(prior){if(prior.body_hash!==digest(body))throw new DomainError('IDEMPOTENCY_MISMATCH');return prior.result;}
  if(h.state_version!==input.expected_state_version||h.safety_epoch!==input.expected_safety_epoch)throw new DomainError('STALE_STATE');
  const value=await run(db,h);
  await db.query('update households set state_version=state_version+1 where id=$1',[id]);
  const result={value,state_version:h.state_version+1,safety_epoch:(await db.query('select safety_epoch from households where id=$1',[id])).rows[0].safety_epoch};
  await db.query('insert into private.idempotency(household_id,actor_id,key,body_hash,result) values($1,$2,$3,$4,$5)',[id,actor.userId,key,digest(body),JSON.stringify(result)]);
  await db.query('insert into audit_events(household_id,actor_id,event_type,safety_epoch) values($1,$2,$3,$4)',[id,actor.userId,(body as any).operation,result.safety_epoch]);
  return result;
 });
}
// A separate actor-bound idempotency record is needed before a tenant exists.
export async function createHousehold(actor:Actor,raw:unknown,key:string) {
 const i=householdInput.parse(raw);keyCheck(key);
 return transaction(async db=>{
  await assertSession(db,actor);
  await db.query('select pg_advisory_xact_lock(hashtext($1))',[actor.userId]);
  const prior=(await db.query('select * from private.household_creations where actor_id=$1 and key=$2',[actor.userId,key])).rows[0];
  if(prior){if(prior.body_hash!==digest(i))throw new DomainError('IDEMPOTENCY_MISMATCH');return {household_id:prior.household_id};}
  const id=randomUUID();
  await db.query("insert into households(id,owner_id,nickname,timezone,locale,mode,fictional,expires_at,adult_acknowledged_at) values($1,$2,$3,$4,$5,'live',false,null,now())",[id,actor.userId,i.nickname,i.timezone,i.locale]);
  await db.query("insert into memberships(household_id,profile_id,role,invited_by,accepted_at) values($1,$2,'owner',$2,now())",[id,actor.userId]);
  await db.query('insert into private.household_creations(actor_id,key,body_hash,household_id) values($1,$2,$3,$4)',[actor.userId,key,digest(i),id]);
  await db.query("insert into audit_events(household_id,actor_id,event_type,safety_epoch) values($1,$2,'household_created',1)",[id,actor.userId]);
  return {household_id:id};
 });
}
export async function invalidate(db:pg.PoolClient,h:any,actor:Actor,reason='Household records changed. Dependent plans require fresh review. No physical state is verified.') {
 const epoch=h.safety_epoch+1;
 await db.query('update households set safety_epoch=$2 where id=$1',[h.id,epoch]);
 await db.query("update plan_revisions set status='stale' where household_id=$1",[h.id]);
 await db.query('update plan_reviews set invalidated_at=coalesce(invalidated_at,now()) where household_id=$1',[h.id]);
 await db.query("update handovers set status='superseded' where household_id=$1 and status='published'",[h.id]);
 await db.query("update outbox_events set state='canceled' where household_id=$1 and state='pending'",[h.id]);
 const body={schema_version:'1',summary:reason,physical_state_verified:false};
 await db.query("insert into handovers(household_id,case_id,safety_epoch,body,digest,status,published_at,actor_id) select household_id,id,$2,$3,$4,'published',now(),$5 from cases where household_id=$1",[h.id,epoch,JSON.stringify(body),digest(body),actor.userId]);
}
export async function addPet(actor:Actor,id:string,raw:unknown,key:string) {
 const i=addPetInput.parse(raw);
 return ownerWrite(actor,id,i,key,{operation:'pet_added',...i},async(db,h)=>{
  const pet=(await db.query('insert into pets(household_id,nickname,species,age_band,approx_birth_date,arrival_date,context_notes,aliases) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[id,i.nickname,i.species,i.age_band,i.approx_birth_date,i.arrival_date,JSON.stringify(i.context_notes),i.aliases])).rows[0];
  await invalidate(db,h,actor);return pet;
 });
}
export async function updatePet(actor:Actor,petId:string,raw:unknown,key:string) {
 const i=updatePetInput.parse(raw);
 const id=await readAs(actor,async db=>(await db.query('select household_id from pets where id=$1',[petId])).rows[0]?.household_id);
 if(!id)throw new DomainError('SCOPE_MISMATCH',403);
 return ownerWrite(actor,id,i,key,{operation:'pet_updated',pet_id:petId,...i},async(db,h)=>{
  const pet=(await db.query('select * from pets where id=$1 and household_id=$2 for update',[petId,id])).rows[0];
  if(!pet||pet.version!==i.expected_pet_version)throw new DomainError('STALE_STATE');
  const updated=(await db.query('update pets set nickname=$2,species=$3,age_band=$4,approx_birth_date=$5,arrival_date=$6,context_notes=$7,aliases=$8,version=version+1 where id=$1 returning *',[petId,i.nickname,i.species,i.age_band,i.approx_birth_date,i.arrival_date,JSON.stringify(i.context_notes),i.aliases])).rows[0];
  await invalidate(db,h,actor);return updated;
 });
}
export async function createCase(actor:Actor,id:string,raw:unknown,key:string) {
 const i=caseInput.parse(raw);
 return ownerWrite(actor,id,i,key,{operation:'case_created',...i},async(db,h)=>{
  const selected=(await db.query('select id from pets where household_id=$1 and id=any($2::uuid[]) and archived_at is null',[id,i.participants.map(p=>p.pet_id)])).rows;
  if(selected.length!==i.participants.length)throw new DomainError('SCOPE_MISMATCH',403);
  const c=(await db.query("insert into cases(household_id,title,scenario_code,support_level) values($1,$2,$3,'coordination_only') returning *",[id,i.title,i.scenario_code])).rows[0];
  for(const p of i.participants)await db.query('insert into case_pets(household_id,case_id,pet_id,role) values($1,$2,$3,$4)',[id,c.id,p.pet_id,p.role]);
  const pets=i.participants.map(p=>p.pet_id).sort();
  for(let a=0;a<pets.length;a++)for(let b=a+1;b<pets.length;b++){
   const pair=(await db.query('insert into pet_pairs(household_id,pet_a_id,pet_b_id) values($1,$2,$3) on conflict(household_id,pet_a_id,pet_b_id) do update set pet_a_id=excluded.pet_a_id returning id',[id,pets[a],pets[b]])).rows[0];
   await db.query('insert into pair_contexts(household_id,case_id,pair_id,context_key) values($1,$2,$3,$4)',[id,c.id,pair.id,i.context_key]);
  }
  await invalidate(db,h,actor);return c;
 });
}
export async function grantMembership(actor:Actor,id:string,raw:unknown,key:string) {
 const i=membershipInput.parse(raw);
 return ownerWrite(actor,id,i,key,{operation:'membership_granted',...i},async(db,h)=>{
  if(i.profile_id===h.owner_id)throw new DomainError('OWNER_TRANSFER_REQUIRED');
  if(i.expires_at&&new Date(i.expires_at)<=new Date())throw new DomainError('INVALID_EXPIRY',400);
  if(!(await db.query("select 1 from profiles where id=$1 and status='active'",[i.profile_id])).rowCount)throw new DomainError('SCOPE_MISMATCH',403);
  for(const [table,ids] of [['pets',i.pet_scope],['cases',i.case_scope]] as const){
   if(ids&&(new Set(ids).size!==ids.length||(await db.query(`select id from ${table} where household_id=$1 and id=any($2::uuid[])`,[id,ids])).rowCount!==ids.length))throw new DomainError('SCOPE_MISMATCH',403);
  }
  const m=(await db.query('insert into memberships(household_id,profile_id,role,pet_scope,case_scope,expires_at,invited_by) values($1,$2,$3,$4,$5,$6,$7) on conflict(household_id,profile_id) do update set role=excluded.role,pet_scope=excluded.pet_scope,case_scope=excluded.case_scope,expires_at=excluded.expires_at,revoked_at=null,invited_by=excluded.invited_by returning id,role,pet_scope,case_scope,expires_at',[id,i.profile_id,i.role,i.pet_scope,i.case_scope,i.expires_at,actor.userId])).rows[0];
  return m;
 });
}
export async function revokeMembership(actor:Actor,id:string,membershipId:string,raw:unknown,key:string) {
 const i=revokeInput.parse(raw);
 return ownerWrite(actor,id,i,key,{operation:'membership_revoked',membership_id:membershipId,...i},async db=>{
  const m=(await db.query('select * from memberships where id=$1 and household_id=$2',[membershipId,id])).rows[0];
  if(!m)throw new DomainError('SCOPE_MISMATCH',403);
  if(m.role==='owner')throw new DomainError('OWNER_TRANSFER_REQUIRED');
  await db.query('update memberships set revoked_at=now() where id=$1',[m.id]);return {membership_id:m.id,revoked:true};
 });
}
export async function transferOwnership(actor:Actor,id:string,raw:unknown,key:string) {
 const i=transferInput.parse(raw);
 return ownerWrite(actor,id,i,key,{operation:'ownership_transferred',...i},async(db,h)=>{
  if(i.new_owner_id===actor.userId)throw new DomainError('INVALID_TRANSFER',400);
  const m=(await db.query("select m.* from memberships m join profiles p on p.id=m.profile_id where m.household_id=$1 and m.profile_id=$2 and m.role='caregiver' and m.revoked_at is null and m.expires_at is null and m.pet_scope is null and m.case_scope is null and p.status='active' for update of m",[id,i.new_owner_id])).rows[0];
  if(!m)throw new DomainError('SCOPE_MISMATCH',403);
  if(!m.accepted_at)throw new DomainError('MEMBERSHIP_NOT_ACCEPTED',409);
  await db.query("update memberships set role='caregiver' where household_id=$1 and profile_id=$2",[id,actor.userId]);
  await db.query("update memberships set role='owner' where id=$1",[m.id]);
  await db.query('update households set owner_id=$2 where id=$1',[id,i.new_owner_id]);
  await invalidate(db,h,actor);return {owner_id:i.new_owner_id};
 });
}

export async function addCaseParticipant(actor:Actor,caseId:string,raw:unknown,key:string) {
 const i=participantInput.parse(raw);
 const id=await readAs(actor,async db=>(await db.query('select household_id from cases where id=$1',[caseId])).rows[0]?.household_id);
 if(!id)throw new DomainError('SCOPE_MISMATCH',403);
 return ownerWrite(actor,id,i,key,{operation:'participant_added',case_id:caseId,...i},async(db,h)=>{
  if(!(await db.query('select 1 from pets where id=$1 and household_id=$2 and archived_at is null',[i.pet_id,id])).rowCount)throw new DomainError('SCOPE_MISMATCH',403);
  if((await db.query('select 1 from case_pets where case_id=$1 and pet_id=$2',[caseId,i.pet_id])).rowCount)throw new DomainError('PARTICIPANT_EXISTS');
  await db.query('insert into case_pets(household_id,case_id,pet_id,role) values($1,$2,$3,$4)',[id,caseId,i.pet_id,i.role]);
  const others=(await db.query('select pet_id from case_pets where case_id=$1 and pet_id<>$2',[caseId,i.pet_id])).rows;
  for(const other of others){
   const [a,b]=[i.pet_id,other.pet_id].sort();
   const pair=(await db.query('insert into pet_pairs(household_id,pet_a_id,pet_b_id) values($1,$2,$3) on conflict(household_id,pet_a_id,pet_b_id) do update set pet_a_id=excluded.pet_a_id returning id',[id,a,b])).rows[0];
   await db.query('insert into pair_contexts(household_id,case_id,pair_id,context_key) values($1,$2,$3,$4)',[id,caseId,pair.id,i.context_key]);
  }
  // The earlier scenario route covered a different participant set. Preserve
  // professional/urgent restrictions while requiring a fresh route for others.
  await db.query("update cases set support_level=case when support_level in ('guided_preparation','coordination_only') then 'clarification_required' else support_level end,support_reason_code=case when support_level in ('guided_preparation','coordination_only') then 'PARTICIPANTS_CHANGED' else support_reason_code end,routed_at=null where id=$1 and household_id=$2",[caseId,id]);
  await invalidate(db,h,actor);return {case_id:caseId,pet_id:i.pet_id,role:i.role};
 });
}
