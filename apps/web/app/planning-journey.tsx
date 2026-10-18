'use client';

import { useCallback,useEffect,useState } from 'react';
import { bindState,type Brief } from '../../../packages/contracts/phase0';

type Household={state_version:number;safety_epoch:number};
type Graph={household:Household;cases:{id:string;scenario_code:string;support_level:string;routed_at:string|null}[]};
type Plan={id:string;case_id:string;revision_number:number;status:string;digest:string;protocol_version_id:string};
type Handover={id:string;case_id:string;plan_revision_id:string|null;digest:string;status:string;body:{summary?:string}};
type Session={id:string;case_id:string;plan_revision_id:string;state:string;safety_epoch:number};
type Observation={id:string;session_id:string|null;status:string;digest:string;raw_report:string;actor_pet_id:string|null;target_pet_id:string|null;assertion:string;observed_at:string|null};
type Workspace={plans:Plan[];handovers:Handover[];own_acknowledgements:{handover_id:string}[];sessions:Session[]};

async function read<T>(path:string):Promise<T>{
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});
 const value=await response.json();if(!response.ok)throw Error(value.error??'REQUEST_FAILED');return value as T;
}
async function write<T>(path:string,payload:unknown):Promise<T>{
 const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(payload)});
 const value=await response.json();if(!response.ok)throw Error(value.error??'REQUEST_FAILED');return value as T;
}

