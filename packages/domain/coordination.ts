import {z} from 'zod';
import {assertSession,DomainError,readAs,transaction,type Actor} from './db';
import {ownerWrite} from './household';
import {householdInput,expectedHousehold} from '../contracts/household';

// The household index does not depend on a case, protocol or plan. Pending
// recipients see only the grant's scope and household nickname, never records.
export async function householdIndex(actor:Actor){
 const households=await readAs(actor,async db=>(await db.query(`select h.id,h.nickname,h.timezone,h.locale,h.mode,h.fictional,h.safety_epoch,m.role
  from households h join memberships m on m.household_id=h.id and m.profile_id=$1
  where m.accepted_at is not null order by h.created_at desc`,[actor.userId])).rows);
 const pending_memberships=await transaction(async db=>{
  await assertSession(db,actor);
  return (await db.query(`select m.id,m.household_id,h.nickname,m.role,m.pet_scope,m.case_scope,m.expires_at,m.grant_version,
   (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'species',p.species)),'[]') from pets p where p.household_id=h.id and p.id=any(m.pet_scope)) pet_labels,
   (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title)),'[]') from cases c where c.household_id=h.id and c.id=any(m.case_scope)) case_labels
   from memberships m join households h on h.id=m.household_id
   where m.profile_id=$1 and m.accepted_at is null and m.revoked_at is null
   and (m.expires_at is null or m.expires_at>now()) and h.status='active'
   and (h.expires_at is null or h.expires_at>now()) order by m.created_at`,[actor.userId])).rows;
 });
 return {profile_id:actor.userId,households,pending_memberships};
}

export async function householdMembers(actor:Actor,id:string){
 return transaction(async db=>{
  await assertSession(db,actor);
  const m=(await db.query(`select 1 from households h join memberships m on m.household_id=h.id
   where h.id=$1 and h.owner_id=$2 and m.profile_id=$2 and m.role='owner' and m.accepted_at is not null
   and m.revoked_at is null and (m.expires_at is null or m.expires_at>now())
   and h.status='active' and (h.expires_at is null or h.expires_at>now())`,[id,actor.userId])).rowCount;
  if(!m)throw new DomainError('SCOPE_MISMATCH',403);
  const members=(await db.query(`select m.id,m.profile_id,m.role,m.pet_scope,m.case_scope,m.expires_at,m.revoked_at,m.accepted_at,m.grant_version,
   p.display_name,p.status profile_status from memberships m join profiles p on p.id=m.profile_id
   where m.household_id=$1 order by m.created_at,m.id`,[id])).rows;
  return {members,as_of:new Date().toISOString()};
 });
}

const settingsInput=expectedHousehold.extend(householdInput.omit({adult_acknowledged:true}).shape).strict();
export async function updateHouseholdSettings(actor:Actor,id:string,raw:unknown,key:string){
 const i=settingsInput.parse(raw);
 return ownerWrite(actor,id,i,key,{operation:'household_settings_updated',...i},async db=>{
  await db.query('update households set nickname=$2,timezone=$3,locale=$4,notification_preferences=$5 where id=$1',[id,i.nickname,i.timezone,i.locale,JSON.stringify(i.notification_preferences)]);
  return {household_id:id,nickname:i.nickname,timezone:i.timezone,locale:i.locale,notification_preferences:i.notification_preferences};
 });
}
