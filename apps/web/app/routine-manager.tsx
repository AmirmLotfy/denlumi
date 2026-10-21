'use client';

import { useEffect,useRef,useState,type FormEvent } from 'react';

type Pet={id:string;nickname:string;species:string;archived_at:string|null};
type State={state_version:number;safety_epoch:number;timezone:string};
type Graph={household:State;pets:Pet[];membership:{role:string}};
type Schedule={schema_version:'1';timezone:string;frequency:'daily'|'weekly';local_time:string;days_of_week:number[];dst_policy:'wall_clock_first_valid'};
type Rule={id:string;pet_id:string;kind:string;instruction:string;status:'active'|'paused'|'archived';version:number;schedule_spec:Schedule};
type RuleList={actor_id:string;rules:Rule[];as_of:string;household:State};
type Report={id:string;reporter_id:string;report:string;corrected_report:string|null;performed_at:string|null;created_at:string;supersedes_id:string|null;note:string|null};
type Task={id:string;nickname:string;kind:string|null;instruction:string|null;rule_version:number|null;due_at:string;state:string;conflict:boolean;claims:{id:string;profile_id:string;state:string;created_at:string}[];reports:Report[]};
type Due={tasks:Task[];as_of:string};
type Bundle={graph:Graph;rules:RuleList;due:Due};
type Save=(method:string,url:string,value:unknown,message:string)=>Promise<boolean>;
const kinds=['meal','water','walk','litter','rest','enrichment','other_nonmedical'];
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const word=(value:string|null)=>value?.replaceAll('_',' ')??'Unknown';
const stamp=(value:string|null)=>value?new Date(value).toLocaleString():'Not supplied';
const localInput=(value:string|null)=>{if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const instant=(value:string)=>value?new Date(value).toISOString():null;
const today=()=>new Date().toISOString().slice(0,10);
async function read<T>(url:string):Promise<T>{const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});const value=await response.json();if(!response.ok)throw Error(value.error??'REQUEST_FAILED');return value as T;}

