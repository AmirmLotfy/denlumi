import { pool } from '../packages/domain/db';
import { cleanupDueDemoHousehold,cleanupDueDemoHouseholds } from '../packages/domain/records';

// Operator tool for the unlinked local stack. A dry run is the default;
// mutation requires either one exact ID or an explicit 1–20 row limit.
// A batch may be restricted to explicit IDs so local drills never sweep unrelated fixtures.
const args=process.argv.slice(2),apply=args.includes('--apply'),idAt=args.indexOf('--household-id'),limitAt=args.indexOf('--limit'),idsAt=args.indexOf('--household-ids');
const householdId=idAt>=0?args[idAt+1]:null,limitText=limitAt>=0?args[limitAt+1]:null,idsText=idsAt>=0?args[idsAt+1]:null;
const expectedLength=(apply?1:0)+(idAt>=0?2:0)+(limitAt>=0?2:0)+(idsAt>=0?2:0);
if(args.length!==expectedLength||idAt>=0&&(limitAt>=0||idsAt>=0)||idsAt>=0&&limitAt<0||!apply&&(householdId||limitText||idsText)||apply&&!householdId&&!limitText)throw Error('Use no arguments for dry run, --apply --household-id <uuid>, or --apply --limit <1-20> [--household-ids <comma-separated-uuids>]');
const limit=limitText===null?null:Number(limitText);
if(limit!==null&&(!Number.isInteger(limit)||limit<1||limit>20))throw Error('Batch limit must be an integer from 1 to 20');
const scopedIds=idsText===null?null:idsText.split(',');
if(scopedIds&&(scopedIds.length<1||scopedIds.length>20||new Set(scopedIds).size!==scopedIds.length||scopedIds.some(id=>!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))))throw Error('Explicit batch scope must contain 1-20 unique UUIDs');
const target=new URL(process.env.DATABASE_URL??'');
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='55432')throw Error('Unlinked local Supabase database required');

try{
 const counts=(await pool.query(`select
  count(*) filter(where mode='demo' and fictional and status='active' and expires_at<=now() and demo_retention_acknowledged_at is not null and demo_purge_at<=now() and created_at<=now()-interval '7 days' and not exists(select 1 from private.deletion_requests d where d.household_id=households.id))::int ready,
  count(*) filter(where mode='demo' and fictional and status='active' and expires_at<=now() and demo_retention_acknowledged_at is null)::int older_unconsented_expired,
  count(*) filter(where mode='demo' and fictional and status='deleting' and exists(select 1 from private.deletion_requests d where d.household_id=households.id and d.idempotency_key='demo-retention-'||households.id::text and d.status='failed'))::int failed_demo_jobs,
  count(*) filter(where mode='demo' and fictional and status='deleting' and exists(select 1 from private.deletion_requests d where d.household_id=households.id and d.idempotency_key='demo-retention-'||households.id::text and d.status='pending'))::int pending_demo_jobs,
  count(*) filter(where mode='demo' and fictional and status='deleting' and exists(select 1 from private.deletion_requests d where d.household_id=households.id and d.idempotency_key='demo-retention-'||households.id::text and d.status='processing' and d.processing_at<now()-interval '2 minutes'))::int stalled_demo_jobs,
  count(*) filter(where mode='demo' and fictional and status='deleting' and exists(select 1 from private.deletion_requests d where d.household_id=households.id and d.idempotency_key='demo-retention-'||households.id::text and d.status='processing' and d.processing_at>=now()-interval '2 minutes'))::int active_processing_demo_jobs
  from households`)).rows[0];
 if(!apply)console.log(JSON.stringify({mode:'dry_run',environment:'unlinked localhost only',...counts,private_content_emitted:false,existing_unconsented_rows_selected:false}));
 else if(householdId){
  const result=await cleanupDueDemoHousehold(householdId!);
  console.log(JSON.stringify({mode:'exact_id_apply',status:result.status,primary_cleanup_verified:result.primary_cleanup_verified,last_error_code:'last_error_code' in result?result.last_error_code:null,private_content_emitted:false}));
  if(result.status==='failed')process.exitCode=1;
 }
 else{
  const candidates=(await pool.query(`select h.id from households h where h.mode='demo' and h.fictional and h.demo_retention_acknowledged_at is not null and h.expires_at<=now() and h.demo_purge_at<=now() and h.created_at<=now()-interval '7 days' and ($2::uuid[] is null or h.id=any($2::uuid[])) and (
   (h.status='active' and not exists(select 1 from private.deletion_requests d where d.household_id=h.id))
   or (h.status='deleting' and exists(select 1 from private.deletion_requests d where d.household_id=h.id and d.idempotency_key='demo-retention-'||h.id::text and (d.status in ('pending','failed') or d.status='processing' and d.processing_at<now()-interval '2 minutes')))
  ) order by h.demo_purge_at,h.id limit $1`,[limit,scopedIds])).rows.map(row=>row.id as string);
  const result=candidates.length?await cleanupDueDemoHouseholds(candidates):{attempted:0,completed:0,failed:0,skipped:0,processing:0};
  console.log(JSON.stringify({mode:'bounded_batch_apply',limit,scope:scopedIds?'explicit_ids':'all_due',...result,private_content_or_ids_emitted:false}));
  if(result.failed||result.processing)process.exitCode=1;
 }
}finally{await pool.end();}
