'use client';
import { useState } from 'react';
type Shared={content:string;mime_type:string;digest:string;notice:string;historical_snapshot:true};
export default function SharedRecord(){
 const [reference,setReference]=useState(''),[record,setRecord]=useState<Shared|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function retrieve(download=false){
  setBusy(true);setError('');setRecord(null);
  try{
   const response=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'view_share',grant_id:reference}),cache:'no-store'});
   const r=await response.json();if(!response.ok)throw Error(r.error);setRecord(r);
   if(download){const url=URL.createObjectURL(new Blob([r.content],{type:r.mime_type}));const a=document.createElement('a');a.href=url;a.download=`denlumi-shared.${r.mime_type==='text/html'?'html':'txt'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <main><section className="panel"><a href="/">Denlumi</a><h1>A private factual record</h1><p>You must be signed in as the verified recipient with a recent session. A reference alone gives no access. No professional qualification is implied.</p>
 <p><a href="/login">Sign in with an existing verified account</a></p><form onSubmit={e=>{e.preventDefault();void retrieve();}}><label>Access reference<input value={reference} required onChange={e=>{setReference(e.target.value);setRecord(null);}} autoComplete="off"/></label><button className="primary" disabled={busy}>Retrieve private record</button></form>
 {error&&<p className="error" role="alert">{error}. Access may have expired or been revoked. A verified recipient session within the last 30 minutes is required.</p>}
 {record&&<><p>{record.notice}</p><label>Exact shared snapshot<textarea readOnly value={record.content} rows={20}/></label><button className="secondary" disabled={busy} onClick={()=>void retrieve(true)}>Recheck access and download</button></>}
 </section></main>;
}
