import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin=process.env.APP_ORIGIN;
if(origin!=='http://127.0.0.1:3400')throw Error('Isolated localhost app required');
const count=12;
const percentile=(values:number[],p:number)=>{
 const sorted=[...values].sort((a,b)=>a-b);
 return Math.round(sorted[Math.ceil(sorted.length*p)-1]*10)/10;
};
const browser=await chromium.launch({channel:'chrome',headless:true});
const samples:number[]=[];
try{
 const page=await browser.newPage({baseURL:origin});
 await page.goto('/');
 await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();await page.getByRole('button',{name:'Open sample household'}).click();
 await page.getByRole('button',{name:'Read current plan'}).waitFor();
 for(let index=0;index<count;index++){
  if(index){await page.getByRole('button',{name:'New conversation'}).click();await page.getByRole('button',{name:'Read current plan'}).waitFor();}
  await page.evaluate(()=>{
   const form=document.querySelector<HTMLFormElement>('.companion form');
   const button=form?.querySelector<HTMLButtonElement>('button.primary');
   if(!form||!button)throw Error('Current-plan form unavailable');
   const target=window as Window & {denlumiFeedback?:Promise<number>};
   target.denlumiFeedback=new Promise<number>((resolve,reject)=>{
    let started=0;
    const observer=new MutationObserver(()=>{
     if(started&&button.textContent?.includes('Retrieving')){
      observer.disconnect();clearTimeout(timeout);resolve(performance.now()-started);
     }
    });
    const timeout=setTimeout(()=>{observer.disconnect();reject(Error('No visible feedback within 2 seconds'));},2000);
    button.addEventListener('click',()=>{started=performance.now();observer.observe(form,{subtree:true,childList:true,characterData:true});},{capture:true,once:true});
   });
  });
  const responseWait=page.waitForResponse(response=>response.url()===`${origin}/api/assistant/turn`&&response.request().method()==='POST',{timeout:15000});
  await page.getByRole('button',{name:'Read current plan'}).click();
  const feedback=await page.evaluate(async()=>await (window as Window & {denlumiFeedback?:Promise<number>}).denlumiFeedback);
  assert.equal(typeof feedback,'number');samples.push(feedback!);
  const response=await responseWait;
  assert.equal(response.status(),200);
  const payload=await response.json();
  assert.equal(payload.provider.status,'not_requested');
  assert.equal(payload.brief.protocol_status,'demo_only');
  assert.ok(payload.trace.some((row:{method:string;tool_name?:string;http_status:number})=>row.method==='tools/call'&&row.tool_name==='get_household_brief'&&row.http_status===200));
  await page.locator('.companion .reply').waitFor();
 }
}finally{await browser.close();}
const p95=percentile(samples,.95);
const evidence={
 checked_at:new Date().toISOString(),
 environment:'Local production Next.js and Supabase, headless Chrome, fictional household, model disabled, 12 serial synthetic browser clicks',
 sample_size:count,
 visible_retrieving_feedback_ms:{median:percentile(samples,.5),p95,max:Math.round(Math.max(...samples)*10)/10,target_ms:1000},
 result:p95<1000?'PASS for measured loading acknowledgment':'TARGET_NOT_MET for measured loading acknowledgment',
 limits:'Measures click-event to visible Retrieving label in one local Chrome build. It does not measure first answer content, spoken feedback, human perception, live Bedrock, supported devices, network latency or the full voice-response target. Each turn used actual authenticated app HTTP and MCP current-state reads; no model request was made.'
};
await mkdir('evidence/phase9',{recursive:true});
await writeFile('evidence/phase9/feedback.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({result:evidence.result,samples:count,p95_ms:p95}));
