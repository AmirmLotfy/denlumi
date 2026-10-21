'use client';

import { useEffect,useMemo,useState } from 'react';
import type { Brief } from '../../../packages/contracts/phase0';

type View='today'|'pets'|'home'|'history';
type Pet={id:string;nickname:string;species:'cat'|'dog';archived_at:string|null;age_band:string|null;aliases?:string[]};
type Case={id:string;title:string;scenario_code:string;support_level:string;support_reason_code:string|null;status:string};
type Participant={case_id:string;pet_id:string;role:string};
type Pair={id:string;pet_a_id:string;pet_b_id:string};
type Context={case_id:string;pair_id:string;context_key:string};
type Graph={household:{home_version:number;state_version:number;safety_epoch:number};pets:Pet[];cases:Case[];participants:Participant[];pairs:Pair[];contexts:Context[];membership:{role:string;pet_scope:string[]|null;case_scope:string[]|null};as_of:string};
type Zone={id:string;label:string;home_version:number;arrangement_note:string|null;reported_at:string|null};
type Resource={id:string;zone_id:string;kind:string;label:string;status:string};
type Access={resource_id:string;pet_id:string;access_plan:string};
type Responsibility={home_version:number;profile_id:string;pet_id:string|null;label:string;status:string;note:string|null};
type Handover={id:string;case_id:string;safety_epoch:number;created_at:string;status:string;body:{summary?:string}};
type Planning={household:{home_version:number};zones:Zone[];resources:Resource[];pet_resource_access:Access[];responsibilities:Responsibility[];handovers:Handover[];as_of:string};
type Task={id:string;nickname:string;kind:string|null;due_at:string;state:string;reports:{id:string;report:string;corrected_report:string|null;created_at:string;reporter_id:string}[];ingestion_verified:false};
type Due={tasks:Task[];as_of:string;notice:string};
type Inbox={items:{id:string;status:string;created_at:string;event_type:string;last_error_code:string|null}[]};
const stamp=(value:string|null|undefined)=>value?new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Time not supplied';
const word=(value:string|null|undefined)=>value?value.replaceAll('_',' '):'Unknown';
async function read<T>(url:string):Promise<T>{const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});const value=await response.json();if(!response.ok)throw Error(value.error??'REQUEST_FAILED');return value as T;}

function RoutineReportForm({task,onReported}:{task:Task;onReported:(message:string)=>void}){
 const [report,setReport]=useState<'done'|'skipped'|'uncertain'>('uncertain'),[note,setNote]=useState(''),[saving,setSaving]=useState(false),[failure,setFailure]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();if(saving)return;setSaving(true);setFailure('');
  try{
   const response=await fetch(`/api/tasks/${task.id}/reports`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({report,performed_at:null,note:note.trim()||null})});
   const result=await response.json();if(!response.ok)throw Error(result.error??'REPORT_REFUSED');
   setNote('');onReported(result.conflict?'Report saved. Caregivers disagree; the current record needs review.':`Report saved. Current recorded state: ${word(result.effective_state)}. This does not verify physical care.`);
  }catch(e){setFailure(`Report was not saved: ${(e as Error).message}. Retrieve current records before retrying if the task changed.`);}
  finally{setSaving(false);}
 }
 return <form className="routine-report" aria-label={`Report ${task.nickname} routine`} onSubmit={submit}>
  <label>Caregiver report<select value={report} onChange={e=>setReport(e.target.value as typeof report)}><option value="uncertain">Uncertain</option><option value="done">Reported done</option><option value="skipped">Reported skipped</option></select></label>
  <label>Report note <span className="optional">Optional</span><textarea maxLength={1000} rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="What the caregiver reported; no physical verification"/></label>
  <button className="secondary" disabled={saving||task.state==='canceled'}>{saving?'Saving report…':'Save caregiver report'}</button>
  {task.state==='canceled'&&<p className="small">Canceled tasks cannot receive a new report.</p>}
  {failure&&<p className="error" role="alert">{failure}</p>}
 </form>;
}

