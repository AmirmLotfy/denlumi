import { pool } from '../packages/domain/db';

// One-shot local maintenance for transient private-view rows only. An expired
// row remains a denial marker while its original auth session is still fresh.
const target=new URL(process.env.DATABASE_URL??'');
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='55432')throw Error('Unlinked local Supabase database required');
const args=process.argv.slice(2);
const apply=args.length===5&&args[0]==='--apply'&&args[1]==='--grant-id'&&args[3]==='--limit';
const scopedDryRun=args.length===2&&args[0]==='--grant-id';
if(args.length&&!apply&&!scopedDryRun)throw Error('Use no arguments, --grant-id <uuid>, or --apply --grant-id <uuid> --limit <1-100>');
const grantId=apply?args[2]:scopedDryRun?args[1]:null;
if(grantId&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(grantId))throw Error('Exact grant UUID required');
const limit=apply?Number(args[4]):0;
if(apply&&(!Number.isInteger(limit)||limit<1||limit>100))throw Error('Limit must be an integer from 1 to 100');

const fresh=`exists(select 1 from auth.sessions s where s.id=r.session_id and s.created_at>now()-interval '30 minutes' and (s.not_after is null or s.not_after>now()))`;
try{
 if(!apply){
  const row=(await pool.query(`select
   count(*) filter(where r.expires_at<=now())::int expired,
   count(*) filter(where r.expires_at<=now() and ${fresh})::int held_for_fresh_session,
   count(*) filter(where r.expires_at<=now() and not ${fresh})::int eligible
   from private.record_view_sessions r where ($1::uuid is null or r.grant_id=$1)`,[grantId])).rows[0];
  console.log(JSON.stringify({mode:'dry_run',environment:'unlinked localhost only',scope:grantId?'exact_grant':'all',...row,private_content_or_ids_emitted:false}));
 }else{
  const row=(await pool.query(`with chosen as (
   select r.grant_id,r.session_id from private.record_view_sessions r
   where r.grant_id=$1 and r.expires_at<=now() and not ${fresh}
   order by r.expires_at,r.grant_id,r.session_id limit $2 for update of r skip locked
  ), removed as (
   delete from private.record_view_sessions r using chosen c
   where r.grant_id=c.grant_id and r.session_id=c.session_id
    and r.expires_at<=now() and not ${fresh}
   returning 1
  ) select count(*)::int removed from removed`,[grantId,limit])).rows[0];
  console.log(JSON.stringify({mode:'bounded_apply',environment:'unlinked localhost only',scope:'exact_grant',limit,removed:row.removed,private_content_or_ids_emitted:false}));
 }
}finally{await pool.end();}
