import { mkdir,writeFile } from 'node:fs/promises';
import { pool } from '../packages/domain/db';
import { runWithdrawalDrill } from '../tests/withdrawal-fixture';
try{
 const result=await runWithdrawalDrill();
 const evidence={checked_at:new Date().toISOString(),result:'PASS',environment:'Bounded fictional localhost Auth/Postgres drill; task-owned exact-species demo_only protocol clones',...result,checks:['Revocation disables fresh reads and preflight before worker reconciliation','Nine affected reviewed plans across cat-cat, dog-dog and cat-dog become stale','Six active/interrupted sessions pause; three never-started plans invalidate','Nine old-epoch queued progression events and dependent tasks cancel','Historical plan/session protocol bindings and digests remain intact','One unaffected active control and one revoked out-of-scope control remain unchanged','Stale preflight/start denied after reconciliation','Scoped replay adds no epochs, holds, handovers or audit events','Shared bundled protocol versions remain unrevoked'],limits:'Fictional bounded local software evidence only. No real animals, qualified content review, customer data, hosted services, provider calls, notification delivery, production scale, full-platform operational acceptance or purge. Companion regression tests separately inject an application failure and exercise lock ordering.'};
 await mkdir('evidence/phase9',{recursive:true});await writeFile('evidence/phase9/withdrawal-operations.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({result:evidence.result,...result}));
}finally{await pool.end();}