export default function HouseholdViews({view,brief,onChanged}:{view:View;brief:Brief;onChanged?:()=>void}){
 const [graph,setGraph]=useState<Graph|null>(null),[planning,setPlanning]=useState<Planning|null>(null),[due,setDue]=useState<Due|null>(null),[inbox,setInbox]=useState<Inbox|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [reload,setReload]=useState(0),[zoneLabel,setZoneLabel]=useState(''),[zoneNote,setZoneNote]=useState(''),[resourceLabel,setResourceLabel]=useState(''),[resourceKind,setResourceKind]=useState('other'),[resourceStatus,setResourceStatus]=useState('unknown'),[accessPet,setAccessPet]=useState(''),[accessPlan,setAccessPlan]=useState('unknown'),[saving,setSaving]=useState(false),[saveNotice,setSaveNotice]=useState(''),[routineNotice,setRoutineNotice]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');
  const id=brief.household_id;
  void Promise.all([
   read<Graph>(`/api/households/${id}/graph`),
   read<Planning>(`/api/households/${id}/planning`),
   read<Due>(`/api/households/${id}/routine-occurrences`),
   read<Inbox>(`/api/households/${id}/inbox`)
  ]).then(([g,p,d,i])=>{if(active){setGraph(g);setPlanning(p);setDue(d);setInbox(i);}}).catch(e=>{if(active)setError(`Current household details could not be retrieved: ${(e as Error).message}.`);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[brief.household_id,brief.safety_epoch,view,reload]);
 const petById=useMemo(()=>new Map(graph?.pets.map(p=>[p.id,p])??[]),[graph]);
 const caseName=useMemo(()=>new Map(graph?.cases.map(c=>[c.id,c.title])??[]),[graph]);
 async function addZone(event:React.FormEvent){event.preventDefault();if(!graph||!planning||saving)return;setSaving(true);setSaveNotice('');setError('');
  try{
   const currentZones=planning.zones.filter(z=>z.home_version===planning.household.home_version).map(z=>({key:`zone-${z.id}`,label:z.label,arrangement_note:z.arrangement_note,resources:planning.resources.filter(r=>r.zone_id===z.id).map(r=>({key:`resource-${r.id}`,kind:r.kind,label:r.label,status:r.status,pet_access:planning.pet_resource_access.filter(a=>a.resource_id===r.id).map(a=>({pet_id:a.pet_id,access_plan:a.access_plan}))}))}));
   const resources=resourceLabel.trim()?[{key:'new-resource',kind:resourceKind,label:resourceLabel.trim(),status:resourceStatus,pet_access:accessPet?[{pet_id:accessPet,access_plan:accessPlan}]:[]}]:[];
   const responsibilities=planning.responsibilities.filter(r=>r.home_version===planning.household.home_version).map(r=>({profile_id:r.profile_id,pet_id:r.pet_id,label:r.label,status:r.status,note:r.note}));
   const response=await fetch(`/api/households/${brief.household_id}/home`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expected_state_version:graph.household.state_version,expected_safety_epoch:graph.household.safety_epoch,zones:[...currentZones,{key:'new-zone',label:zoneLabel.trim(),arrangement_note:zoneNote.trim()||null,resources}],responsibilities})});
   const result=await response.json();if(!response.ok)throw Error(result.error??'HOME_SAVE_FAILED');
   setZoneLabel('');setZoneNote('');setResourceLabel('');setAccessPet('');setSaveNotice('The new home record was saved. Earlier plan review is stale and must be revisited. This does not verify a physical arrangement.');setReload(n=>n+1);onChanged?.();
  }catch(e){setError(`Home record was not saved: ${(e as Error).message}. Refresh before retrying a stale edit.`);}
  finally{setSaving(false);}
 }
 if(loading)return <section className="panel" aria-busy="true" role="status">Retrieving current {view} records…</section>;
 if(error)return <section className="panel"><p className="error" role="alert">{error}</p><p className="small">No cached record is shown as current after a read failure.</p><button className="secondary" onClick={()=>{setError('');setReload(n=>n+1);}}>Retrieve current records again</button></section>;
 if(!graph||!planning||!due||!inbox)return null;
 if(view==='today')return <section className="panel" aria-labelledby="today-tasks-title"><div className="panel-top"><h2 id="today-tasks-title">Routine reports</h2><span className="small">Retrieved {stamp(due.as_of)}</span></div>
  <p className="small">These are caregiver records, not proof that a pet ate, exercised or received treatment.</p>
  {due.tasks.length?<ul className="record-list">{due.tasks.map(task=><li key={task.id}><div className="record-head"><strong>{task.nickname} · {word(task.kind)}</strong><span>{stamp(task.due_at)}</span></div><p>Scheduled state: {word(task.state)}. {task.reports.length?`${task.reports.length} attributed report${task.reports.length===1?'':'s'}.`:'No completion reported.'}</p>{task.reports.map(report=><p className="small" key={report.id}>Caregiver report · {word(report.corrected_report??report.report)} · {stamp(report.created_at)}{report.report==='correction'?' · correction':''}</p>)}{graph.membership.role!=='reader'&&<RoutineReportForm task={task} onReported={message=>{setRoutineNotice(message);setReload(n=>n+1);}}/>}</li>)}</ul>:<p className="empty-record">No routine occurrences are recorded for this period.</p>}
  {routineNotice&&<p className="inline-notice" role="status">{routineNotice}</p>}
  {inbox.items.length>0&&<details><summary>Internal notices ({inbox.items.length})</summary><ul className="record-list">{inbox.items.map(item=><li key={item.id}>{word(item.event_type)} · {word(item.status)} · {stamp(item.created_at)}{item.last_error_code&&<span> · Failure: {item.last_error_code}</span>}</li>)}</ul><p className="small">An internal notice is not proof of external delivery or caregiver acknowledgment.</p></details>}
 </section>;
 if(view==='pets')return <section className="panel view-panel" aria-labelledby="pets-title"><div className="panel-top"><div><span className="eyebrow">Household records</span><h2 id="pets-title">Pets and situations</h2></div><span className="small">{graph.pets.filter(p=>!p.archived_at).length} active pet{graph.pets.filter(p=>!p.archived_at).length===1?'':'s'}</span></div>
  <p className="muted">Names and species identify each record. A case describes its participants and reported context; it does not rate compatibility.</p>
  {graph.pets.length?<ul className="pet-card-grid">{graph.pets.map(p=><li className="pet-card" key={p.id}><span className="initial" aria-hidden="true">{p.nickname[0]}</span><div><strong>{p.nickname}</strong><p>{p.species}{p.age_band?` · ${p.age_band}`:''}{p.archived_at?' · archived':''}</p>{p.aliases?.length?<p className="small">Also called {p.aliases.join(', ')}</p>:null}</div></li>)}</ul>:<p className="empty-record">No pets have been recorded. A single pet is a complete household; no second pet is required.</p>}
  <h3>Situations</h3>{graph.cases.length?<div className="case-grid">{graph.cases.map(c=>{const members=graph.participants.filter(p=>p.case_id===c.id);const contexts=graph.contexts.filter(x=>x.case_id===c.id);return <article className="case-card" key={c.id}><div className="record-head"><strong>{c.title}</strong><span>Scenario {c.scenario_code}</span></div><p>Support route: {word(c.support_level)}. {c.support_reason_code?`Reason: ${word(c.support_reason_code)}.`:''}</p><ul className="plain-list">{members.map(m=><li key={m.pet_id}>{petById.get(m.pet_id)?.nickname??'Scoped pet'} · {petById.get(m.pet_id)?.species??'species unknown'} · {word(m.role)}</li>)}</ul>{members.length===1&&<p className="small">Single-pet situation. No pair or placeholder pet.</p>}{contexts.length>0&&<details><summary>Separate pair contexts ({contexts.length})</summary><ul className="plain-list">{contexts.map(context=>{const pair=graph.pairs.find(p=>p.id===context.pair_id);return <li key={`${context.pair_id}-${context.context_key}`}>{pair?[petById.get(pair.pet_a_id)?.nickname??'Pet',petById.get(pair.pet_b_id)?.nickname??'Pet'].join(' & '):'Pair record'} · {context.context_key} · no group-readiness inference</li>;})}</ul></details>}</article>;})}</div>:<p className="empty-record">No situation has been recorded. Daily coordination can still use individual pet records.</p>}
 </section>;
 if(view==='home'){
  const zones=planning.zones.filter(z=>z.home_version===planning.household.home_version),responsibilities=planning.responsibilities.filter(r=>r.home_version===planning.household.home_version);
  return <section className="panel view-panel" aria-labelledby="home-title"><div className="panel-top"><div><span className="eyebrow">Versioned home record</span><h2 id="home-title">Home arrangements</h2></div><span className="badge">Version {planning.household.home_version}</span></div><p className="muted">Zones and access are recorded plans, not live sensor readings or evidence that a barrier, feeder or door is physically set.</p>
   {zones.length?<div className="case-grid">{zones.map(z=><article className="case-card" key={z.id}><div className="record-head"><strong>{z.label}</strong><span>Reported {stamp(z.reported_at)}</span></div><p>{z.arrangement_note??'No arrangement note recorded.'}</p><ul className="record-list">{planning.resources.filter(r=>r.zone_id===z.id).map(r=><li key={r.id}><strong>{r.label}</strong> · {word(r.kind)} · {word(r.status)}{planning.pet_resource_access.filter(a=>a.resource_id===r.id).map(a=><p className="small" key={`${a.resource_id}-${a.pet_id}`}>{petById.get(a.pet_id)?.nickname??'Scoped pet'}: {word(a.access_plan)} access planned</p>)}</li>)}</ul></article>)}</div>:<p className="empty-record">No home zones are recorded for the current version.</p>}
   <h3>Caregiver responsibilities</h3>{responsibilities.length?<ul className="record-list">{responsibilities.map((r,index)=><li key={`${r.profile_id}-${r.pet_id}-${index}`}><strong>{r.label}</strong> · {word(r.status)}{r.pet_id?` · ${petById.get(r.pet_id)?.nickname??'Scoped pet'}`:''}{r.note&&<p className="small">{r.note}</p>}</li>)}</ul>:<p className="empty-record">No responsibilities are recorded for this version.</p>}
   {graph.membership.role==='owner'&&<details className="home-editor"><summary>Add a reported zone</summary><p className="small">Saving creates a complete new home-record version, preserving the listed zones and responsibilities. It invalidates earlier plan review. Enter only fictional or owner-reported information; no device is operated.</p><form onSubmit={addZone}>
    <label>Zone name<input required maxLength={120} value={zoneLabel} onChange={e=>setZoneLabel(e.target.value)} placeholder="Fictional room name"/></label>
    <label>Arrangement note <span className="optional">Optional</span><textarea maxLength={1500} rows={3} value={zoneNote} onChange={e=>setZoneNote(e.target.value)}/></label>
    <label>Resource label <span className="optional">Optional</span><input maxLength={120} value={resourceLabel} onChange={e=>setResourceLabel(e.target.value)}/></label>
    {resourceLabel.trim()&&<div className="form-grid"><label>Resource type<select value={resourceKind} onChange={e=>setResourceKind(e.target.value)}>{['water','food','litter','rest','retreat','enrichment','barrier','other'].map(kind=><option key={kind} value={kind}>{word(kind)}</option>)}</select></label><label>Reported resource state<select value={resourceStatus} onChange={e=>setResourceStatus(e.target.value)}><option value="unknown">Unknown</option><option value="planned">Planned</option><option value="reported_present">Reported present</option><option value="removed">Reported removed</option></select></label><label>Planned access for pet <span className="optional">Optional</span><select value={accessPet} onChange={e=>setAccessPet(e.target.value)}><option value="">No pet selected</option>{graph.pets.filter(p=>!p.archived_at).map(p=><option key={p.id} value={p.id}>{p.nickname} ({p.species})</option>)}</select></label>{accessPet&&<label>Access plan<select value={accessPlan} onChange={e=>setAccessPlan(e.target.value)}><option value="unknown">Unknown</option><option value="exclusive">Exclusive</option><option value="shared">Shared</option><option value="separate_times">Separate times</option></select></label>}</div>}
    <button className="primary" disabled={saving||!zoneLabel.trim()}>{saving?'Saving reported zone…':'Save new home record'}</button>
   </form></details>}
   {saveNotice&&<p className="inline-notice" role="status">{saveNotice}</p>}
  </section>;
 }
 const events=[...brief.observations.map(o=>({id:o.id,when:o.reported_at,title:'Caregiver observation',body:o.raw_report,meta:`${word(o.assertion)} · ${word(o.status)} · observed ${stamp(o.observed_at)} · reported ${stamp(o.reported_at)} · ${word(o.source_kind)}`})),...planning.handovers.map(h=>({id:h.id,when:h.created_at,title:`Handover · ${caseName.get(h.case_id)??'case'}`,body:h.body.summary??'No summary recorded.',meta:`Update ${h.safety_epoch} · ${word(h.status)}`}))].sort((a,b)=>new Date(b.when).getTime()-new Date(a.when).getTime());
 return <section className="panel view-panel" aria-labelledby="history-title"><div className="panel-top"><div><span className="eyebrow">Attributed record</span><h2 id="history-title">History</h2></div><span className="small">Retrieved {stamp(planning.as_of)}</span></div><p className="muted">Handover history spans this household. Observations below cover the selected case only. Corrections remain separate attributed records; nothing here verifies physical state.</p>
  {events.length?<ol className="history-list">{events.map(event=><li key={event.id}><div className="record-head"><strong>{event.title}</strong><time dateTime={event.when}>{stamp(event.when)}</time></div><p>{event.body}</p><p className="small">{event.meta}</p></li>)}</ol>:<p className="empty-record">No attributed history is recorded for this view.</p>}
 </section>;
}