function RuleForm({rule,pets,householdId,state,save,busy}:{rule?:Rule;pets:Pet[];householdId:string;state:State;save:Save;busy:boolean}){
 const [pet,setPet]=useState(rule?.pet_id??''),[kind,setKind]=useState(rule?.kind??'water'),[instruction,setInstruction]=useState(rule?.instruction??''),[status,setStatus]=useState<Rule['status']>(rule?.status??'active');
 const [timezone,setTimezone]=useState(rule?.schedule_spec.timezone??state.timezone),[frequency,setFrequency]=useState<Schedule['frequency']>(rule?.schedule_spec.frequency??'daily'),[time,setTime]=useState(rule?.schedule_spec.local_time??'09:00'),[selectedDays,setSelectedDays]=useState<number[]>(rule?.schedule_spec.days_of_week??[]),[validation,setValidation]=useState('');
 const name=rule?`Edit routine ${pets.find(p=>p.id===rule.pet_id)?.nickname??'archived pet'} ${word(rule.kind)}`:'Create routine rule';
 async function submit(event:FormEvent){event.preventDefault();setValidation('');
  try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{setValidation('Enter a valid IANA timezone, for example Africa/Cairo.');return;}
  if(frequency==='weekly'&&!selectedDays.length){setValidation('Select at least one day for a weekly schedule.');return;}
  const body={expected_state_version:state.state_version,expected_safety_epoch:state.safety_epoch,pet_id:rule?.pet_id??pet,kind,instruction:instruction.trim(),schedule_spec:{schema_version:'1',timezone,frequency,local_time:time,days_of_week:frequency==='weekly'?[...selectedDays].sort():[],dst_policy:'wall_clock_first_valid'},...(rule?{expected_rule_version:rule.version,status}:{})};
  const saved=await save(rule?'PUT':'POST',`/api/households/${householdId}/routine-rules${rule?`/${rule.id}`:''}`,body,rule?'Routine rule updated. Historical occurrences and reports remain unchanged.':'Routine rule created.');
  if(saved&&!rule){setInstruction('');setPet('');}
 }
 return <form aria-label={name} onSubmit={submit} className="routine-report"><h3>{name}</h3><fieldset disabled={busy} style={{minWidth:0,border:0,padding:0}}>
  <label>Routine pet<select required value={pet} disabled={Boolean(rule)} onChange={event=>setPet(event.target.value)}><option value="">Choose a named pet</option>{pets.filter(p=>!p.archived_at||p.id===rule?.pet_id).map(p=><option key={p.id} value={p.id}>{p.nickname} ({p.species}){p.archived_at?' · archived':''}</option>)}</select></label>
  {rule&&<p className="small">Pet identity is fixed. Create a separate rule for a different pet.</p>}
  <label>Routine kind<select value={kind} onChange={event=>setKind(event.target.value)}>{kinds.map(value=><option value={value} key={value}>{word(value)}</option>)}</select></label>
  <label>Owner instruction<textarea required maxLength={1000} rows={2} value={instruction} onChange={event=>setInstruction(event.target.value)}/></label>
  <p className="small">Use owner-entered nonmedical coordination only. No quantities, frequencies or practical handling advice are prescribed by Denlumi.</p>
  <div className="form-grid"><label>Schedule timezone<input required maxLength={100} value={timezone} onChange={event=>setTimezone(event.target.value)} placeholder="Africa/Cairo"/></label><label>Schedule frequency<select value={frequency} onChange={event=>setFrequency(event.target.value as Schedule['frequency'])}><option value="daily">Daily</option><option value="weekly">Weekly on selected days</option></select></label><label>Local scheduled time<input required type="time" value={time} onChange={event=>setTime(event.target.value)}/></label></div>
  {frequency==='weekly'?<fieldset style={{minWidth:0}}><legend>Scheduled days</legend>{days.map((day,index)=><label key={day} className="checkbox"><input type="checkbox" checked={selectedDays.includes(index)} onChange={event=>setSelectedDays(current=>event.target.checked?[...current,index]:current.filter(value=>value!==index))}/>{day}</label>)}</fieldset>:<p className="small">Scheduled every day in the stated timezone.</p>}
  <p className="small">At a daylight-saving gap the first valid minute is used; a repeated time uses its first occurrence.</p>
  {rule?<label>Routine status<select value={status} onChange={event=>setStatus(event.target.value as Rule['status'])}><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>:<p>New rule status: active.</p>}
  {rule&&<p className="small">Rule version {rule.version}. Saving cancels future planned or claimed occurrences from this rule; generate fresh occurrences for an active revised rule.</p>}
  <button className="secondary" disabled={busy||!instruction.trim()||!pet}>{rule?'Save routine changes':'Create routine rule'}</button>
 </fieldset>{validation&&<p role="alert" className="error">{validation}</p>}</form>;
}

function ReportForm({task,report,save,busy}:{task:Task;report?:Report;save:Save;busy:boolean}){
 const [outcome,setOutcome]=useState(report?.corrected_report??report?.report??'uncertain'),[performed,setPerformed]=useState(localInput(report?.performed_at??null)),[note,setNote]=useState('');
 async function submit(event:FormEvent){event.preventDefault();
  const body=report?{report:'correction',supersedes_id:report.id,corrected_report:outcome,performed_at:instant(performed),note:note.trim()}:{report:outcome,performed_at:instant(performed),note:note.trim()||null};
  await save('POST',`/api/tasks/${task.id}/reports`,body,report?'Correction appended. The original report remains in history.':'Attributed report saved. This does not verify physical care.');
 }
 return <form aria-label={report?'Correct my task report':'Add attributed task report'} className="routine-report" onSubmit={submit}><fieldset disabled={busy||task.state==='canceled'} style={{minWidth:0,border:0,padding:0}}>
  <label>{report?'Corrected outcome':'Reported outcome'}<select value={outcome} onChange={event=>setOutcome(event.target.value)}><option value="uncertain">Uncertain</option><option value="done">Reported done</option><option value="skipped">Reported skipped</option></select></label>
  <label>Performed time <span className="optional">Optional, your browser’s local time</span><input type="datetime-local" value={performed} onChange={event=>setPerformed(event.target.value)}/></label>
  <label>{report?'Correction reason':'Report note'}{!report&&<span className="optional"> Optional</span>}<textarea required={Boolean(report)} maxLength={1000} rows={2} value={note} onChange={event=>setNote(event.target.value)}/></label>
  <button className="secondary" disabled={busy||Boolean(report&&!note.trim())||task.state==='canceled'}>{report?'Append correction':'Add report'}</button>
 </fieldset></form>;
}

