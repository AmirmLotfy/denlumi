'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { bindState,type Brief,type FixtureName,type StateInput } from '../../../packages/contracts/phase0';
import { stopLocally } from '../../../packages/domain/local-stop';
import { captureMicrophone,type Microphone } from '../lib/microphone';
import RecordsPanel from './records-panel';
import HouseholdViews from './household-views';
import PlanningJourney from './planning-journey';
import ExpiredDemoDeletion from './expired-demo-deletion';
import { IssuedDemoDeletionCode,RecoverExpiredDemoDeletion } from './demo-deletion-recovery';

const choices:{id:FixtureName;name:string;detail:string}[]=[
 {id:'cat_dog',name:'Dog joining a cat',detail:'Finn joins Nora'},
 {id:'cat_dog_new_cat',name:'Cat joining a dog',detail:'Nora joins Finn'},
 {id:'cat_cat',name:'Two cats',detail:'Nora & Milo'},
 {id:'dog_dog',name:'Two dogs',detail:'Finn & Rory'},
 {id:'single_cat',name:'One cat',detail:'Nora'},
 {id:'single_dog',name:'One dog',detail:'Finn'},
 {id:'multi_pet',name:'A multi-pet home',detail:'Finn, Nora & Milo'}
];
type Evidence={checked_at:string;tests:Record<string,{status:string;[key:string]:unknown}>;[key:string]:unknown};
type Reply={answer:string;answer_source:string;provider:{status:string;detail?:string};trace:Record<string,unknown>[];brief:Brief;conversation_id:string;intent:string;detail:unknown};
async function request<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,{...init,cache:'no-store'});const data=await response.json();
 if(!response.ok)throw new Error(data.error??'REQUEST_FAILED');return data as T;
}
const post=(value:unknown)=>({method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(value)});
const time=(s:string|null)=>s?new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Not supplied';
const petLabel=(p:Brief['pets'][number])=>`${p.nickname} (${p.species})${p.aliases?.length?` · also ${p.aliases.join(', ')}`:''}`;
export default function Console({providerEvidence,speechEnabled}:{providerEvidence:Evidence;speechEnabled:boolean}){
 const [brief,setBrief]=useState<Brief|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [fixture,setFixture]=useState<FixtureName>('cat_dog');
 const [retentionAccepted,setRetentionAccepted]=useState(false);
 const [signOutPending,setSignOutPending]=useState(false);
 const [deletionRecoveryCode,setDeletionRecoveryCode]=useState<string|null>(null);
 const [activeView,setActiveView]=useState<'today'|'pets'|'home'|'history'>('today');
 const [savedCaregiver,setSavedCaregiver]=useState<StateInput|null>(null),[caregiverStatus,setCaregiverStatus]=useState('');
 const [report,setReport]=useState(''),[actorPet,setActorPet]=useState(''),[targetPet,setTargetPet]=useState(''),[assertion,setAssertion]=useState('uncertain'),[observedAt,setObservedAt]=useState('');
 const [reply,setReply]=useState<Reply|null>(null),[question,setQuestion]=useState('What is our current plan?'),[useModel,setUseModel]=useState(false),[talking,setTalking]=useState(false);
 const [intent,setIntent]=useState('current_plan'),[recording,setRecording]=useState(false),[voiceStatus,setVoiceStatus]=useState(''),[questionSource,setQuestionSource]=useState<'typed'|'voice'>('typed'),[reportSource,setReportSource]=useState<'typed'|'voice'>('typed');
 const microphone=useRef<Microphone|null>(null),voiceTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [caption,setCaption]=useState('');
 const [recordsHouseholdId,setRecordsHouseholdId]=useState<string|null>(null);
 useEffect(()=>{if(brief?.role==='owner'){setRecordsHouseholdId(brief.household_id);try{sessionStorage.setItem('denlumi-records-household',brief.household_id);}catch{}}},[brief?.household_id,brief?.role]);
 const draftSources=useRef({question:questionSource,report:reportSource});draftSources.current={question:questionSource,report:reportSource};
 const [localStopped,setLocalStopped]=useState(false),[sync,setSync]=useState<'none'|'pending'|'synced'>('none'),[stopMs,setStopMs]=useState<number|null>(null);
 const audio=useRef<HTMLAudioElement|null>(null),audioUrl=useRef<string|null>(null),abort=useRef<AbortController|null>(null),generation=useRef(0),latch=useRef(false),syncing=useRef(false);
 const householdGeneration=useRef(0);
 const briefRef=useRef<Brief|null>(null);briefRef.current=brief;
 const load=useCallback(async()=>{const view=householdGeneration.current;const r=await request<{brief:Brief|null}>('/api/households');if(view!==householdGeneration.current)return null;setBrief(r.brief);return r.brief;},[]);
 useEffect(()=>{let active=true;
  (async()=>{try{
   const r=await request<{brief:Brief|null}>('/api/households');if(!active)return;setBrief(r.brief);
   try{const saved=sessionStorage.getItem('denlumi-records-household');if(saved)setRecordsHouseholdId(saved);}catch{}
   if(r.brief){const b=r.brief;setActorPet(b.pets[0]?.id??'');setTargetPet(b.pets[1]?.id??'');
    const saved=await request<Brief>('/api/caregiver');if(active)setSavedCaregiver(bindState(saved));
    const value=localStorage.getItem(`denlumi-stop-${b.household_id}`);if(value){latch.current=true;setLocalStopped(true);setSync(value==='pending'?'pending':'synced');}
   }
  }catch(e){if((e as Error).message!=='UNAUTHORIZED'&&active)setError('The household could not be retrieved. Check the local services and try again.');}finally{if(active)setLoading(false);}})();
  return()=>{active=false;generation.current++;abort.current?.abort();microphone.current?.cancel();if(voiceTimer.current)clearTimeout(voiceTimer.current);audio.current?.pause();if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);};
 },[]);
 const syncStop=useCallback(async()=>{
  const b=briefRef.current;if(!b||syncing.current)return;syncing.current=true;const view=householdGeneration.current;
  try{
   // A queued safety-decreasing stop re-reads state; a stale payload is never blindly replayed.
   for(let attempt=0;attempt<2;attempt++){
    const fresh=await request<Brief>(`/api/households/${b.household_id}`);
    if(view!==householdGeneration.current)return;
    try{await request('/api/actions',post({operation:'pause',input:{...bindState(fresh),reason:'Local stop requested'}}));break;}
    catch(e){if((e as Error).message!=='STALE_STATE'||attempt===1)throw e;}
   }
   if(view!==householdGeneration.current)return;
   setSync('synced');try{localStorage.setItem(`denlumi-stop-${b.household_id}`,'synced');}catch{}
   await load();
  }catch{if(view===householdGeneration.current)setSync('pending');}finally{syncing.current=false;}
 },[load]);
 useEffect(()=>{
  const online=()=>{if(latch.current&&sync==='pending')void syncStop();};window.addEventListener('online',online);
  if(sync==='pending'&&navigator.onLine)void syncStop();
  return()=>window.removeEventListener('online',online);
 },[sync,syncStop]);
 function clearTransientContent(){
  ++householdGeneration.current;++generation.current;
  stopLocally({audio:audio.current,speech:window.speechSynthesis,abort:abort.current??undefined,stopMicrophone:()=>{microphone.current?.cancel();microphone.current=null;},persist:()=>{},showStopped:()=>{}});
  if(voiceTimer.current)clearTimeout(voiceTimer.current);voiceTimer.current=null;
  if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);audioUrl.current=null;audio.current=null;abort.current=null;
  draftSources.current={question:'typed',report:'typed'};
  setQuestion('What is our current plan?');setReport('');setQuestionSource('typed');setReportSource('typed');
  setActorPet('');setTargetPet('');setAssertion('uncertain');setObservedAt('');setReply(null);setCaption('');
  setIntent('current_plan');setUseModel(false);setVoiceStatus('');setRecording(false);setTalking(false);
  setCaregiverStatus('');setSavedCaregiver(null);setActiveView('today');setStopMs(null);
 }
 async function enter(){if(!retentionAccepted||signOutPending)return;clearTransientContent();setBusy(true);setError('');try{
  const created=await request<{deletionRecoveryCode:string|null}>('/api/demo',post({fixture,retention_acknowledged:true}));
  setDeletionRecoveryCode(created.deletionRecoveryCode);const b=await load();if(!b)throw Error('NO_HOUSEHOLD');
  setActorPet(b.pets[0].id);setTargetPet(b.pets[1]?.id??'');setReport('');setReply(null);latch.current=false;setLocalStopped(false);setSync('none');
  setSavedCaregiver(bindState(await request<Brief>('/api/caregiver')));
 }catch(e){setError(`The fictional household could not be opened: ${(e as Error).message}.`);}finally{setBusy(false);}}
 async function action(operation:string,input:unknown,caregiver=false){
  const view=householdGeneration.current;
  setBusy(true);setError('');try{const r=await request('/api/actions',post({operation,input,caregiver}));if(!caregiver&&view===householdGeneration.current)await load();return r;}catch(e){if(view===householdGeneration.current)setError((e as Error).message.replaceAll('_',' '));throw e;}finally{if(view===householdGeneration.current)setBusy(false);}
 }
 async function record(e:React.FormEvent){e.preventDefault();if(!brief)return;
  const view=householdGeneration.current;
  try{await action('record',{...bindState(brief),raw_report:report,actor_pet_id:actorPet||null,target_pet_id:targetPet||null,assertion,source_kind:reportSource,observed_at:observedAt?new Date(observedAt).toISOString():null});if(view===householdGeneration.current){setReport('');setReportSource('typed');}}catch{}
 }
 async function checkCaregiver(){if(!savedCaregiver)return;setBusy(true);setCaregiverStatus('');try{
  await request('/api/actions',post({operation:'preflight',input:savedCaregiver,caregiver:true}));setCaregiverStatus('Sam’s saved view is current. This was a fictional state check; no session started.');
 }catch(e){setCaregiverStatus((e as Error).message==='STALE_STATE'?'The plan changed. Sam’s saved view was refused. Read the current update before proceeding.':`Request refused: ${(e as Error).message.replaceAll('_',' ')}.`);}finally{setBusy(false);}}
 async function ask(e?:React.FormEvent){e?.preventDefault();if(!brief)return;
  audio.current?.pause();setTalking(false);microphone.current?.cancel();microphone.current=null;setRecording(false);
  const turn=++generation.current;abort.current?.abort();abort.current=new AbortController();setBusy(true);setError('');setReply(null);
  try{
   const r=await request<Reply>('/api/assistant/turn',{...post({household_id:brief.household_id,message:question,use_model:useModel,intent,source_kind:questionSource}),signal:abort.current.signal});
   if(turn!==generation.current)return;setReply(r);setBrief(r.brief);
  }catch(e){if(turn===generation.current&&(e as Error).name!=='AbortError')setError(`Current-state retrieval failed: ${(e as Error).message}.`);}finally{if(turn===generation.current)setBusy(false);}
 }
 async function finishRecording(){
  const mic=microphone.current,b=briefRef.current;if(!mic||!b)return;microphone.current=null;
  const bytes=mic.finish();setRecording(false);setVoiceStatus('Transcribing. Nothing has been saved.');setBusy(true);const turn=generation.current;
  try{
   const r=await request<{transcript:string}>('/api/transcription',{method:'POST',headers:{'Content-Type':'audio/pcm;rate=16000;channels=1','X-Denlumi-Household':b.household_id},body:new Blob([bytes as BlobPart]),signal:abort.current?.signal});
   if(turn!==generation.current||latch.current)return;
   setQuestion(r.transcript);setQuestionSource('voice');setIntent('observation');
   setVoiceStatus(r.transcript?'Transcript ready. Review the words before continuing.':'No words were returned. Type your report instead.');
   // Keep the earliest deadline: a new recording cannot extend an older unsaved draft's life.
   if(!voiceTimer.current)voiceTimer.current=setTimeout(()=>{
    voiceTimer.current=null;
    if(draftSources.current.question==='voice'){setQuestion('');setQuestionSource('typed');}
    if(draftSources.current.report==='voice'){setReport('');setReportSource('typed');}
    setReply(r=>r?.intent==='observation'&&(r.detail as {source_kind?:string})?.source_kind==='voice'?null:r);
    setVoiceStatus('Unsaved voice transcript cleared. Saved records are unchanged.');
   },15*60*1000);
  }catch(e){if(turn===generation.current&&(e as Error).name!=='AbortError')setVoiceStatus(`Transcription unavailable: ${(e as Error).message}. Type the same report below.`);}
  finally{bytes.fill(0);if(turn===generation.current)setBusy(false);}
 }
 async function startRecording(){
  if(!brief||latch.current)return;
  ++generation.current;abort.current?.abort();audio.current?.pause();window.speechSynthesis?.cancel();setTalking(false);
  abort.current=new AbortController();const turn=generation.current;setVoiceStatus('Requesting microphone permission.');setBusy(true);
  try{const mic=await captureMicrophone(abort.current.signal,()=>void finishRecording());
   if(turn!==generation.current||latch.current){mic.cancel();return;}microphone.current=mic;setRecording(true);setVoiceStatus('Recording · maximum 15 seconds. Finish to transcribe, or Stop to discard.');
  }catch(e){if(turn===generation.current)setVoiceStatus(`Microphone unavailable: ${(e as Error).name}. Typed controls remain available.`);}finally{if(turn===generation.current)setBusy(false);}
 }
 async function speak(){if(!brief||latch.current)return;
  const turn=++generation.current;abort.current?.abort();abort.current=new AbortController();setTalking(true);setError('');
  try{
   const r=await fetch('/api/speech',{...post({household_id:brief.household_id}),signal:abort.current.signal});if(!r.ok){const v=await r.json();throw Error(v.error);}
   const blob=await r.blob();if(latch.current||turn!==generation.current)return;
   setCaption(r.headers.get('x-denlumi-caption')??'');
   const fresh=await request<Brief>(`/api/households/${brief.household_id}`);
   if(latch.current||turn!==generation.current)return;
   setBrief(fresh);
   if(String(fresh.safety_epoch)!==r.headers.get('x-denlumi-epoch'))throw Error('The household changed. Retrieve the current update first.');
   if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);audioUrl.current=URL.createObjectURL(blob);audio.current=new Audio(audioUrl.current);
   audio.current.onended=()=>setTalking(false);await audio.current.play();
  }catch(e){if(turn===generation.current){if((e as Error).name!=='AbortError')setError(`Audio unavailable: ${(e as Error).message}. Typed controls still work.`);setTalking(false);}}
 }
 function stop(){const start=performance.now();++generation.current;latch.current=true;
  stopLocally({audio:audio.current,speech:window.speechSynthesis,abort:abort.current??undefined,stopMicrophone:()=>{microphone.current?.cancel();microphone.current=null;setRecording(false);setVoiceStatus('Recording and playback stopped locally.');},persist:()=>{if(brief)localStorage.setItem(`denlumi-stop-${brief.household_id}`,'pending');},showStopped:()=>{setLocalStopped(true);setTalking(false);setBusy(false);setReply(null);setSync('pending');}});
  setStopMs(performance.now()-start);void syncStop();
 }
 async function signOut(){
  const oldHousehold=brief?.household_id;stop();clearTransientContent();briefRef.current=null;
  setBrief(null);setRecordsHouseholdId(null);setSync('none');setRetentionAccepted(false);setDeletionRecoveryCode(null);setSignOutPending(true);setBusy(true);setError('');
  try{sessionStorage.removeItem('denlumi-records-household');if(oldHousehold)sessionStorage.removeItem(`denlumi-deletion-${oldHousehold}`);}catch{}
  try{await request('/api/auth/signout',post({}));setSignOutPending(false);if(oldHousehold)localStorage.removeItem(`denlumi-stop-${oldHousehold}`);}
  catch{setError('Local content cleared. Sign-out could not be confirmed. Retry when the service is available.');}
  finally{setBusy(false);}
 }
 const paused=!!brief?.holds.length;
 const reviewNeeded=!!brief&&!paused&&(brief.stale||brief.plan_status==='stale'||!brief.guidance_available);
 return <>
  <header className="topbar"><a href="/" className="wordmark" aria-label="Denlumi home"><span className="mark" aria-hidden="true">d.</span>denlumi</a><span className="tagline">Every pet. One home. At their pace.</span><span className="demo-label">Fictional household demo</span></header>
  <main id="main">
   {loading?<div className="loading" role="status">Retrieving your household…</div>:!brief?<section className="entry">
    <span className="eyebrow">A home is a shared responsibility.</span><h1>One current plan.<br/>Everyone in the picture.</h1>
    <p className="intro">For cats, dogs, and the people who care for them. See how a shared record changes when someone adds an observation.</p>
    <fieldset className="sample-picker"><legend>Choose a fictional household</legend><div className="sample-grid">{choices.map(c=><label key={c.id} className={`sample-option ${fixture===c.id?'selected':''}`}><input type="radio" name="fixture" value={c.id} checked={fixture===c.id} onChange={()=>setFixture(c.id)}/><span><strong>{c.name}</strong><small>{c.detail}</small></span></label>)}</div></fieldset>
    <p className="entry-note">These are fictional software examples. No protocol has professional approval, and no practical guidance for real animals is provided. Access ends after 24 hours. Local primary records may be deleted by the cleanup worker after seven days; cleanup is not continuous and may be delayed. A private deletion code is shown once when a new sample opens. Backup expiry is unverified. Do not enter real personal or animal-handling information.</p>
    <label className="checkbox"><input type="checkbox" checked={retentionAccepted} onChange={e=>setRetentionAccepted(e.target.checked)}/> I understand the fictional sample's 24-hour access and seven-day local cleanup rule.</label>
    <button className="primary" onClick={enter} disabled={busy||!retentionAccepted||signOutPending}>{busy?'Please wait…':'Open sample household'} <span aria-hidden="true">↗</span></button>
    {signOutPending&&<button className="text-button" disabled={busy} onClick={signOut}>Retry sign-out</button>}
    {deletionRecoveryCode&&<IssuedDemoDeletionCode code={deletionRecoveryCode} onDismiss={()=>setDeletionRecoveryCode(null)}/>}
    {recordsHouseholdId&&<ExpiredDemoDeletion householdId={recordsHouseholdId} onChanged={()=>{void load().catch(()=>setError('Deletion state could not be refreshed.'));}} onForget={()=>{try{sessionStorage.removeItem('denlumi-records-household');sessionStorage.removeItem(`denlumi-deletion-${recordsHouseholdId}`);}catch{}setRecordsHouseholdId(null);}}/>}
    <RecoverExpiredDemoDeletion onRecovered={()=>{try{sessionStorage.removeItem('denlumi-records-household');}catch{}setRecordsHouseholdId(null);setDeletionRecoveryCode(null);}}/>
   </section>:<>
    <div className="page-heading"><div><div className="eyebrow">The sample home <span className="dot-separator">/</span> {activeView[0].toUpperCase()+activeView.slice(1)}</div><h1>{brief.title}</h1></div><div className="account"><span><strong>Maya</strong> · owner</span><button className="text-button" onClick={signOut}>Leave sample</button></div></div>
    {deletionRecoveryCode&&<IssuedDemoDeletionCode code={deletionRecoveryCode} onDismiss={()=>setDeletionRecoveryCode(null)}/>}
    <div className="pet-lanes">{brief.pets.map(p=><div className="pet" key={p.id}><span className="initial" aria-hidden="true">{p.nickname[0]}</span><div><strong>{p.nickname}</strong><span>{p.species} · {p.role}</span></div></div>)}<p>{brief.pets.length>2?'Separate records. No assumption of group readiness.':brief.pets.length===1?'A complete household of one. No second pet needed.':'Each pet has their own part of the story.'}</p></div>
    <div className="app-layout"><nav className="section-nav" aria-label="Household views">{(['today','pets','home','history'] as const).map(view=><button key={view} type="button" aria-current={activeView===view?'page':undefined} className={activeView===view?'view-active':''} onClick={()=>setActiveView(view)}>{view[0].toUpperCase()+view.slice(1)}</button>)}<p>Records are current only when retrieved. Reported care is not verified physical activity.</p></nav><div className="view-content">
    {activeView==='today'&&<div className="workspace"><div className="main-column">
     <section className={`panel plan ${paused?'is-paused':reviewNeeded?'needs-review':''}`} aria-labelledby="plan-title">
      <div className="panel-top"><span className="eyebrow">Shared plan</span><span className="badge">Update {brief.safety_epoch}</span></div>
      <h2 id="plan-title">{paused?'Guidance is paused.':reviewNeeded?'Plan review needed.':'A shared starting point.'}</h2>
      <p className="plan-reason">{brief.handovers[0]?.body.summary}</p>
      {reviewNeeded&&<p className="inline-notice">The household record changed or the demo protocol is unavailable. Earlier plan review cannot authorize a session. Review the current version before proceeding.</p>}
      <div className="plan-foot"><span className="badge">Demo-only protocol</span><span>Retrieved {time(brief.as_of)}</span></div>
     </section>
     <section className="panel handover" aria-labelledby="handover-title"><div className="panel-top"><h2 id="handover-title">Same home. Same update.</h2><span className="small">2 fictional caregivers</span></div>
      <div className="caregiver-row"><span className="initial small-initial">M</span><div><strong>Maya · owner</strong><span>Viewing update {brief.safety_epoch}</span></div><span className="badge">Current view</span></div>
      <div className="caregiver-row"><span className="initial small-initial">S</span><div><strong>Sam · caregiver</strong><span>Saved view: update {savedCaregiver?.expected_safety_epoch??'—'}</span></div><span className={`badge ${savedCaregiver?.expected_safety_epoch!==brief.safety_epoch?'stale':''}`}>{savedCaregiver?.expected_safety_epoch!==brief.safety_epoch?'Update needed':'Current view'}</span></div>
      <div className="button-row"><button className="secondary" disabled={busy||!savedCaregiver} onClick={checkCaregiver}>Check Sam’s saved view</button><button className="text-button" onClick={async()=>{try{const b=await request<Brief>('/api/caregiver');setSavedCaregiver(bindState(b));setCaregiverStatus('Sam retrieved the current update. This does not acknowledge any physical action.');}catch{setCaregiverStatus('Sam’s current view could not be retrieved.');}}}>Refresh Sam’s view</button></div>
     {caregiverStatus&&<p className="inline-notice" role="status">{caregiverStatus}</p>}
     </section>
     <PlanningJourney brief={brief} onChanged={()=>{void load().catch(()=>setError('Household state could not be refreshed.'));}}/>
     <HouseholdViews view="today" brief={brief}/>
     <section className="panel" aria-labelledby="report-title"><div className="panel-top"><h2 id="report-title">Add to the shared record</h2><span className="small">Fictional observations only</span></div>
      <p className="muted">Keep who did what, and what remains uncertain. Saving a draft pauses software guidance until the report is reviewed.</p>
      <form onSubmit={record}><div className="form-grid"><label>Who was observed?<select value={actorPet} onChange={e=>{setActorPet(e.target.value);if(e.target.value===targetPet)setTargetPet('');}} required><option value="">Select a pet</option>{brief.pets.map(p=><option key={p.id} value={p.id}>{petLabel(p)}</option>)}</select></label>
       <label>Directed toward<select value={targetPet} onChange={e=>setTargetPet(e.target.value)}><option value="">No other pet / unknown / not applicable</option>{brief.pets.filter(p=>p.id!==actorPet).map(p=><option key={p.id} value={p.id}>{petLabel(p)}</option>)}</select></label></div>
       <label>The exact fictional report<textarea value={report} onChange={e=>{setReport(e.target.value);setReportSource('typed');}} maxLength={1500} required rows={3} placeholder="For example: I am not sure what Finn did toward Nora."/></label>
       <div className="form-grid"><label>How is it reported?<select value={assertion} required onChange={e=>setAssertion(e.target.value)}><option value="">Select the report meaning</option><option value="uncertain">Uncertain / not sure</option><option value="affirmed">It happened, according to the report</option><option value="negated">It did not happen, according to the report</option></select></label><label>When was it observed? <span className="optional">Optional; blank means unknown</span><input type="datetime-local" value={observedAt} onChange={e=>setObservedAt(e.target.value)}/></label></div>
       <button className="primary" disabled={busy}>Save fictional observation</button>
      </form>
      {brief.observations.map(o=><article className="observation" key={o.id}><div className="panel-top"><strong>Caregiver report · {o.assertion}</strong><span className="badge">{o.status}</span></div><blockquote>{o.raw_report}</blockquote><p className="small">{brief.pets.find(p=>p.id===o.actor_pet_id)?.nickname??'Unclear actor'} → {brief.pets.find(p=>p.id===o.target_pet_id)?.nickname??'No target supplied'}</p><p className="small">Observed: {time(o.observed_at)}<br/>Reported: {time(o.reported_at)} · {o.source_kind}</p>
       {o.status==='draft'&&<button className="secondary" disabled={busy} onClick={()=>void action('confirm',{...bindState(brief),observation_id:o.id,digest:o.digest}).catch(()=>{})}>Confirm this exact fictional report</button>}
      </article>)}
     </section>
    </div><aside className="side-column">
     <section className="panel companion" aria-labelledby="companion-title"><span className="eyebrow">A check-in with the home</span><h2 id="companion-title">Pick up from here.</h2><p className="simulation-label">Alexa-style browser simulation</p><p className="muted">Retrieve the current record in a fresh conversation. This demo has no physical device or native Alexa connection.</p>
      {reply?<div className="reply" role="status"><p>{reply.answer}</p><span className="small">Read from the shared record · update {reply.brief.safety_epoch}</span></div>:<div className="empty-reply">The household record carries the context, even when the conversation is new.</div>}
      {reply?.provider.status==='blocked'&&<p className="inline-notice">Bedrock is unavailable ({reply.provider.detail}). The response above comes from the current database record.</p>}
      {reply?.provider.status==='responded_without_tool'&&<p className="inline-notice">Bedrock responded without reading a tool. The response above comes from the current database record.</p>}
      {reply?.provider.status==='tool_loop_completed'&&<p className="small">Bedrock used bounded read tools. The response above was assembled from the current database record.</p>}
      <form onSubmit={ask}><label>What would you like to do?<select value={intent} onChange={e=>setIntent(e.target.value)}><option value="current_plan">Read current plan</option><option value="due_tasks">Read routine reports</option><option value="observation">Clarify a fictional observation</option><option value="handover">Preview current handover</option><option value="explain">Check current rationale and sources</option></select></label><label>Your check-in<input value={question} onChange={e=>{setQuestion(e.target.value);setQuestionSource('typed');}} maxLength={1000} required/></label><button className="primary" disabled={busy||recording}>{busy?'Retrieving…':intent==='current_plan'?'Read current plan':'Continue'} <span aria-hidden="true">↗</span></button></form>
      {reply?.intent==='observation'&&<button className="secondary" onClick={()=>{const d=reply.detail as {raw_report:string;source_kind:'typed'|'voice'};setReport(d.raw_report);setReportSource(d.source_kind);setActorPet('');setTargetPet('');setAssertion('');setObservedAt('');document.getElementById('report-title')?.scrollIntoView({block:'center'});}}>Review identities, meaning and timing in report form</button>}
      {reply?.detail!=null&&reply.intent!=='observation'&&<details><summary>Current record details</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(reply.detail,null,2)}</pre><p className="small">Reports reflect what caregivers recorded. They do not verify physical actions.</p></details>}
      <button className="text-button new-conversation" onClick={()=>{++generation.current;abort.current?.abort();microphone.current?.cancel();microphone.current=null;setRecording(false);audio.current?.pause();setTalking(false);setBusy(false);setReply(null);setQuestionSource('typed');setIntent('current_plan');setQuestion('Why is the current plan paused?');}}>New conversation</button>
      {caption&&<p className="small" aria-label="Audio captions">{caption}</p>}
      <p className="small">Conversation reads the current record. Observations require your explicit review; no model text is presented as animal-handling advice.</p>
      <div className="speech"><button className="secondary" onClick={speak} disabled={!speechEnabled||localStopped||talking||recording||busy}>{talking?'Reading…':'Read update aloud'}</button><button className="secondary" aria-pressed={recording} onClick={()=>void(recording?finishRecording():startRecording())} disabled={!speechEnabled||localStopped||busy}>{recording?'Finish recording':'Record a check-in'}</button><p className="small">{speechEnabled?'Optional Amazon speech. Microphone opens only when requested; recording ends after 15 seconds. Stop discards recording and cancels playback locally.':'Speech is not enabled. Typed actions remain available.'} Audio is not stored by Denlumi. Review transcripts before saving.</p><p role="status">{voiceStatus}</p></div>
     </section>
     <details className="panel evidence"><summary>Demo evidence & connections</summary><p className="small">Last provider probe: {time(providerEvidence.checked_at)}. These results describe those requests, not ongoing availability.</p>
      <dl>{Object.entries(providerEvidence.tests).map(([name,result])=><div key={name}><dt>{name}</dt><dd>{result.status}</dd></div>)}</dl>
      <p className="small">These are saved probe outcomes, not a live availability check. Speech probes use generated audio and do not prove human microphone capture or audible playback.</p>
      <label className="checkbox"><input type="checkbox" checked={useModel} onChange={e=>setUseModel(e.target.checked)}/>Attempt bounded Bedrock request on next check-in</label>
      <p className="small">Protocol: {brief.protocol_slug} · {brief.protocol_status}<br/>Safety epoch: {brief.safety_epoch}<br/>Local stop handler: {stopMs===null?'not measured':`${stopMs.toFixed(1)} ms (this browser run)`}</p>
      {reply&&<pre aria-label="Actual MCP request trace">{JSON.stringify(reply.trace,null,2)}</pre>}
     </details>
    </aside></div>}
    {activeView!=='today'&&<HouseholdViews view={activeView} brief={brief} onChanged={()=>{void load().catch(()=>setError('Household state could not be refreshed.'));}}/>} 
    </div></div>
   </>}
   {activeView==='history'&&recordsHouseholdId&&<RecordsPanel householdId={recordsHouseholdId} onChanged={()=>{void load().catch(()=>setError('Household state could not be refreshed.'));}}/>}
   {error&&<p className="error" role="alert">{error}</p>}
  </main>
  {brief&&<footer className="stopbar"><div><strong aria-live="assertive">{localStopped?'Stopped on this device.':'You can stop at any moment.'}</strong><p role="status">{sync==='pending'?'Household update not yet synchronized.':sync==='synced'?'The software pause is saved to the household.':'Stops software only. It does not supervise or physically control animals.'}</p></div><div className="stop-actions">{sync==='pending'&&<button className="text-button" onClick={()=>void syncStop()}>Retry sync</button>}<button className="stop-button" onClick={stop}><span className="stop-square" aria-hidden="true"/>Stop guidance</button></div></footer>}
  {!brief&&<footer className="entry-footer">Settle. Share. Review. <span>At their pace.</span></footer>}
 </>;
}
