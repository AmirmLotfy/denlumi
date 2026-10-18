import assert from 'node:assert/strict';
import { spawn,type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium,expect } from '@playwright/test';
import { testHousehold } from '../tests/helpers';

const origin=process.env.APP_ORIGIN;
if(origin!=='http://127.0.0.1:3400'||!process.env.DATABASE_URL)throw Error('Isolated local app and database required');
try{await fetch(origin,{signal:AbortSignal.timeout(500)});throw Error('Port 3400 is already occupied; no server was started');}
catch(error){if((error as Error).message.includes('already occupied'))throw error;}
const missing=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(missing.hostname)||missing.port!=='55432')throw Error('Local Supabase database required');
missing.pathname=`/denlumi_absent_${randomUUID().replaceAll('-','')}`;
const home=await testHousehold('single_cat');
let server:ChildProcess|null=null;
const start=async(databaseUrl:string)=>{
 server=spawn(process.execPath,['../../node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3400'],{
  cwd:'apps/web',env:{...process.env,DATABASE_URL:databaseUrl},stdio:'ignore'
 });
 for(let attempt=0;attempt<60;attempt++){
  if(server.exitCode!==null)throw Error('Task-owned app exited before readiness');
  try{const response=await fetch(origin,{signal:AbortSignal.timeout(500)});if(response.ok)return;}
  catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error('Task-owned app did not become ready');
};
const stop=async()=>{
 const owned=server;server=null;if(!owned)return;
 if(owned.exitCode===null){
  owned.kill('SIGTERM');
  await Promise.race([new Promise<void>(resolve=>owned.once('exit',()=>resolve())),new Promise<void>(resolve=>setTimeout(resolve,5000))]);
  if(owned.exitCode===null){owned.kill('SIGKILL');await new Promise<void>(resolve=>owned.once('exit',()=>resolve()));}
 }
};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 await start(process.env.DATABASE_URL);
 const page=await browser.newPage({baseURL:origin});
 await page.context().addCookies([{name:'denlumi_session',value:home.owner.token,url:origin,httpOnly:true,sameSite:'Strict'}]);
 await page.goto('/');
 const ask=async()=>{
  const responseWait=page.waitForResponse(response=>response.url()===`${origin}/api/assistant/turn`&&response.request().method()==='POST',{timeout:15000});
  await page.getByRole('button',{name:'Read current plan'}).click();
  return responseWait;
 };
 assert.equal((await ask()).status(),200);
 await expect(page.locator('.companion .reply')).toBeVisible();
 await stop();
 await start(missing.toString());
 assert.equal((await ask()).status(),503);
 await expect(page.locator('main .error[role="alert"]')).toContainText('Current-state retrieval failed: SERVICE_UNAVAILABLE');
 await expect(page.locator('.companion .reply')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
 await stop();
 await start(process.env.DATABASE_URL);
 assert.equal((await ask()).status(),200);
 await expect(page.locator('.companion .reply')).toBeVisible();
 await expect(page.locator('main .error[role="alert"]')).toHaveCount(0);
 const evidence={checked_at:new Date().toISOString(),environment:'One local Chrome browser session; task-owned production Next.js process restarted against valid, nonexistent, then valid local Postgres database name; shared Supabase service never stopped',result:'PASS',checks:['Valid local current-plan turn returned 200','App connection to nonexistent local database returned 503 and hid old reply','Local Stop remained visible','Restart with valid local database returned 200 and restored a fresh reply'],limits:'Real app-to-Postgres database-selection failure, not a database-service outage, hosted restore, production failover, provider outage or supported-device test. No customer records or remote Supabase resources used.'};
 await mkdir('evidence/phase9',{recursive:true});
 await writeFile('evidence/phase9/db-recovery.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({result:evidence.result,checks:evidence.checks.length}));
}finally{await browser.close();await stop();}
