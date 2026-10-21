'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {workflowRead as read,useWorkflowWrite} from '../lib/workflow-http';
import {householdExpected,type Graph,type Pet,type Member} from '../lib/coordination-types';
import RoutineManager from './routine-manager';
import HomeEditor from './home-editor';
import MembershipManager from './membership-manager';
import HomeRecord from './home-record';
import WorkflowSection from './workflow-section';

type Home={id:string;nickname:string;role:string};
type Pending={id:string;household_id:string;nickname:string;role:string;pet_scope:string[]|null;case_scope:string[]|null;expires_at:string|null;grant_version:number;pet_labels:{id:string;nickname:string;species:string}[];case_labels:{id:string;title:string}[]};
type Index={profile_id:string;households:Home[];pending_memberships:Pending[]};
const situations=[['SC01','First cat in the home'],['SC02','First dog in the home'],['SC03','New cat with a resident cat'],['SC04','New dog with a resident dog'],['SC05','New cat with a resident dog'],['SC06','New dog with a resident cat'],['SC07','Three or more pets sharing a home'],['SC08','Young pet with an adult or senior pet'],['SC09','A pet returns after time away'],['SC10','The home arrangement changed'],['SC11','Someone else is caring for them'],['SC12','Daily care'],['SC13','I am concerned about conflict'],['SC14','I am concerned about alone time or noise'],['SC15','Visitors or a changed human household'],['SC16','Injury, distress or illness concern']];

export default function HouseholdWorkspace(){
 const [index,setIndex]=useState<Index|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [nickname,setNickname]=useState(''),[timezone,setTimezone]=useState('Africa/Cairo'),[adult,setAdult]=useState(false);
 const write=useWorkflowWrite(),alive=useRef(true);
 const load=useCallback(async()=>{const result=await read<Index>('/api/households');if(!alive.current)return;setIndex(result);setError('');setSelected(previous=>result.households.some(h=>h.id===previous)?previous:result.households[0]?.id??'');},[]);
 useEffect(()=>{alive.current=true;void load().catch(()=>{if(alive.current)setError('Your household list could not be retrieved. Sign in or retry when the local service is available.');}).finally(()=>{if(alive.current)setLoading(false);});return()=>{alive.current=false;};},[load]);
 async function create(event:FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const result=await write<{household_id:string}>('/api/households',{nickname,timezone,locale:'en',adult_acknowledged:adult,notification_preferences:{internal_inbox:true,email:false}});
  if(!alive.current)return;await load();setSelected(result.household_id);setNickname('');setAdult(false);setNotice('Household saved. Add only the pets and situations you want to coordinate.');
 }catch(e){if(alive.current)setError(`Household request unavailable or refused: ${(e as Error).message}. Retrieve current records before changing an uncertain request.`);}finally{if(alive.current)setBusy(false);}}
 return <><header className="topbar"><a className="brand" href="/">denlumi<span aria-hidden="true">.</span></a><a href="/">Today & sample console</a><a href="/login">Local account sign-in</a></header><main className="household-workspace">
 <p className="eyebrow">Your household records</p><h1>{index?.households.find(h=>h.id===selected)?.nickname??'Set up your household'}</h1>
 <p>Keep pets, situations and care responsibilities in one current record. No approved practical module is installed. Coordination does not verify animal safety or physical care.</p>
 {loading?<p role="status">Retrieving your household list…</p>:<>
 {error&&<section className="panel"><p role="alert" className="error">{error}</p><a href="/login">Sign in to an existing local account</a><button className="secondary" onClick={()=>void load().catch(()=>setError('The household list is still unavailable.'))}>Retry household list</button></section>}
 {index&&<>
  <p className="small">Your account reference: <code>{index.profile_id}</code>. Share it privately with a household owner only if you want them to prepare access. No invitation is sent automatically.</p>
  {index.pending_memberships.length>0&&<section className="panel"><h2>Pending household access</h2>{index.pending_memberships.map(grant=><PendingAccess key={`${grant.id}:${grant.grant_version}`} grant={grant} onAccepted={load}/>)}</section>}
  {index.households.length>0&&<label>Household<select value={selected} onChange={e=>setSelected(e.target.value)}>{index.households.map(h=><option key={h.id} value={h.id}>{h.nickname} · {h.role}</option>)}</select></label>}
  {selected&&<Coordination key={selected} id={selected} profileId={index.profile_id} onIndexChanged={load}/>}
  <details className="panel" open={!selected}><summary>{selected?'Create another household':'Create your household'}</summary><form onSubmit={create} aria-label="Create household"><fieldset disabled={busy}>
   <label>Household nickname<input required maxLength={80} value={nickname} onChange={e=>setNickname(e.target.value)}/></label>
   <label>Household time zone<input required value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder="Africa/Cairo"/></label><p className="small">English. Internal inbox only; external email is unavailable.</p>
   <label className="checkbox"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/>I am an adult and will manage this household.</label><button className="primary" disabled={!adult||busy}>Create household</button>
  </fieldset></form></details>
 </>}
 {notice&&<p role="status">{notice}</p>}
 </>}
 </main></>;
}
function PendingAccess({grant,onAccepted}:{grant:Pending;onAccepted:()=>Promise<void>}){
 const [adult,setAdult]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const write=useWorkflowWrite();
 return <article><h3>{grant.nickname} · {grant.role}</h3><p>Pets: {grant.pet_scope===null?'all pets, including later additions':grant.pet_labels.map(p=>`${p.nickname} (${p.species})`).join(', ')||'none'}. Situations: {grant.case_scope===null?'all situations, including later additions':grant.case_labels.map(c=>c.title).join(', ')||'none'}. Expires: {grant.expires_at?new Date(grant.expires_at).toLocaleString():'no scheduled expiry'}.</p><label className="checkbox"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/>I am an adult and accept this scoped access.</label><button className="secondary" disabled={busy||!adult} onClick={async()=>{setBusy(true);setError('');try{await write(`/api/memberships/${grant.id}/accept`,{adult_acknowledged:true,expected_grant_version:grant.grant_version});await onAccepted();}catch(e){setError(`Acceptance unavailable or refused: ${(e as Error).message}.`);}finally{setBusy(false);}}}>Accept household access</button>{error&&<><p role="alert">{error}</p><button className="secondary" disabled={busy} onClick={()=>void onAccepted().catch(()=>setError('The latest access request is still unavailable.'))}>Retrieve latest access request</button></>}</article>;
}

