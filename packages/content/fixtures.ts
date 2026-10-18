import { createHash, randomBytes, randomUUID } from 'node:crypto';
import source from '../../Denlumi_Build_Pack_v1/fixtures/demo_protocols.json' with {type:'json'};
import sourceRegister from '../../Denlumi_Build_Pack_v1/contracts/source-register.json' with {type:'json'};
import { transaction, type Actor, DomainError, assertSession } from '../domain/db';
import type { FixtureName } from '../contracts/phase0';
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const configurations = {
 cat_dog: { title:'Finn & Nora', code:'SC06', protocol:'demo-dc-new-dog-v1', pets:[['Finn','dog','newcomer'],['Nora','cat','resident']] },
 cat_dog_new_cat: { title:'Finn & Nora', code:'SC05', protocol:'demo-dc-new-cat-v1', pets:[['Finn','dog','resident'],['Nora','cat','newcomer']] },
 cat_cat: { title:'Nora & Milo', code:'SC03', protocol:'demo-cc-v1', pets:[['Nora','cat','resident'],['Milo','cat','newcomer']] },
 dog_dog: { title:'Finn & Rory', code:'SC04', protocol:'demo-dd-v1', pets:[['Finn','dog','resident'],['Rory','dog','newcomer']] },
 single_cat: { title:'Nora’s home', code:'SC01', protocol:'demo-solo-cat-v1', pets:[['Nora','cat','newcomer']] },
 single_dog: { title:'Finn’s home', code:'SC02', protocol:'demo-solo-dog-v1', pets:[['Finn','dog','newcomer']] },
 multi_pet: { title:'Finn, Nora & Milo', code:'SC07', protocol:'demo-care-v1', pets:[['Finn','dog','affected'],['Nora','cat','affected'],['Milo','cat','affected']] }
} as const;
export async function seedProtocols() {
 await transaction(async db => {
  for (const p of source.protocols) {
   const protocolSlug=p.id.replace(/-v[0-9]+$/,'');
   await db.query('insert into protocols(slug,scenario_family,pairing) values($1,$2,$3) on conflict(slug) do nothing',[protocolSlug,p.pairing==='coordination'?'coordination':p.pairing.startsWith('single_')?'settling':'introduction',p.pairing]);
   const protocol=(await db.query('select id from protocols where slug=$1',[protocolSlug])).rows[0];
   const version=(await db.query(`insert into public.protocol_versions(slug,pairing,newcomer_species,version,status,content,digest,source_ids,protocol_id) values($1,$2,$3,$4,'demo_only',$5,$6,$7,$8) on conflict(slug) do update set slug=excluded.slug returning id`, [p.id,p.pairing,p.newcomer_species,p.version,JSON.stringify(p),digest(p),p.source_ids,protocol.id])).rows[0];
   await db.query('insert into protocol_scenarios(protocol_version_id,scenario_id,newcomer_species) select $1,id,$2 from scenario_definitions where demo_protocol_slug=$3 on conflict do nothing',[version.id,p.newcomer_species,p.id]);
   for(const sourceId of p.source_ids){
    const ref=sourceRegister.sources.find(s=>s.id===sourceId);if(!ref)throw new Error(`Missing source ${sourceId}`);
    await db.query("insert into source_references(source_key,title,url,checked_at,license_note) values($1,$2,$3,'2026-09-22',$4) on conflict(source_key) do nothing",[ref.id,ref.title,ref.url,'External provenance link only; no source text copied and no product approval implied.']);
    const row=(await db.query('select id from source_references where source_key=$1',[ref.id])).rows[0];
    await db.query('insert into protocol_sources(protocol_version_id,source_id,use_note) values($1,$2,$3) on conflict do nothing',[version.id,row.id,'Demo provenance link only; not an approval or authorization for practical guidance.']);
   }
  }
 });
}
export async function provisionDemo(actor: Actor, fixture: FixtureName, retentionAcknowledged=false) {
 if(process.env.DENLUMI_DEMO_ENABLED !== 'true') throw new DomainError('DEMO_DISABLED',403);
 return transaction(async db => {
  await assertSession(db,actor);
  await db.query('select pg_advisory_xact_lock(hashtext($1))',[actor.userId]);
  const existing = await db.query('select 1 from households where owner_id=$1',[actor.userId]);
  if (existing.rowCount) throw new DomainError('DEMO_ALREADY_CREATED');
  const c = configurations[fixture], householdId=randomUUID(), caseId=randomUUID(), planId=randomUUID();
  const p = (await db.query('select * from protocol_versions where slug=$1',[c.protocol])).rows[0];
  if (!p || p.status!=='demo_only') throw new DomainError('PROTOCOL_UNAVAILABLE');
  await db.query("insert into households(id,owner_id,nickname,demo_retention_acknowledged_at,demo_purge_at) values($1,$2,$3,case when $4 then now() else null end,case when $4 then now()+interval '7 days' else null end)",[householdId,actor.userId,'The sample home',retentionAcknowledged]);
  const deletionRecoveryCode=retentionAcknowledged?`d1.${householdId}.${randomBytes(32).toString('base64url')}`:null;
  if(deletionRecoveryCode)await db.query(
   'insert into private.demo_deletion_codes(household_id,owner_id,code_hash,expires_at) select id,owner_id,$2,demo_purge_at from households where id=$1',
   [householdId,createHash('sha256').update(deletionRecoveryCode).digest('hex')]);
  await db.query("insert into memberships(household_id,profile_id,role,accepted_at) values($1,$2,'owner',now())",[householdId,actor.userId]);
  const scenario=(await db.query('select expected_demo_route from scenario_definitions where id=$1',[c.code])).rows[0];
  await db.query('insert into cases(id,household_id,title,scenario_code,support_level,support_reason_code,routed_at) values($1,$2,$3,$4,$5,$6,now())',[caseId,householdId,c.title,c.code,scenario.expected_demo_route,'SCENARIO_DEFAULT']);
  const participants=[];
  for (const [name,species,role] of c.pets) {
   const id=randomUUID(); participants.push({id,role});
   await db.query('insert into pets(id,household_id,nickname,species) values($1,$2,$3,$4)',[id,householdId,name,species]);
   await db.query('insert into case_pets(household_id,case_id,pet_id,role) values($1,$2,$3,$4)',[householdId,caseId,id,role]);
  }
  const petIds=participants.map(p=>p.id).sort();
  for(let a=0;a<petIds.length;a++)for(let b=a+1;b<petIds.length;b++){
   const pair=(await db.query('insert into pet_pairs(household_id,pet_a_id,pet_b_id) values($1,$2,$3) returning id',[householdId,petIds[a],petIds[b]])).rows[0];
   await db.query("insert into pair_contexts(household_id,case_id,pair_id,context_key) values($1,$2,$3,'home')",[householdId,caseId,pair.id]);
  }
  const planDigest=digest({caseId,participants,protocol:p.digest});
  await db.query('insert into plan_revisions(id,household_id,case_id,protocol_version_id,safety_epoch,home_version,participant_digest,digest,protocol_digest,intake_digest,home_digest) values($1,$2,$3,$4,1,1,$5,$6,$7,$8,$9)',[planId,householdId,caseId,p.id,digest(participants),planDigest,p.digest,digest({schema_version:'1',answers:{}}),digest([])]);
  const body={schema_version:'1',summary:'Fictional household loaded. Review the named pets and current record. No practical animal guidance is approved.',physical_state_verified:false};
  await db.query("insert into handovers(household_id,case_id,safety_epoch,body,digest,status,published_at,actor_id,plan_revision_id) values($1,$2,1,$3,$4,'published',now(),$5,$6)",[householdId,caseId,JSON.stringify(body),digest(body),actor.userId,planId]);
  return {householdId,caseId,planId,deletionRecoveryCode};
 });
}
