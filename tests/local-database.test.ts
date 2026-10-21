import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const base='postgresql://fictional:fictional@127.0.0.1:55432/postgres';
function admission(url:string|undefined){const env:NodeJS.ProcessEnv={...process.env,PGHOST:'remote.invalid',PGPORT:'6543'};if(url===undefined)delete env.DATABASE_URL;else env.DATABASE_URL=url;
 return spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',"const {pool}=await import('./packages/domain/db.ts');await pool.end();console.log('POOL_CONSTRUCTED');"],{env,encoding:'utf8',timeout:10000});}
for(const suffix of ['?host=remote.invalid','?port=6543','?database=other','?user=other','?sslmode=require','#fragment'])test('database URL refuses ambiguous connection override '+suffix,()=>{
 const result=admission(base+suffix);assert.notEqual(result.status,0);assert.match(result.stderr,/LOCAL_DENLUMI_DATABASE_REQUIRED/);assert.doesNotMatch(result.stdout,/POOL_CONSTRUCTED/);
});
test('missing URL cannot fall back to ambient remote PostgreSQL settings',()=>{const result=admission(undefined);assert.notEqual(result.status,0);assert.match(result.stderr,/LOCAL_DENLUMI_DATABASE_REQUIRED/);});
test('explicit isolated localhost URLs construct pools without contacting a server',()=>{for(const value of [base,base.replace('127.0.0.1','localhost'),base.replace('postgresql:','postgres:')]){const result=admission(value);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/POOL_CONSTRUCTED/);}});
