// Local application-schema restore drill. Never restores over the running database.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,rm,stat,statfs,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import pg from 'pg';
import {bindState} from '../packages/contracts/phase0';
import {localDatabaseUrl} from '../packages/domain/local-database';
import {pool,assertSession,type Actor} from '../packages/domain/db';
import {testHousehold} from '../tests/helpers';
import {getBrief,recordObservation} from '../packages/domain/state';
const url=localDatabaseUrl(process.env.DATABASE_URL);
if(process.env.SUPABASE_URL!=='http://127.0.0.1:55431')throw Error('Isolated local Auth required');
const work=resolve('.local/p9-operations-2026-10-21');await mkdir(work,{recursive:true,mode:0o700});
const bin=process.env.DENLUMI_PG_BIN;if(!bin)throw Error('Set DENLUMI_PG_BIN to the matching PostgreSQL client bin directory');
const sourceName=decodeURIComponent(url.pathname.slice(1));
const targetName=`denlumi_p9_restore_${randomUUID().replaceAll('-','')}`;
const ident=(value:string)=>'"'+value.replaceAll('"','""')+'"';
const env:NodeJS.ProcessEnv={...process.env,PGHOST:url.hostname,PGPORT:url.port,PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:sourceName,PGCONNECT_TIMEOUT:'5'};
// Prevent inherited libpq options/SSL service files from silently selecting a different target.
for(const key of ['PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGHOSTADDR'])delete env[key];
const tool=async(name:string,args:string[],database=sourceName)=>{
 const child=spawn(join(bin,name),args,{env:{...env,PGDATABASE:database},stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=String(chunk));child.stderr.on('data',chunk=>stderr+=String(chunk));
 const code=await new Promise<number|null>((done,reject)=>{child.once('error',reject);child.once('exit',done);});
 if(code!==0){try{await writeFile(join(work,`${name}-failure-${Date.now()}.log`),stderr,{mode:0o600});}catch{console.error(`${name} failed; protected diagnostic could not be written`);}throw Error(`${name} failed; inspect protected local diagnostics if available`);}
 return stdout.trim();
};
async function rolledBack<T>(db:pg.PoolClient,run:()=>Promise<T>):Promise<T>{
 let primary:unknown;
 try{return await run();}catch(error){primary=error;throw error;}finally{
  let rollbackError:Error|undefined;
  try{await db.query('rollback');}catch(error){rollbackError=error instanceof Error?error:Error('Rollback connection lost');}
  finally{db.release(rollbackError);}
  if(rollbackError&&!primary)throw rollbackError;
 }
}
let primaryError:unknown,evidence:Record<string,unknown>|undefined;
let scratch:pg.Pool|undefined,temp:string|undefined,created=false,cleaned=false,dumpBytes=0,tableCount=0,rlsCount=0,policyCount=0,canaryChecks=0;
const begin=Date.now();
try{
 const server=(await pool.query("select current_setting('server_version') version,pg_database_size(current_database())::bigint bytes")).rows[0];
 const dumpVersion=await tool('pg_dump',['--version']),restoreVersion=await tool('pg_restore',['--version']);
 const major=String(server.version).split('.')[0];assert.match(dumpVersion,new RegExp(`PostgreSQL\\) ${major}\\.`));assert.match(restoreVersion,new RegExp(`PostgreSQL\\) ${major}\\.`));
 const space=await statfs(work);if(Number(space.bavail)*Number(space.bsize)<Math.max(1024**3,Number(server.bytes)*4))throw Error('Restore capacity admission failed; nothing copied');
 const first=await testHousehold('cat_cat'),other=await testHousehold('cat_dog');
 const brief=await getBrief(first.owner.actor,first.householdId);const firstPets=brief.pets;
 const marker=`Fictional restore canary ${randomUUID()}: uncertainty remains an attributed report.`;
 await recordObservation(first.owner.actor,{...bindState(brief),raw_report:marker,actor_pet_id:firstPets[0].id,target_pet_id:firstPets[1].id,assertion:'uncertain',source_kind:'typed',observed_at:null},randomUUID());
 temp=await mkdtemp(join(work,'restore-private-'));await chmod(temp,0o700);const archive=join(temp,'application.dump');
 const snapshot=await pool.connect();let counts:{schema:string;name:string;n:number;rls:boolean}[]=[],policies:unknown;
 try{
  await snapshot.query("begin isolation level repeatable read read only;set local idle_in_transaction_session_timeout='60s'");
  const id=(await snapshot.query('select pg_export_snapshot() snapshot')).rows[0].snapshot;
  const tables=(await snapshot.query("select n.nspname schema,c.relname name,c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth') and c.relkind='r' order by 1,2")).rows;
  for(const t of tables)counts.push({...t,n:Number((await snapshot.query(`select count(*)::bigint n from ${ident(t.schema)}.${ident(t.name)}`)).rows[0].n)});
  policies=(await snapshot.query("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','private','auth') order by 1,2,3")).rows;
  await tool('pg_dump',['--format=custom','--schema=public','--schema=private','--schema=auth','--no-publications','--no-subscriptions',`--snapshot=${id}`,`--file=${archive}`]);
  await chmod(archive,0o600);assert.equal((await stat(archive)).mode&0o777,0o600);dumpBytes=(await stat(archive)).size;
  await snapshot.query('commit');
 }catch(error){try{await snapshot.query('rollback');}catch{snapshot.release(true);throw error;}snapshot.release();throw error;}
 snapshot.release();
 assert.ok(targetName.startsWith('denlumi_p9_restore_')&&targetName!==sourceName);
 await pool.query(`create database ${ident(targetName)} template template0`);created=true;
 const destination=new URL(url);destination.pathname='/'+targetName;scratch=new pg.Pool({connectionString:destination.href,max:2,statement_timeout:8000});
 assert.equal((await scratch.query('select current_database() n')).rows[0].n,targetName);
 // Extension objects are not included by a schema-selected dump. Preserve the
 // same-cluster dependency explicitly; auxiliary services/cluster roles are out of scope.
 await scratch.query('drop schema public; create schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions; grant usage on schema extensions to anon,authenticated,service_role');
 // Original service owners/default privileges require platform role administration.
 // Preserve object ACLs and RLS, while explicitly excluding only DEFAULT ACL entries.
 const toc=await tool('pg_restore',['--list',archive]);
 const excludedDefaultAcl=toc.split('\n').filter(line=>!line.startsWith(';')&&/\bDEFAULT ACL\b/.test(line)).length;
 const restoreList=join(temp,'application-restore.list');
 await writeFile(restoreList,toc.split('\n').filter(line=>line.startsWith(';')||!/\bDEFAULT ACL\b/.test(line)).join('\n')+'\n',{mode:0o600});
 await tool('pg_restore',['--exit-on-error','--single-transaction','--no-owner',`--use-list=${restoreList}`,`--dbname=${targetName}`,archive],targetName);
 const restoredTables=(await scratch.query("select n.nspname schema,c.relname name,c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth') and c.relkind='r' order by 1,2")).rows;
 assert.deepEqual(restoredTables,counts.map(({schema,name,rls})=>({schema,name,rls})));
 for(const t of counts)assert.equal(Number((await scratch.query(`select count(*)::bigint n from ${ident(t.schema)}.${ident(t.name)}`)).rows[0].n),t.n);
 const restoredPolicies=(await scratch.query("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','private','auth') order by 1,2,3")).rows;assert.deepEqual(restoredPolicies,policies);
 tableCount=counts.length;rlsCount=counts.filter(t=>t.rls).length;policyCount=restoredPolicies.length;
 async function asActor(actor:Actor){
  const db=await scratch!.connect();await rolledBack(db,async()=>{await db.query('begin');await assertSession(db,actor);await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[actor.userId,JSON.stringify({sub:actor.userId,session_id:actor.sessionId})]);
   assert.equal((await db.query('select id from public.households where id=$1',[first.householdId])).rowCount,1);canaryChecks++;
   assert.equal((await db.query('select id from public.households where id=$1',[other.householdId])).rowCount,0);canaryChecks++;
   const observation=(await db.query('select raw_report,assertion,actor_pet_id,target_pet_id,reporter_id,source_kind from public.observations where household_id=$1',[first.householdId])).rows[0];
   assert.equal(observation.raw_report,marker);assert.equal(observation.assertion,'uncertain');assert.equal(observation.reporter_id,first.owner.actor.userId);assert.equal(observation.actor_pet_id,firstPets[0].id);assert.equal(observation.target_pet_id,firstPets[1].id);assert.equal(observation.source_kind,'typed');canaryChecks++;
  });
 }
 await asActor(first.owner.actor);await asActor(first.caregiver.actor);
 const expired=await scratch.connect();await rolledBack(expired,async()=>{await expired.query('begin');await expired.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[first.owner.actor.sessionId]);await assert.rejects(assertSession(expired,first.owner.actor),{code:'UNAUTHORIZED'});canaryChecks++;});
 const anonymous=await scratch.connect();await rolledBack(anonymous,async()=>{await anonymous.query('begin;set local role anon');await assert.rejects(anonymous.query('select * from private.idempotency'),(error:any)=>error.code==='42501');canaryChecks++;});
 await scratch.end();scratch=undefined;await pool.query(`drop database ${ident(targetName)}`);created=false;
 await rm(temp,{recursive:true,force:true});temp=undefined;cleaned=true;
 evidence={checked_at:new Date().toISOString(),result:'PASS_APPLICATION_SCHEMAS_ONLY',scope:'Current localhost application public/private/auth schema snapshot restored to a new task-owned database in the same native PostgreSQL cluster. Only task-created fictional canaries were examined for content.',server_version:server.version,client_versions:{pg_dump:dumpVersion,pg_restore:restoreVersion},snapshot_consistent:true,ownership:'Objects remapped to the existing restore operator; original Supabase Auth/service ownership is not reproduced',excluded_default_privilege_entries:excludedDefaultAcl,privileges:'Existing object ACLs restored; future-object default privilege bootstrap is excluded and requires a separate platform recovery runbook',matched_tables:tableCount,rls_enabled_tables:rlsCount,matched_policies:policyCount,canary_checks:canaryChecks,archive_bytes:dumpBytes,duration_ms:Date.now()-begin,cleanup:{scratch_database_removed:cleaned,private_archive_removed:cleaned,source_database_untouched_except_new_fictional_canaries:true},limits:'Snapshot may include existing local fixture/live-mode rows; all bytes stayed in mode0700/0600 ignored local storage and were removed. No source restore/delete, customer data disclosure, Auth HTTP service replay, full Supabase service/cluster-role recovery, hosted backup expiry, point-in-time recovery, historical old-database recovery or production RTO is established.'};

}catch(error){primaryError=error;throw error;}finally{
 const failures:string[]=[];
 if(scratch)try{await scratch.end();}catch{failures.push('scratch_pool_close');}
 if(created)try{assert.match(targetName,/^denlumi_p9_restore_[a-f0-9]{32}$/);assert.notEqual(targetName,sourceName);await pool.query(`drop database ${ident(targetName)}`);created=false;}catch{failures.push('scratch_database_drop');}
 if(temp)try{await rm(temp,{recursive:true,force:true});temp=undefined;}catch{failures.push('private_archive_remove');}
 try{await pool.end();}catch{failures.push('source_pool_close');}
 if(failures.length){
  const recovery=join(work,`restore-cleanup-recovery-${Date.now()}.json`);
  try{await writeFile(recovery,JSON.stringify({failures,scratch_database:created?targetName:null,private_directory:temp??null,local_host:url.hostname,local_port:url.port,source_database_must_not_be_changed:sourceName,primary_error_preserved:!!primaryError},null,2)+'\n',{mode:0o600});}
  catch{console.error('Restore cleanup diagnostic write failed; task-owned recovery targets:',JSON.stringify({failures,scratch_database:created?targetName:null,private_directory:temp??null}));}
  if(primaryError)console.error('Restore cleanup incomplete; inspect protected recovery packet or stderr targets.');
  else throw Error('Restore cleanup incomplete; inspect protected recovery packet or stderr targets.');
 }
}


if(!evidence)throw Error('Restore evidence missing');
await mkdir('evidence/phase9',{recursive:true});await writeFile('evidence/phase9/application-restore-2026-10-21.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
