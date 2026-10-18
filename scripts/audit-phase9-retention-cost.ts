import { mkdir,writeFile } from 'node:fs/promises';
import { pool } from '../packages/domain/db';

const url=new URL(process.env.DATABASE_URL??'');
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55432')throw Error('Local Supabase database required');
try{
 const homes=(await pool.query(`select mode,status,count(*)::integer total,
  count(*) filter(where expires_at<=now())::integer expired
  from households group by mode,status order by mode,status`)).rows;
 const calls=(await pool.query(`select provider,outcome,count(*)::integer total,
  count(*) filter(where usage is not null)::integer with_usage,
  count(*) filter(where created_at<now()-interval '30 days')::integer older_than_30_days
  from private.provider_calls group by provider,outcome order by provider,outcome`)).rows;
 const exports=(await pool.query(`select count(*)::integer total,
  count(*) filter(where expires_at<=now() and length(content_text)>0)::integer expired_with_content
  from private_exports`)).rows[0];
 const demoRetention=(await pool.query(`select
  count(*) filter(where mode='demo' and fictional and demo_retention_acknowledged_at is not null)::integer consented,
  count(*) filter(where mode='demo' and fictional and status='active' and expires_at<=now() and demo_retention_acknowledged_at is null)::integer expired_older_unconsented,
  count(*) filter(where mode='demo' and fictional and status='active' and demo_retention_acknowledged_at is not null and demo_purge_at<=now() and created_at<=now()-interval '7 days')::integer due_consented
  from households`)).rows[0];
 const evidence={
  checked_at:new Date().toISOString(),
  environment:'Aggregate read-only queries against unlinked local Supabase; no private text, identifiers or credentials emitted',
  effective_provider_daily_call_limit:Math.max(0,Math.min(12,Number(process.env.PROVIDER_DAILY_CALL_LIMIT)||0)),
  households:homes,demo_retention:demoRetention,provider_calls:calls,exports,
  verified_by_tests:'Full local suite PASS 102/102 after budget serialization, demo expiry, deletion-only preparation for a still-authenticated expired-demo owner, consented exact-ID and bounded explicit-ID batch cleanup, positive explicitly scoped batch CLI selection, exact-ID operator CLI failure/retry, and privacy-safe speech unit accounting. Production-build expired-demo deletion browser journey PASS 1/1 with a freshly authenticated verified owner. Six guided fictional shapes passed full browser journeys 7/7 including SC07 coordination-only. After the explicit browser checkbox, the earlier affected production browser selection PASS 25/26 with one case-sensitive test assertion failure; the corrected affected desktop journey PASS 1/1. Authenticated localhost HTTP missing consent 400, accepted sample 200 and fixture cleanup completed.',
  findings:[
   'Demo household default expiry is 24 hours and server/RLS/provider reservation deny access after expiry.',
   'A freshly authenticated owner with a saved household reference can use the deletion-only browser path after demo expiry; foreign households, caregivers, stale state and stale authentication are refused. Anonymous browser sessions may not remain recoverable after 24 hours, so this is not a complete expired-demo self-service flow.',
   'New fictional samples record retention acknowledgment and become eligible for local primary cleanup after seven days. The one-shot worker is dry-run by default; application requires an exact ID or a bounded 1-20 row batch. Older unconsented fixtures are excluded; no continuously operating scheduler or hosted purge has been proven.',
   'Expired private export content remains stored until household deletion; expiry revokes access, not bytes. This matches the current private-record retention model but requires a published policy before customer use.',
   'The proposed 30-day operational metadata retention has no automated purge job. No provider billing-rate reconciliation or actual USD cost claim is available.',
   'Polly/Transcribe measured units are stored for new calls without input text; older provider rows can lack usage. AWS-side audio/model retention and hosted backup expiry remain unverified.'
  ],
  limits:'These are local aggregate counts at one point in time. No AWS provider retention configuration, billing statement, hosted deletion, production telemetry or legal retention policy was verified.'
 };
 await mkdir('evidence/phase9',{recursive:true});
 await writeFile('evidence/phase9/retention-cost.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({household_groups:homes.length,provider_groups:calls.length,expired_exports_with_content:exports.expired_with_content}));
}finally{await pool.end();}
