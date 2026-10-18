import pg from 'pg';
// This project has no authorized hosted Supabase environment.
if(process.env.DATABASE_URL){const target=new URL(process.env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='55432')throw new Error('LOCAL_DENLUMI_DATABASE_REQUIRED');}
const globalDb = globalThis as unknown as { denlumiPool?: pg.Pool };
export const pool = globalDb.denlumiPool ?? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, statement_timeout: 8000, idle_in_transaction_session_timeout: 10000 });
if (process.env.NODE_ENV !== 'production') globalDb.denlumiPool = pool;
export type Actor = { userId: string; sessionId: string };
export class DomainError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
export async function transaction<T>(fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try { await db.query('begin'); const value = await fn(db); await db.query('commit'); return value; }
  catch (e) { await db.query('rollback'); throw e; }
  finally { db.release(); }
}
export async function assertSession(db: pg.PoolClient, actor: Actor) {
  const { rows } = await db.query("select 1 from auth.sessions s join public.profiles p on p.id=s.user_id where s.id=$1 and s.user_id=$2 and p.status='active' and (s.not_after is null or s.not_after>now())", [actor.sessionId,actor.userId]);
  if (!rows.length) throw new DomainError('UNAUTHORIZED',401);
}
export async function readAs<T>(actor: Actor, fn: (db: pg.PoolClient) => Promise<T>) {
  return transaction(async db => {
    await assertSession(db,actor);
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor.userId]);
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor.userId,session_id:actor.sessionId})]);
    return fn(db);
  });
}
