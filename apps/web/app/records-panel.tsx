'use client';

import { useEffect, useState } from 'react';

type Version = { state_version:number; safety_epoch:number };
type Graph = { household:Version & { nickname:string }; pets:{id:string;nickname:string;version:number;archived_at:string|null}[]; cases:{id:string;title:string}[] };
type Preview = { summary_id:string;digest:string;content:string;scope:{case_id:string;pet_ids:string[];source_ids:string[]};purpose:'export'|'share';format:'text'|'html';recipient_address:string|null;expires_at:string;retention_notice:string };
type Records = Version & { exports:{id:string;mime_type:string;expires_at:string}[]; grants:{id:string;recipient_address:string;expires_at:string;revoked_at:string|null}[];retention_notice:string };
type Deletion = { request_id:string;status:string;primary_cleanup_verified:boolean;last_error_code:string|null;retention_notice:string };
type Write<T> = Version & { value:T };

const pendingRequestKeys=new Map<string,string>();
async function recordRequest<T>(payload:unknown):Promise<T> {
 const body=JSON.stringify(payload),key=pendingRequestKeys.get(body)??crypto.randomUUID();
 pendingRequestKeys.set(body,key);
 const response=await fetch('/api/records',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':key},body});
 const value=await response.json();
 pendingRequestKeys.delete(body);
 if(!response.ok)throw new Error(value.error??'REQUEST_FAILED');
 return value as T;
}
const when=(value:string)=>new Date(value).toLocaleString();
const errorMessage=(error:unknown)=>{
 const code=error instanceof Error?error.message:'REQUEST_FAILED';
 const hints:Record<string,string>={FRESH_AUTH_REQUIRED:'Sign in again, then create and review a fresh preview before authorizing. Deletion status remains available after sign-in.',VERIFIED_RECIPIENT_REQUIRED:'Use the address of an existing, verified recipient account. Anonymous demo accounts cannot receive a share.',STALE_STATE:'The household changed. Refresh records and prepare a new preview.',PREVIEW_EXPIRED:'Prepare a new preview and review its exact content.',UNAUTHORIZED:'A signed-in session is required.'};
 return `${code}${hints[code]?`: ${hints[code]}`:''}`;
};

export default function RecordsPanel({householdId,onChanged}:{householdId:string;onChanged:()=>void}) {
 const [graph,setGraph]=useState<Graph|null>(null),[records,setRecords]=useState<Records|null>(null);
 const [caseId,setCaseId]=useState(''),[purpose,setPurpose]=useState<'export'|'share'>('export'),[format,setFormat]=useState<'text'|'html'>('text'),[recipient,setRecipient]=useState(''),[hours,setHours]=useState('24');
 const [preview,setPreview]=useState<(Preview & Version)|null>(null),[reviewed,setReviewed]=useState(false);
 const [petId,setPetId]=useState(''),[archiveConfirmed,setArchiveConfirmed]=useState(false),[deleteConfirmed,setDeleteConfirmed]=useState(false),[deleteName,setDeleteName]=useState('');
 const [deletion,setDeletion]=useState<Deletion|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const storageKey=`denlumi-deletion-${householdId}`;
 async function refresh() {
  const response=await fetch(`/api/households/${householdId}/graph`,{credentials:'same-origin',cache:'no-store'});
  const next=await response.json();if(!response.ok)throw new Error(next.error??'REQUEST_FAILED');
  setGraph(next as Graph);setCaseId(current=>next.cases.some((c:{id:string})=>c.id===current)?current:next.cases[0]?.id??'');
  setRecords(await recordRequest<Records>({action:'list',household_id:householdId}));
 }
 useEffect(()=>{
  let active=true;
  setGraph(null);setRecords(null);setPreview(null);setReviewed(false);setDeletion(null);setError('');setNotice('');setBusy(true);
  setPetId('');setArchiveConfirmed(false);setDeleteConfirmed(false);setDeleteName('');setRecipient('');
  void (async()=>{
   let saved:string|null=null;try{saved=sessionStorage.getItem(storageKey);}catch{}
   if(saved){const status=await recordRequest<Deletion>({action:'delete_status',request_id:saved});if(active)setDeletion(status);return;}
   const response=await fetch(`/api/households/${householdId}/graph`,{credentials:'same-origin',cache:'no-store'});
   const next=await response.json();if(!response.ok)throw new Error(next.error??'REQUEST_FAILED');
   const listed=await recordRequest<Records>({action:'list',household_id:householdId});
   if(active){setGraph(next as Graph);setCaseId(next.cases[0]?.id??'');setRecords(listed);}
  })().catch(e=>{if(active)setError(errorMessage(e));}).finally(()=>{if(active)setBusy(false);});
  return ()=>{active=false;};
 },[householdId,storageKey]);
 async function run(work:()=>Promise<void>) {
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{await work();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 function invalidatePreview(){setPreview(null);setReviewed(false);}
 async function version(){
  const current=await recordRequest<Records>({action:'list',household_id:householdId});setRecords(current);
  return {expected_state_version:current.state_version,expected_safety_epoch:current.safety_epoch};
 }
 async function makePreview(){
  invalidatePreview();const expected=await version();
  const result=await recordRequest<Write<Preview>>({action:'preview',input:{household_id:householdId,case_id:caseId,...expected,purpose,format,recipient_address:purpose==='share'?recipient.trim():null,expires_at:new Date(Date.now()+Number(hours)*3600000).toISOString()}});
  setPreview({...result.value,state_version:result.state_version,safety_epoch:result.safety_epoch});
  await refresh();
 }
 async function authorize(){
  if(!preview||!reviewed)return;
  const p=preview;
  const result=await recordRequest<Write<{export_id?:string;grant_id?:string;notice:string}>>({action:'authorize',input:{household_id:householdId,summary_id:p.summary_id,reviewed_digest:p.digest,purpose:p.purpose,format:p.format,recipient_address:p.recipient_address,expires_at:p.expires_at,scope:p.scope,confirm_exact_content:true,expected_state_version:p.state_version,expected_safety_epoch:p.safety_epoch}});
  invalidatePreview();setNotice(result.value.export_id?'Private export created. Use its download button below.':'Recipient access granted. Nothing was sent externally.');await refresh();onChanged();
 }
 async function download(id:string,mime:string){
  const response=await fetch('/api/records',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'download',export_id:id})});
  if(!response.ok){const value=await response.json();throw new Error(value.error??'DOWNLOAD_FAILED');}
  const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=`denlumi-private-${id}.${mime==='text/html'?'html':'txt'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('The authenticated download was handed to your browser.');
 }
 async function archive(){
  const pet=graph?.pets.find(p=>p.id===petId);if(!pet||!archiveConfirmed)return;
  await recordRequest({action:'archive',input:{household_id:householdId,pet_id:pet.id,expected_pet_version:pet.version,...await version(),confirm_archive:true}});
  invalidatePreview();setPetId('');setArchiveConfirmed(false);setNotice(`${pet.nickname} was archived. Attributed history is retained.`);await refresh();onChanged();
 }
 async function requestDeletion(){
  if(!deleteConfirmed||deleteName!==graph?.household.nickname)return;
  const value=await recordRequest<Deletion>({action:'delete_request',input:{household_id:householdId,...await version(),confirm_household_deletion:true}});
  setDeletion(value);invalidatePreview();setRecords(null);try{sessionStorage.setItem(storageKey,value.request_id);}catch{}
  onChanged();
 }

 return <section className="panel" aria-labelledby="records-title" aria-busy={busy}>
  <h2 id="records-title">Private records</h2>
  <p>Review factual reports and their sources. These records do not diagnose or verify an animal’s physical state.</p>
  {error&&<p className="error" role="alert">{error} {error.startsWith('FRESH_AUTH_REQUIRED')&&<a href="/login">Sign in with an existing verified account</a>}</p>}
  <p className="small" role="status">{busy?'Working with the private record…':notice}</p>
  {!deletion&&<>
   <button className="secondary" disabled={busy} onClick={()=>void run(async()=>{invalidatePreview();await refresh();})}>Refresh records</button>
   {graph&&records&&<>
    <form onSubmit={e=>{e.preventDefault();void run(makePreview);}}>
     <fieldset disabled={busy}><legend>Prepare an exact preview</legend>
      <div className="form-grid">
       <label>Case<select value={caseId} onChange={e=>{setCaseId(e.target.value);invalidatePreview();}} required><option value="">Select a case</option>{graph.cases.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
       <label>Destination<select value={purpose} onChange={e=>{setPurpose(e.target.value as 'export'|'share');invalidatePreview();}}><option value="export">Private download to this device</option><option value="share">One verified recipient account</option></select></label>
       <label>File format<select value={format} onChange={e=>{setFormat(e.target.value as 'text'|'html');invalidatePreview();}}><option value="text">Plain text</option><option value="html">HTML</option></select></label>
       <label>Access expires in<select value={hours} onChange={e=>{setHours(e.target.value);invalidatePreview();}}><option value="1">1 hour</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label>
      </div>
      {purpose==='share'&&<label>Verified recipient email<input type="email" required maxLength={254} value={recipient} onChange={e=>{setRecipient(e.target.value);invalidatePreview();}}/></label>}
      <p className="small">Owner actions only. Authorization requires a recent sign-in. Sharing requires an existing verified recipient; the anonymous demo does not create one. No email is sent.</p>
      <button className="primary" disabled={!caseId}>Prepare private preview</button>
     </fieldset>
    </form>
    {preview&&<div>
     <h3>Review before authorizing</h3>
     <p>Destination: <strong>{preview.recipient_address??'Private download to this device'}</strong><br/>Format: {preview.format}. Access expires: {when(preview.expires_at)}.</p>
     <p>Case: {graph.cases.find(c=>c.id===preview.scope.case_id)?.title??preview.scope.case_id}. Pets: {preview.scope.pet_ids.map(id=>graph.pets.find(p=>p.id===id)?.nickname??id).join(', ')}. Included source records: {preview.scope.source_ids.length}.</p>
     <details><summary>Exact scope identifiers</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(preview.scope,null,2)}</pre></details>
     <label>Exact file content<textarea readOnly rows={16} value={preview.content} style={{width:'100%'}}/></label>
     <p className="small">HTML is shown as source so the exact downloadable content can be reviewed. This preview expires for authorization after 10 minutes; household changes require a new preview.</p>
     <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)} disabled={busy}/> I reviewed this exact content, scope, destination and expiry, and authorize this {preview.purpose==='share'?'recipient access':'private export'}.</label>
     <div><button className="primary" disabled={busy||!reviewed} onClick={()=>void run(authorize)}>Authorize {preview.purpose==='share'?'recipient access':'private export'}</button> <button className="secondary" disabled={busy} onClick={invalidatePreview}>Cancel preview</button></div>
    </div>}
    <h3>Private exports</h3>
    {records.exports.length?records.exports.map(e=><p key={e.id}>{e.mime_type==='text/html'?'HTML':'Text'} · expires {when(e.expires_at)} <button className="secondary" disabled={busy||new Date(e.expires_at)<=new Date()} onClick={()=>void run(()=>download(e.id,e.mime_type))}>Download private file</button></p>):<p className="small">No private exports.</p>}
    <h3>Recipient access</h3><p className="small">A recipient can sign in and enter their access reference on the <a href="/shared">private record page</a>. Nothing is sent automatically.</p>
    {records.grants.length?records.grants.map(g=><div key={g.id}><p>{g.recipient_address} · {g.revoked_at?'Revoked':new Date(g.expires_at)<=new Date()?'Expired':`Expires ${when(g.expires_at)}`}</p><p className="small">Access reference: {g.id}</p>{!g.revoked_at&&<button className="secondary" disabled={busy} onClick={()=>void run(async()=>{await recordRequest({action:'revoke',input:{household_id:householdId,grant_id:g.id,...await version()}});invalidatePreview();setNotice('Access revoked. Previously downloaded copies cannot be recalled.');await refresh();onChanged();})}>Revoke recipient access</button>}</div>):<p className="small">No recipient grants. Access is authenticated; an access reference alone does not grant permission.</p>}
    <p className="small">{records.retention_notice}</p>
    <details><summary>Archive a pet, keeping history</summary>
     <p>Archive removes the pet from active care, cancels dependent software work and requires fresh review of affected guidance. Earlier attributed reports remain.</p>
     <label>Pet<select value={petId} disabled={busy} onChange={e=>{setPetId(e.target.value);setArchiveConfirmed(false);}}><option value="">Select a pet</option>{graph.pets.filter(p=>!p.archived_at).map(p=><option key={p.id} value={p.id}>{p.nickname}</option>)}</select></label>
     <label><input type="checkbox" checked={archiveConfirmed} disabled={busy||!petId} onChange={e=>setArchiveConfirmed(e.target.checked)}/> Archive the selected pet and retain their history.</label>
     <button className="secondary" disabled={busy||!petId||!archiveConfirmed} onClick={()=>void run(archive)}>Archive selected pet</button>
    </details>
    <details><summary>Delete the whole household</summary>
     <p>This is separate from archiving a pet. Requesting deletion immediately disables household access, revokes shares and cancels software work. Local primary database cleanup runs in a separate step below. It cannot be undone here. Account identity and other households remain.</p>
     <p className="small">Backup expiry is not configured or verified. Recipient copies cannot be recalled. Export relevant records first if needed.</p>
     <label>Type “{graph.household.nickname}” to confirm<input value={deleteName} disabled={busy} onChange={e=>setDeleteName(e.target.value)} autoComplete="off"/></label>
     <label><input type="checkbox" checked={deleteConfirmed} disabled={busy} onChange={e=>setDeleteConfirmed(e.target.checked)}/> I request deletion of this entire household and understand access is disabled first.</label>
     <button className="secondary" disabled={busy||!deleteConfirmed||deleteName!==graph.household.nickname} onClick={()=>void run(requestDeletion)}>Disable household and request deletion</button>
    </details>
   </>}
  </>}
  {deletion&&<div aria-live="polite">
   <h3>Household deletion: {deletion.status}</h3>
   <p>Household access has been disabled. Request reference: {deletion.request_id}.</p>
   <p>Primary database cleanup: {deletion.primary_cleanup_verified?'verified by the server':'not yet verified'}.</p>
   {deletion.last_error_code&&<p className="error">Cleanup failed: {deletion.last_error_code}. The household stays disabled. Retry cleanup after resolving the failure.</p>}
   <p className="small">{deletion.retention_notice}</p>
   <button className="secondary" disabled={busy} onClick={()=>void run(async()=>setDeletion(await recordRequest<Deletion>({action:'delete_status',request_id:deletion.request_id})))}>Refresh deletion status</button>
   {deletion.status!=='completed'&&<button className="primary" disabled={busy} onClick={()=>void run(async()=>{setNotice('Processing local primary database cleanup…');const result=await recordRequest<Deletion>({action:'delete_process',request_id:deletion.request_id});setDeletion(result);})}>{deletion.status==='failed'?'Retry local cleanup':'Run local primary cleanup'}</button>}
  </div>}
 </section>;
}