export default function RoutineManager(props:{householdId:string;onChanged?:()=>void}){return <RoutineManagerInner key={props.householdId} {...props}/>;}

function RoutineManagerInner({householdId,onChanged}:{householdId:string;onChanged?:()=>void}){
 const [bundle,setBundle]=useState<Bundle|null>(null),[retrieving,setRetrieving]=useState(true),[busy,setBusy]=useState(false),[readFailure,setReadFailure]=useState(''),[failure,setFailure]=useState(''),[notice,setNotice]=useState('');
 const [from,setFrom]=useState(today),[through,setThrough]=useState(today);
 const alive=useRef(true),generation=useRef(0),keys=useRef(new Map<string,string>()),inFlight=useRef(false);
 async function retrieve(){const current=++generation.current;setRetrieving(true);setReadFailure('');
  try{const [graph,rules,due]=await Promise.all([read<Graph>(`/api/households/${householdId}/graph`),read<RuleList>(`/api/households/${householdId}/routine-rules`),read<Due>(`/api/households/${householdId}/routine-occurrences`)]);if(alive.current&&current===generation.current){setBundle({graph,rules,due});setFailure('');}}
  catch(error){if(alive.current&&current===generation.current){setBundle(null);setReadFailure(`Routine records could not be retrieved: ${(error as Error).message}. No cached record is shown as current.`);}}
  finally{if(alive.current&&current===generation.current)setRetrieving(false);}
 }
 useEffect(()=>{alive.current=true;void retrieve();return()=>{alive.current=false;generation.current++;};},[householdId]);
 const save:Save=async(method,url,value,message)=>{
  if(inFlight.current||retrieving||readFailure||!bundle)return false;
  inFlight.current=true;setBusy(true);setFailure('');setNotice('');
  const encoded=JSON.stringify(value),fingerprint=`${method}:${url}:${encoded}`;
  let key=keys.current.get(fingerprint);if(!key){key=crypto.randomUUID();keys.current.set(fingerprint,key);}
  try{const response=await fetch(url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:encoded});const result=await response.json();if(!response.ok)throw Error(result.error??'SAVE_REFUSED');if(!alive.current)return false;keys.current.delete(fingerprint);setNotice(message==='GENERATED'?`Occurrences generated: ${result.value.created}. Existing occurrences are preserved.`:message);await retrieve();if(alive.current)onChanged?.();return alive.current;}
  catch(error){if(alive.current)setFailure(`The operation was not confirmed: ${(error as Error).message}. An unchanged retry reuses its request key. Retrieve current records before changing a stale request.`);return false;}
  finally{inFlight.current=false;if(alive.current)setBusy(false);}
 };
 async function generate(event:FormEvent){event.preventDefault();if(!bundle)return;await save('POST',`/api/households/${householdId}/routine-occurrences`,{expected_state_version:bundle.rules.household.state_version,expected_safety_epoch:bundle.rules.household.safety_epoch,from_date:from,through_date:through},'GENERATED');}
 return <section aria-label="Routine management" className="view-panel" style={{overflowWrap:'anywhere'}}><h2>Routine management</h2>
  <p className="small">Owner-entered routines and attributed caregiver reports. Claims, reports and notices do not establish that an animal ate or received care. No medical or device action is performed.</p>
  {notice&&<p role="status" className="inline-notice">{notice}</p>}{failure&&<p role="alert" className="error">{failure}</p>}{readFailure&&<p role="alert" className="error">{readFailure}</p>}
  <button className="secondary" disabled={busy||retrieving} onClick={()=>void retrieve()}>Retrieve routine records again</button>
  {retrieving?<p role="status" aria-busy="true">Retrieving current routine records…</p>:bundle&&!readFailure?<>
   <p className="small">Retrieved {stamp(bundle.rules.as_of)}. Reporting as {bundle.rules.actor_id}.</p>
   {bundle.graph.membership.role==='owner'?<>
    {bundle.graph.pets.some(p=>!p.archived_at)?<RuleForm pets={bundle.graph.pets} householdId={householdId} state={bundle.rules.household} save={save} busy={busy}/>:<p>Add a pet record before creating a routine. A single pet is sufficient.</p>}
    {bundle.rules.rules.length?<ul className="record-list">{bundle.rules.rules.map(rule=><li key={`${rule.id}:${rule.version}`}><RuleForm rule={rule} pets={bundle.graph.pets} householdId={householdId} state={bundle.rules.household} save={save} busy={busy}/></li>)}</ul>:<p>No routine rules are recorded.</p>}
    <form aria-label="Generate routine occurrences" onSubmit={generate} className="routine-report"><h3>Generate scheduled occurrences</h3><fieldset disabled={busy} style={{minWidth:0,border:0,padding:0}}><label>From date<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>Through date<input required type="date" min={from} value={through} onChange={event=>setThrough(event.target.value)}/></label><p className="small">Dates follow each active rule’s timezone and selected days. Paused and archived rules create no occurrences. No external reminder is sent.</p><button className="secondary" disabled={busy||through<from}>Generate occurrences</button></fieldset></form>
   </>:<><h3>Scoped routine rules</h3>{bundle.rules.rules.length?<ul className="record-list">{bundle.rules.rules.map(rule=><li key={rule.id}>{bundle.graph.pets.find(p=>p.id===rule.pet_id)?.nickname??'Scoped pet'} · {word(rule.kind)} · {word(rule.status)}<p>{rule.instruction}</p><p className="small">{rule.schedule_spec.timezone} · {rule.schedule_spec.local_time} · {rule.schedule_spec.frequency==='daily'?'Every day':rule.schedule_spec.days_of_week.map(day=>days[day]).join(', ')}</p></li>)}</ul>:<p>No routine rules are available in your scope.</p>}</>}
   <h3>Occurrences and report history</h3><p className="small">This list includes past occurrences and the next seven days. A canceled occurrence retains its history.</p>
   {bundle.due.tasks.length?<ul className="record-list">{bundle.due.tasks.map(task=>{const superseded=new Set(task.reports.map(report=>report.supersedes_id).filter(Boolean));const writable=bundle.graph.membership.role!=='reader'&&task.state!=='canceled';return <li key={task.id} data-testid={`managed-task-${task.id}`}><strong>{task.nickname} · {word(task.kind)}</strong><p>Scheduled {stamp(task.due_at)} · recorded state: {word(task.state)} · rule version {task.rule_version??'unknown'}</p><p>{task.instruction??'Historical instruction is unknown.'}</p>
    {task.conflict&&<p className="inline-notice">Conflicting current reports remain unresolved.</p>}
    {task.claims.map(claim=><p className="small" key={claim.id}>Claimed by {claim.profile_id} · {stamp(claim.created_at)} · {word(claim.state)}</p>)}
    {writable&&['planned','claimed'].includes(task.state)&&!task.claims.some(claim=>claim.profile_id===bundle.rules.actor_id&&claim.state==='claimed')&&<button className="secondary" disabled={busy} onClick={()=>void save('POST',`/api/tasks/${task.id}/claim`,{expected_state:task.state},'Task claim recorded. A claim does not verify physical care.')}>Claim task</button>}
    {task.reports.length?<ol className="history-list">{task.reports.map(report=><li key={report.id}><p>Reported by {report.reporter_id} · {stamp(report.created_at)} · {word(report.corrected_report??report.report)}{report.report==='correction'?' · correction':''}</p><p className="small">Performed: {stamp(report.performed_at)}</p>{report.note&&<p>{report.note}</p>}{report.supersedes_id&&<p className="small">Correction of report {report.supersedes_id}.</p>}{superseded.has(report.id)?<p className="small">Superseded by a later correction; retained in history.</p>:writable&&report.reporter_id===bundle.rules.actor_id?<ReportForm task={task} report={report} save={save} busy={busy}/>:null}</li>)}</ol>:<p>No completion report is recorded.</p>}
    {writable&&<ReportForm task={task} save={save} busy={busy}/>}</li>;})}</ul>:<p>No routine occurrences are recorded for this period.</p>}
  </>:null}
 </section>;
}
