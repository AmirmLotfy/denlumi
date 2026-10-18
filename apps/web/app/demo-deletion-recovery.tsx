'use client';

import { useState } from 'react';

type Deletion={status:string;primary_cleanup_verified:boolean;last_error_code:string|null;retention_notice:string};

export function IssuedDemoDeletionCode({code,onDismiss}:{code:string;onDismiss:()=>void}){
 const [copied,setCopied]=useState(false);
 return <section className="panel" aria-labelledby="demo-code-title">
  <h2 id="demo-code-title">Keep a way to delete this sample</h2>
  <p>This fictional household expires after 24 hours. Save the code now if you want to request deletion after access expires, even if this browser loses its session. It works only for this sample, only after expiry, and only before its seven-day cleanup date. Anyone with the code can delete this fictional sample. Denlumi does not save it in your browser after reload.</p>
  <details><summary>Show deletion code</summary><p><code>{code}</code></p>
   <button className="secondary" onClick={()=>void navigator.clipboard.writeText(code).then(()=>setCopied(true)).catch(()=>setCopied(false))}>Copy code</button>
   {copied&&<p role="status">Code copied. Store it privately.</p>}
  </details>
  <button className="text-button" onClick={onDismiss}>I have saved it or do not need it</button>
 </section>;
}

export function RecoverExpiredDemoDeletion({onRecovered}:{onRecovered:()=>void}){
 const [code,setCode]=useState(''),[typed,setTyped]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Deletion|null>(null);
 async function recover(){
  setBusy(true);setError('');setResult(null);
  try{
   const response=await fetch('/api/demo/recover-delete',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,confirm_deletion:true})});
   const value=await response.json();
   if(!response.ok)throw Error(value.error??'RECOVERY_UNAVAILABLE');
   setResult(value as Deletion);
   if(value.status==='completed'){setCode('');setTyped('');setConfirmed(false);onRecovered();}
  }catch(e){setError((e as Error).message==='RECOVERY_UNAVAILABLE'?'This code cannot be used for an expired fictional sample.':`Deletion request unavailable: ${(e as Error).message}.`);}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-labelledby="demo-recover-title" aria-busy={busy}>
  <h2 id="demo-recover-title">Delete an expired fictional sample</h2>
  <p>If you saved its deletion code, you can request local primary cleanup here without reopening the household. The code gives no access to plans, history or guidance. Backup expiry remains unverified.</p>
  <label>Deletion code<input type="password" autoComplete="off" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} disabled={busy}/></label>
  <label>Type DELETE to confirm<input autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)} disabled={busy}/></label>
  <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/> I request deletion of the exact fictional household named by this code.</label>
  <button className="secondary" disabled={busy||!code||typed!=='DELETE'||!confirmed} onClick={()=>void recover()}>{busy?'Checking and deleting…':'Request exact sample deletion'}</button>
  {error&&<p role="alert" className="error">{error}</p>}
  {result&&<div role="status"><p>Household deletion: {result.status}. Primary database cleanup {result.primary_cleanup_verified?'verified':'not yet verified'}.</p>
   {result.last_error_code&&<p>Cleanup failed: {result.last_error_code}. Access stays disabled. Retrying the same code can check and retry the local cleanup.</p>}
   <p className="small">{result.retention_notice}</p>
  </div>}
 </section>;
}