export default function PlanningJourney({brief,onChanged}:{brief:Brief;onChanged:()=>void}){
 const [graph,setGraph]=useState<Graph|null>(null),[workspace,setWorkspace]=useState<Workspace|null>(null),[samAcks,setSamAcks]=useState<string[]|null>(null),[draft,setDraft]=useState<Observation|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preflight,setPreflight]=useState('');
 const [reviewChecked,setReviewChecked]=useState(false),[report,setReport]=useState(''),[actorPet,setActorPet]=useState(''),[targetPet,setTargetPet]=useState(''),[assertion,setAssertion]=useState<'affirmed'|'negated'|'uncertain'>('uncertain'),[observedAt,setObservedAt]=useState('');
 const load=useCallback(async()=>{
  try{
   const [g,w,sam]=await Promise.all([read<Graph>(`/api/households/${brief.household_id}/graph`),read<Workspace>(`/api/households/${brief.household_id}/planning`),read<Workspace>(`/api/caregiver/planning?household_id=${brief.household_id}`).catch(()=>null)]);
   const session=w.sessions.find(s=>s.case_id===brief.case_id&&['active','paused','interrupted'].includes(s.state));
   const nextDraft=session?(await read<{observations:Observation[]}>(`/api/sessions/${session.id}`)).observations.find(o=>o.session_id===session.id&&o.status==='draft')??null:null;
   setGraph(g);setWorkspace(w);setSamAcks(sam?.own_acknowledgements.map(a=>a.handover_id)??null);setDraft(nextDraft);setError('');
  }catch(error){
   setGraph(null);setWorkspace(null);setSamAcks(null);setDraft(null);setPreflight('');setReviewChecked(false);
   throw error;
  }
 },[brief.household_id,brief.case_id]);
 useEffect(()=>{let active=true;void load().catch(e=>{if(active)setError(`Journey state unavailable: ${(e as Error).message}.`);});return()=>{active=false;};},[load,brief.safety_epoch]);
 const run=async(step:string,operation:()=>Promise<unknown>)=>{
  setBusy(true);setError('');setNotice('');
  try{await operation();}
  catch(e){setError(`${step} was refused: ${(e as Error).message.replaceAll('_',' ')}. Refresh the current record before retrying.`);setBusy(false);return;}
  try{await load();onChanged();setPreflight('');setNotice(`${step} saved to the fictional household record. Retrieve the current state before another consequential action.`);}
  catch(e){setError(`${step} was saved, but its current state could not be retrieved: ${(e as Error).message.replaceAll('_',' ')}. Refresh before another action.`);}
  finally{setBusy(false);}
 };
 const current=graph?.cases.find(c=>c.id===brief.case_id);
 const latest=workspace?.plans.filter(p=>p.case_id===brief.case_id).sort((a,b)=>b.revision_number-a.revision_number)[0];
 const handover=workspace?.handovers.filter(h=>h.case_id===brief.case_id&&h.plan_revision_id===latest?.id&&h.status==='published').at(-1);
 const acknowledged=!!handover&&!!workspace?.own_acknowledgements.some(a=>a.handover_id===handover.id);
 const samAcknowledged=!!handover&&!!samAcks?.includes(handover.id);
 const session=workspace?.sessions.find(s=>s.case_id===brief.case_id&&['active','paused','interrupted'].includes(s.state));
 const expected=()=>({expected_state_version:graph!.household.state_version,expected_safety_epoch:graph!.household.safety_epoch});
 const freshBrief=()=>read<Brief>(`/api/households/${brief.household_id}`);
 const route=()=>run('Fictional intake',()=>write(`/api/cases/${brief.case_id}/intake`,{...expected(),intake_schema_version:'1',answers:{fictional_browser_exercise:true},unknowns:[]}));
 const makeDraft=()=>run('Draft plan',()=>write(`/api/cases/${brief.case_id}/plans`,{...expected(),locale:'en'}));
 const review=()=>run('Owner review',async()=>{if(!latest||!reviewChecked)throw Error('EXACT_REVIEW_REQUIRED');await write(`/api/plans/${latest.id}/review`,{...expected(),reviewed_digest:latest.digest});setReviewChecked(false);});
 const acknowledge=()=>run('Exact handover acknowledgment',async()=>{if(!handover)throw Error('NO_CURRENT_HANDOVER');await write(`/api/handovers/${handover.id}/acknowledge`,{acknowledged_digest:handover.digest});});
 const acknowledgeSam=()=>run('Sam’s exact handover acknowledgment',async()=>{if(!handover||!samAcks)throw Error('SAMPLE_CAREGIVER_UNAVAILABLE');await write('/api/caregiver/acknowledge',{handover_id:handover.id,acknowledged_digest:handover.digest});});
 const check=async()=>{setBusy(true);setError('');try{const b=await freshBrief();const result=await write<{status:string;blocker:string|null}>('/api/sessions/preflight',bindState(b));setPreflight(result.status==='ready_for_human_start'?'Ready for an explicit human start. This is a fictional software session.':`Start blocked: ${result.blocker??result.status}.`);}catch(e){setPreflight('');setError(`Preflight refused: ${(e as Error).message.replaceAll('_',' ')}.`);}finally{setBusy(false);}};
 const start=()=>run('Human session start',async()=>{if(!handover||!acknowledged||preflight!=='Ready for an explicit human start. This is a fictional software session.')throw Error('PREFLIGHT_REQUIRED');const b=await freshBrief();await write('/api/sessions',{...bindState(b),handover_id:handover.id,handover_digest:handover.digest});});
 const saveObservation=(event:React.FormEvent)=>{event.preventDefault();void run('Session observation draft',async()=>{if(!session||session.state!=='active')throw Error('NO_ACTIVE_SESSION');await write(`/api/sessions/${session.id}/observations`,{expected_safety_epoch:graph!.household.safety_epoch,expected_state:'active',raw_report:report.trim(),actor_pet_id:actorPet||null,target_pet_id:targetPet||null,assertion,source_kind:'typed',observed_at:observedAt?new Date(observedAt).toISOString():null,reported_at:null,behavior_code:null,normalized_observation:{schema_version:'1',values:{requires_pause:true,policy_level:'clarification'},unknowns:[]}});setReport('');});};
 const confirm=()=>run('Human report confirmation',async()=>{if(!session||!draft||!draft.actor_pet_id)throw Error('ATTRIBUTION_REQUIRED');await write(`/api/sessions/${session.id}/observations/confirm`,{expected_safety_epoch:graph!.household.safety_epoch,expected_state:'active',observation_id:draft.id,digest:draft.digest});});
 if(brief.role!=='owner')return null;
 return <section className="panel journey" aria-labelledby="journey-title"><div className="panel-top"><div><span className="eyebrow">Human-operated software flow</span><h2 id="journey-title">Review this fictional case</h2></div><span className="badge">{current?.scenario_code??'Case'}</span></div>
  <p className="small">These controls write to the local fictional household. Owner review is a record decision, not professional protocol approval. No step operates a physical device or gives practical animal guidance.</p>
  {!graph||!workspace?<p role="status">{error?'Current review state unavailable. Refresh before acting.':'Retrieving the current review and session state…'}</p>:<div className="journey-steps">
   <div className="journey-step"><strong>1 · Intake</strong><p>Current route: {current?.support_level.replaceAll('_',' ')??'unknown'}. Revisit the fictional intake to create a fresh safety version.</p><button className="secondary" type="button" disabled={busy||!!session} onClick={route}>Save fictional intake</button></div>
   <div className="journey-step"><strong>2 · Plan revision</strong><p>Latest: {latest?`Revision ${latest.revision_number}, ${latest.status.replaceAll('_',' ')}`:'No plan revision'}. {brief.protocol_status} content.</p><button className="secondary" type="button" disabled={busy||!!session||current?.support_level!=='guided_preparation'||latest?.status==='draft'||latest?.status==='reviewed'} onClick={makeDraft}>Create draft for owner review</button>{current?.support_level!=='guided_preparation'&&<p className="small">This route supports coordination only or requires clarification/help. No guided session can be created here.</p>}</div>
   {latest?.status==='draft'&&<div className="journey-step"><strong>3 · Owner review</strong><p>Exact revision {latest.revision_number}; digest <code>{latest.digest}</code>. Confirm only after reading the current fictional case and home record.</p><label className="checkbox"><input type="checkbox" checked={reviewChecked} onChange={e=>setReviewChecked(e.target.checked)}/>I reviewed this exact fictional revision.</label><button className="secondary" type="button" disabled={busy||!reviewChecked} onClick={review}>Record owner review</button></div>}
   {latest?.status==='reviewed'&&handover&&<div className="journey-step"><strong>4 · Handover</strong><p>{handover.body.summary}</p><p className="small">Each person acknowledges this exact revision in their own authenticated session. Reading does not prove any physical action.</p><div className="button-row"><button className="secondary" type="button" disabled={busy||acknowledged} onClick={acknowledge}>{acknowledged?'Acknowledged in this owner account':'Acknowledge exact handover'}</button>{samAcks&&<button className="secondary" type="button" disabled={busy||samAcknowledged} onClick={acknowledgeSam}>{samAcknowledged?'Sam acknowledged this version':'Sam acknowledges exact handover'}</button>}</div>{!samAcks&&<p className="small">A separate sample caregiver session is unavailable in this household.</p>}</div>}
   {latest?.status==='reviewed'&&acknowledged&&!session&&<div className="journey-step"><strong>5 · Session</strong><p>A session needs a fresh server check and a separate human start. Time alone never advances a plan.</p><div className="button-row"><button className="secondary" type="button" disabled={busy} onClick={()=>void check()}>Check session preflight</button><button className="primary" type="button" disabled={busy||!preflight.startsWith('Ready for')} onClick={start}>Start fictional software session</button></div>{preflight&&<p role="status">{preflight}</p>}</div>}
   {session&&<div className="journey-step"><strong>Session · {session.state.replaceAll('_',' ')}</strong><p>Fictional software state only. No physical state is verified. Local Stop remains available below.</p>{session.state==='active'&&!draft&&<form onSubmit={saveObservation}><label>Exact fictional report<textarea required maxLength={1500} value={report} onChange={e=>setReport(e.target.value)} placeholder="Describe a fictional observation without interpreting it"/></label><div className="form-grid"><label>Observed pet<select required value={actorPet} onChange={e=>{setActorPet(e.target.value);if(e.target.value===targetPet)setTargetPet('');}}><option value="">Select</option>{brief.pets.map(p=><option key={p.id} value={p.id}>{p.nickname} ({p.species})</option>)}</select></label><label>Directed toward<select value={targetPet} onChange={e=>setTargetPet(e.target.value)}><option value="">No target or unknown</option>{(brief.pets.length>1?brief.pets.filter(p=>p.id!==actorPet):[]).map(p=><option key={p.id} value={p.id}>{p.nickname} ({p.species})</option>)}</select></label><label>Report meaning<select value={assertion} onChange={e=>setAssertion(e.target.value as typeof assertion)}><option value="uncertain">Uncertain</option><option value="affirmed">Affirmed</option><option value="negated">Negated</option></select></label><label>Observed time <span className="optional">Optional</span><input type="datetime-local" value={observedAt} onChange={e=>setObservedAt(e.target.value)}/></label></div><p className="small">This form explicitly flags a fictional clarification concern. A draft does not confirm it; confirmation is a separate human action.</p><button className="secondary" disabled={busy||!report.trim()||!actorPet}>Save exact draft</button></form>}{draft&&<div className="draft-review"><p><strong>Draft awaiting your review:</strong> {draft.raw_report}</p><p className="small">Observed pet: {brief.pets.find(p=>p.id===draft.actor_pet_id)?.nickname??'Unresolved'} · Target: {brief.pets.find(p=>p.id===draft.target_pet_id)?.nickname??'none/unknown'} · {draft.assertion} · time {draft.observed_at??'not supplied'}.</p><button className="secondary" type="button" disabled={busy||!draft.actor_pet_id||session.state!=='active'} onClick={confirm}>Confirm this exact fictional report and pause guidance</button></div>}</div>}
  </div>}
  {notice&&<p className="inline-notice" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
  <button className="text-button" type="button" onClick={()=>void load().catch(e=>setError(`Refresh failed: ${(e as Error).message}.`))}>Refresh journey state</button>
 </section>;
}
