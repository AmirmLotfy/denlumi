import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { testHousehold } from '../tests/helpers';
import { pool } from '../packages/domain/db';

const count=12,uiMs:number[]=[],handlerMs:number[]=[];
const percentile=(values:number[],p:number)=>values.toSorted((a,b)=>a-b)[Math.ceil(p*values.length)-1];
const browser=await chromium.launch({channel:'chrome'});
try{
 const home=await testHousehold('single_cat');
 for(let i=0;i<count;i++){
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3400'});
  try{
   await context.addCookies([{name:'denlumi_session',value:home.owner.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'}]);
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Stop guidance'}).waitFor();
   await context.setOffline(true);
   const ui=await page.evaluate(async()=>{
    const button=document.querySelector<HTMLButtonElement>('.stopbar .stop-button');
    const heading=document.querySelector<HTMLElement>('.stopbar strong');
    if(!button||!heading)throw Error('STOP_CONTROL_MISSING');
    return new Promise<number>((resolve,reject)=>{
     const start=performance.now();
     const timeout=setTimeout(()=>{observer.disconnect();reject(Error('STOP_UI_TIMEOUT'));},2000);
     const observer=new MutationObserver(()=>{if(heading.textContent?.includes('Stopped on this device.')){clearTimeout(timeout);observer.disconnect();resolve(performance.now()-start);}});
     observer.observe(heading,{childList:true,subtree:true,characterData:true});button.click();
     if(heading.textContent?.includes('Stopped on this device.')){clearTimeout(timeout);observer.disconnect();resolve(performance.now()-start);}
    });
   });
   const text=await page.locator('details.evidence').textContent();
   const handler=Number(text?.match(/Local stop handler:\s*([0-9.]+) ms/)?.[1]);
   if(!Number.isFinite(handler))throw Error('STOP_HANDLER_METRIC_MISSING');
   if(!await page.getByText('Household update not yet synchronized.').isVisible())throw Error('OFFLINE_STATUS_MISSING');
   uiMs.push(Math.round(ui*10)/10);handlerMs.push(handler);
  }finally{await context.close();}
 }
 const evidence={checked_at:new Date().toISOString(),environment:'Local production Next.js, Chrome, fictional single-cat household, network put offline before every synthetic button activation',sample_size:count,handler_ms:{median:percentile(handlerMs,.5),p95:percentile(handlerMs,.95),max:Math.max(...handlerMs),target_p95_ms:100},stopped_ui_feedback_ms:{median:percentile(uiMs,.5),p95:percentile(uiMs,.95),max:Math.max(...uiMs)},result:percentile(handlerMs,.95)<100?'PASS for measured local Chrome handler':'TARGET_NOT_MET',limits:'Synthetic browser activation, one desktop host and one Chrome build. Handler timing wraps the synchronous local cancel/latch function; UI timing ends at the stopped DOM update. No physical device, native browser zoom, audio output, human perception, production network or cross-device p95 measured. The offline server sync remains pending by design.'};
 await writeFile('evidence/phase9/stop-latency.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({result:evidence.result,handler_p95_ms:evidence.handler_ms.p95,ui_p95_ms:evidence.stopped_ui_feedback_ms.p95,samples:count}));
}finally{await browser.close();await pool.end();}
