import { processOutbox } from '../packages/domain/routines';
import { interruptTimedOutSessions,reconcileWithdrawnProtocols } from '../packages/domain/sessions';
import { pool } from '../packages/domain/db';
const url=new URL(process.env.DATABASE_URL!);if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55432')throw new Error('Phase 4/5 worker is local-only in this build');
const minutes=Number(process.env.SESSION_HEARTBEAT_TIMEOUT_MINUTES??'5');if(!Number.isFinite(minutes)||minutes<1)throw new Error('Invalid timeout');
const result={checked_at:new Date().toISOString(),sessions:await interruptTimedOutSessions(new Date(Date.now()-minutes*60_000)),protocols:await reconcileWithdrawnProtocols(),outbox:await processOutbox(50,'success'),scope:'local_internal_only'};
console.log(JSON.stringify(result,null,2));await pool.end();
