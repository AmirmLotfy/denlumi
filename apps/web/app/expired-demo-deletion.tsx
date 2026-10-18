'use client';

import { useEffect,useRef,useState } from 'react';

type Prepared={household_id:string;expected_state_version:number;expected_safety_epoch:number;expired:true;deletion_only:true};
type Deletion={request_id:string;status:string;primary_cleanup_verified:boolean;last_error_code:string|null;retention_notice:string};

async function record<T>(payload:unknown,key?:string):Promise<T>{
 const response=await fetch('/api/records',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(payload)});
 const value=await response.json();if(!response.ok)throw new Error(value.error??'REQUEST_FAILED');return value as T;
}

/** Deletion-only access to an expired fictional demo; ordinary records remain unavailable. */
export default function ExpiredDemoDeletion({householdId,onChanged,onForget}:{householdId:string;onChanged:()=>void;onForget:()=>void}){
 const [prepared,setPrepared]=useState<Prepared|null>(null),[deletion,setDeletion]=useState<Deletion|null>(null);
 const [confirmed,setConfirmed]=useState(false),[typed,setTyped]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const key=useRef<string|null>(null),storageKey=`denlumi-deletion-${householdId}`;
 useEffect(()=>{let active=true;setPrepared(null);setDeletion(null);setError('');setBusy(true);
  void (async()=>{const saved=sessionStorage.getItem(storageKey);
   if(saved){const status=await record<Deletion>({action:'delete_status',request_id:saved});if(active)setDeletion(status);}
   else{const result=await record<Prepared>({action:'delete_prepare',household_id:householdId});if(active)setPrepared(result);}
  })().catch(e=>{if(active)setError((e as Error).message);}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[householdId,storageKey]);
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function requestDeletion(){if(!prepared||!confirmed||typed!=='DELETE')return;
  key.current??=crypto.randomUUID();
  const result=await record<Deletion>({action:'delete_request',input:{household_id:householdId,expected_state_version:prepared.expected_state_version,expected_safety_epoch:prepared.expected_safety_epoch,confirm_household_deletion:true}},key.current);
  sessionStorage.setItem(storageKey,result.request_id);setPrepared(null);setDeletion(result);onChanged();
 }
 return <section className="panel" aria-labelledby="expired-delete-title" aria-busy={busy}>
  <h2 id="expired-delete-title">Saved fictional household: deletion only</h2>
  <p>Normal access has expired. This saved browser reference does not grant access. The server checks the current owner session and household state. Private records and guidance stay closed.</p>
  {busy&&<p role="status">Checking deletion access…</p>}
  {error&&<p role="alert" className="error">{error==='FRESH_AUTH_REQUIRED'?'A recent owner sign-in is required to request deletion.':error==='UNAUTHORIZED'||error==='SCOPE_MISMATCH'?'This session cannot access deletion for the saved household.':`Deletion request unavailable: ${error}.`} Anonymous samples have no password sign-in; a lost session cannot be recovered through this control.</p>}
  {prepared&&<>
   <p>Only a freshly authenticated owner can request deletion. Requesting it disables access immediately; local primary cleanup then runs separately. Backup expiry is unverified, and downloaded copies cannot be recalled.</p>
   <label>Type DELETE to confirm<input value={typed} onChange={e=>setTyped(e.target.value)} autoComplete="off" disabled={busy}/></label>
   <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/> I request deletion of this entire fictional household.</label>
   <button className="secondary" disabled={busy||!confirmed||typed!=='DELETE'} onClick={()=>void run(requestDeletion)}>Disable household and request deletion</button>
  </>}
  {deletion&&<div aria-live="polite">
   <h3>Household deletion: {deletion.status}</h3>
   <p>Primary database cleanup: {deletion.primary_cleanup_verified?'verified by the server':'not yet verified'}.</p>
   {deletion.last_error_code&&<p role="alert" className="error">Cleanup failed: {deletion.last_error_code}. Access stays disabled.</p>}
   <p className="small">{deletion.retention_notice}</p>
   <button className="secondary" disabled={busy} onClick={()=>void run(async()=>setDeletion(await record<Deletion>({action:'delete_status',request_id:deletion.request_id})))}>Refresh deletion status</button>
   {deletion.status!=='completed'&&<button className="primary" disabled={busy} onClick={()=>void run(async()=>setDeletion(await record<Deletion>({action:'delete_process',request_id:deletion.request_id})))}>{deletion.status==='failed'?'Retry local cleanup':'Run local primary cleanup'}</button>}
  </div>}
  <button className="text-button" disabled={busy} onClick={onForget}>Forget saved reference on this device</button>
 </section>;
}
