import { readFile,readdir } from 'node:fs/promises';
import { pool } from '../packages/domain/db';
import { seedProtocols } from '../packages/content/fixtures';
const url = new URL(process.env.DATABASE_URL!);
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55432')throw new Error('Local Denlumi DB only');
const exists = await pool.query("select to_regclass('public.households') present");
if(!exists.rows[0].present) {
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
 for(const f of files)await pool.query(await readFile(`supabase/migrations/${f}`,'utf8'));
}
await seedProtocols();
const phase1=await pool.query("select to_regclass('public.pet_pairs') present");
if(!phase1.rows[0].present)throw new Error('Apply pending local migrations with supabase migration up --local first');
console.log('Phase 5 local schema and seven demo_only protocols present. No approvals seeded.');
await pool.end();