function Coordination({id,profileId,onIndexChanged}:{id:string;profileId:string;onIndexChanged:()=>Promise<void>}){
 const [graph,setGraph]=useState<Graph|null>(null),[members,setMembers]=useState<Member[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);const generation=useRef(0),write=useWorkflowWrite();
 useEffect(()=>{const turn=++generation.current;setGraph(null);setError('');void read<Graph>(`/api/households/${id}/graph`).then(async g=>{
  const list=g.membership.role==='owner'?await read<{members:Member[]}>(`/api/households/${id}/memberships`):{members:[]};
  if(turn===generation.current){setGraph(g);setMembers(list.members);}
 }).catch(e=>{if(turn===generation.current){setGraph(null);setMembers([]);setError(`Current household records unavailable: ${(e as Error).message}.`);}});return()=>{generation.current++;};},[id,revision]);
 const refresh=()=>setRevision(n=>n+1);
 async function save(path:string,payload:unknown,method='POST',message='Record saved.'){
  if(busy)throw Error('REQUEST_IN_PROGRESS');const turn=generation.current;setBusy(true);setError('');setNotice('');
  try{const result=await write(path,payload,method);if(turn===generation.current){setNotice(message);refresh();void onIndexChanged().catch(()=>{});}return result;}
  catch(e){if(turn===generation.current)setError(`Request unavailable or refused: ${(e as Error).message}. It may have saved if the response was lost; retry unchanged to reuse its request key.`);throw e;}
  finally{if(turn===generation.current)setBusy(false);}
 }
 if(!graph)return <section className="panel">{error?<><p role="alert">{error}</p><button onClick={refresh} className="secondary">Retrieve household records again</button></>:<p role="status">Retrieving current household records…</p>}</section>;
 const owner=graph.membership.role==='owner';
 return <><p>Current role: {graph.membership.role}</p>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
 <section className="panel"><h2>Pets</h2>{!graph.pets.length&&<p>No pets recorded yet.</p>}{graph.pets.length===1&&<p>One pet is a complete household. No second pet or pair is needed.</p>}
 {graph.pets.map(p=><article key={p.id}><h3>{p.nickname} · {p.species}</h3><p>{p.archived_at?'Archived record':`Age: ${p.age_band??'unknown'}. Arrival: ${p.arrival_date??'not supplied'}.`}</p>{owner&&!p.archived_at&&<details><summary>Edit {p.nickname}</summary><PetForm graph={graph} pet={p} save={save} busy={busy}/></details>}</article>)}
 {owner&&graph.pets.filter(p=>!p.archived_at).length<6&&<details open={!graph.pets.length}><summary>Add a pet</summary><PetForm graph={graph} save={save} busy={busy}/></details>}
 {owner&&graph.pets.filter(p=>!p.archived_at).length>=6&&<p>The R0 household limit is six active pets. Existing records remain available.</p>}
 </section>
 <section className="panel"><h2>Situations</h2>{!graph.cases.length&&<p>No situation selected yet.</p>}{graph.cases.map(c=><article key={c.id}><h3>{c.title} · {c.scenario_code}</h3><p>Recorded route: {c.support_level.replaceAll('_',' ')}. {c.routed_at?'Intake saved.':'Intake is missing.'}</p><p>No approved module is available. Coordination remains available.</p>{owner&&<SituationIntake graph={graph} caseId={c.id} save={save} busy={busy}/>}</article>)}
 {owner&&graph.pets.some(p=>!p.archived_at)&&<details open={!graph.cases.length}><summary>Select a situation</summary><SituationForm graph={graph} save={save} busy={busy}/></details>}
 {!graph.pets.length&&<p>Add a pet to record a situation. You can still plan household space below.</p>}
 </section>
 <WorkflowSection title="Manage routine rules and reports"><RoutineManager householdId={id}/></WorkflowSection>
 <WorkflowSection title="Read current home record"><HomeRecord householdId={id} version={graph.household.state_version} pets={graph.pets}/></WorkflowSection>
 {owner&&<><WorkflowSection title="Manage home spaces and responsibilities"><HomeEditor key={`home-${revision}`} graph={graph} members={members} save={save} busy={busy}/></WorkflowSection>
 <WorkflowSection title="Manage caregiver access"><MembershipManager key={`members-${revision}`} graph={graph} members={members} profileId={profileId} save={save} busy={busy}/></WorkflowSection>
 <WorkflowSection title="Household settings"><Settings key={`settings-${revision}`} graph={graph} save={save} busy={busy}/></WorkflowSection></>}
 <button className="text-button" disabled={busy} onClick={refresh}>Refresh household records</button>
 </>;
}
export type SaveRecord=(path:string,payload:unknown,method?:string,message?:string)=>Promise<unknown>;
function PetForm({graph,pet,save,busy}:{graph:Graph;pet?:Pet;save:SaveRecord;busy:boolean}){
 const [nickname,setNickname]=useState(pet?.nickname??''),[species,setSpecies]=useState(pet?.species??'cat'),[age,setAge]=useState(pet?.age_band??''),[arrival,setArrival]=useState(pet?.arrival_date??''),[birth,setBirth]=useState(pet?.approx_birth_date??''),[history,setHistory]=useState(pet?.context_notes.reported_history??''),[access,setAccess]=useState(pet?.context_notes.accessibility_notes??'');
 return <form aria-label={pet?`Edit pet ${pet.nickname}`:'Add pet'} onSubmit={async e=>{e.preventDefault();try{await save(pet?`/api/pets/${pet.id}`:`/api/households/${graph.household.id}/pets`,{...householdExpected(graph),...(pet?{expected_pet_version:pet.version}:{}),nickname,species,age_band:age.trim()||null,arrival_date:arrival||null,approx_birth_date:birth||null,context_notes:{schema_version:1,reported_history:history.trim()||null,accessibility_notes:access.trim()||null},aliases:pet?.aliases??[]},pet?'PATCH':'POST','Pet record saved. Dependent plan reviews require a fresh check.');}catch{}}}><fieldset disabled={busy}>
 <label>Pet nickname<input required maxLength={80} value={nickname} onChange={e=>setNickname(e.target.value)}/></label><label>Pet species<select value={species} onChange={e=>setSpecies(e.target.value as 'cat'|'dog')}><option value="cat">Cat</option><option value="dog">Dog</option></select></label>
 <label>Age or age band <span className="optional">Optional</span><input maxLength={80} value={age} onChange={e=>setAge(e.target.value)}/></label><label>Approximate birth date <span className="optional">Optional</span><input type="date" value={birth} onChange={e=>setBirth(e.target.value)}/></label><label>Arrival date <span className="optional">Optional</span><input type="date" value={arrival} onChange={e=>setArrival(e.target.value)}/></label>
 <label>Owner-reported history <span className="optional">Optional</span><textarea maxLength={1500} value={history} onChange={e=>setHistory(e.target.value)}/></label><label>Accessibility accommodations <span className="optional">Optional</span><textarea maxLength={500} value={access} onChange={e=>setAccess(e.target.value)}/></label><button className="secondary">{pet?'Save pet changes':'Save pet'}</button></fieldset></form>;
}
function SituationForm({graph,save,busy}:{graph:Graph;save:SaveRecord;busy:boolean}){
 const [scenario,setScenario]=useState('SC12'),[title,setTitle]=useState(''),[roles,setRoles]=useState<Record<string,string>>({}),[selected,setSelected]=useState<string[]>([]);
 const [validation,setValidation]=useState('');
 function valid(){
  const pets=graph.pets.filter(p=>selected.includes(p.id)),count=pets.length;
  const species=pets.map(p=>p.species).sort().join('-');
  const fixed:Record<string,string>={SC01:'cat',SC02:'dog',SC03:'cat-cat',SC04:'dog-dog',SC05:'cat-dog',SC06:'cat-dog'};
  if(!count||count>6||scenario==='SC07'&&count<3||scenario==='SC08'&&count<2||fixed[scenario]&&fixed[scenario]!==species){setValidation('Select the pets that match this situation. Single-pet arrivals need one pet, introductions need the named pair, and multi-pet coordination needs three to six pets.');return false;}
  if(fixed[scenario]){
   const newcomers=pets.filter(p=>roles[p.id]==='newcomer');
   if(newcomers.length!==1||pets.some(p=>!['resident','newcomer'].includes(roles[p.id]??''))||scenario==='SC05'&&newcomers[0].species!=='cat'||scenario==='SC06'&&newcomers[0].species!=='dog'){setValidation('Identify one newcomer and each resident. For a mixed pair, keep the selected newcomer species.');return false;}
  }
  setValidation('');return true;
 }
 return <form aria-label="Select situation" onSubmit={async e=>{e.preventDefault();if(!valid())return;try{await save(`/api/households/${graph.household.id}/cases`,{...householdExpected(graph),title,scenario_code:scenario,participants:selected.map(pet_id=>({pet_id,role:roles[pet_id]??'affected'})),context_key:'home'},'POST','Situation saved. Record its intake before any plan review.');}catch{}}}><fieldset disabled={busy}><label>Situation<select value={scenario} onChange={e=>setScenario(e.target.value)}>{situations.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><label>Situation title<input required maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 {graph.pets.filter(p=>!p.archived_at).map(p=><div key={p.id}><label className="checkbox"><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,p.id]:v.filter(id=>id!==p.id))}/>Include {p.nickname}</label>{selected.includes(p.id)&&<label>Role for {p.nickname}<select value={roles[p.id]??'affected'} onChange={e=>setRoles(v=>({...v,[p.id]:e.target.value}))}><option value="affected">Affected / context</option><option value="resident">Resident</option><option value="newcomer">Newcomer</option><option value="returning">Returning</option></select></label>}</div>)}{validation&&<p role="alert">{validation}</p>}<p className="small">Species and newcomer direction are checked when routing intake. Three or more pets create separate pair contexts, never group-session permission.</p><button className="secondary" disabled={!selected.length}>Save situation</button></fieldset></form>;
}
function SituationIntake({graph,caseId,save,busy}:{graph:Graph;caseId:string;save:SaveRecord;busy:boolean}){
 const [unsure,setUnsure]=useState(false);
 return <form onSubmit={async e=>{e.preventDefault();try{await save(`/api/cases/${caseId}/intake`,{...householdExpected(graph),intake_schema_version:'1',answers:{owner_recorded:true},unknowns:unsure?['Owner requests clarification of this situation']:[]},'POST','Situation intake saved. The recorded route is an application policy, not a diagnosis.');}catch{}}}><fieldset disabled={busy}><label className="checkbox"><input type="checkbox" checked={unsure} onChange={e=>setUnsure(e.target.checked)}/>I need clarification about this situation.</label><button className="secondary">Save situation intake</button></fieldset></form>;
}
function Settings({graph,save,busy}:{graph:Graph;save:SaveRecord;busy:boolean}){
 const [name,setName]=useState(graph.household.nickname),[zone,setZone]=useState(graph.household.timezone);
 return <form onSubmit={async e=>{e.preventDefault();try{await save(`/api/households/${graph.household.id}/settings`,{...householdExpected(graph),nickname:name,timezone:zone,locale:'en',notification_preferences:{internal_inbox:true,email:false}},'PATCH','Household settings saved. Existing routine schedules keep their explicitly recorded time zone.');}catch{}}}><fieldset disabled={busy}><label>Household name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label>Household IANA time zone<input required value={zone} onChange={e=>setZone(e.target.value)}/></label><p>English. Internal inbox enabled; external delivery is unavailable. Routine time zones change only when their rule is edited.</p><button className="secondary">Save household settings</button></fieldset></form>;
}
