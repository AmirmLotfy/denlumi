import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { bindState, type Brief, type FixtureName } from '../packages/contracts/phase0';

const origin = 'http://127.0.0.1:3400';
if (process.env.APP_ORIGIN !== origin) throw Error('Isolated localhost app required');

type PetShape = `${'cat' | 'dog'}:${'resident' | 'newcomer' | 'affected'}`;
type Scenario = {
 fixture: FixtureName;
 scenario: string;
 protocol: string;
 pairing: string;
 newcomer_species: 'cat' | 'dog' | null;
 pets: PetShape[];
 pair_count: number;
 support_level?: string;
};

const scenarios: Scenario[] = [
 {fixture:'cat_cat',scenario:'SC03',protocol:'demo-cc-v1',pairing:'cat_cat',newcomer_species:'cat',pets:['cat:resident','cat:newcomer'],pair_count:1},
 {fixture:'dog_dog',scenario:'SC04',protocol:'demo-dd-v1',pairing:'dog_dog',newcomer_species:'dog',pets:['dog:resident','dog:newcomer'],pair_count:1},
 {fixture:'cat_dog_new_cat',scenario:'SC05',protocol:'demo-dc-new-cat-v1',pairing:'cat_dog',newcomer_species:'cat',pets:['dog:resident','cat:newcomer'],pair_count:1},
 {fixture:'cat_dog',scenario:'SC06',protocol:'demo-dc-new-dog-v1',pairing:'cat_dog',newcomer_species:'dog',pets:['cat:resident','dog:newcomer'],pair_count:1},
 {fixture:'single_cat',scenario:'SC01',protocol:'demo-solo-cat-v1',pairing:'single_cat',newcomer_species:'cat',pets:['cat:newcomer'],pair_count:0},
 {fixture:'single_dog',scenario:'SC02',protocol:'demo-solo-dog-v1',pairing:'single_dog',newcomer_species:'dog',pets:['dog:newcomer'],pair_count:0},
 {fixture:'multi_pet',scenario:'SC07',protocol:'demo-care-v1',pairing:'coordination',newcomer_species:null,pets:['dog:affected','cat:affected','cat:affected'],pair_count:3,support_level:'coordination_only'}
];

type Turn = {brief: Brief; trace: {method?: string; tool_name?: string; http_status?: number; protocol?: string}[]; conversation_id: string; chat_history_used: boolean; provider: {status: string}; answer_source: string};
type Graph = {household:{mode:string; fictional:boolean; state_version:number; safety_epoch:number}; cases:{id:string; scenario_code:string; support_level:string}[]; pairs:unknown[]; contexts:{status:string}[]; participants:{pet_id:string}[]; physical_state_verified:boolean};
type Preview = {value:{body:{participants:unknown[]; observations:{status:string}[]; plan_history:{protocol_status:string}[]; physical_state_verified:boolean; diagnosis_generated:boolean}; scope:{pet_ids:string[]}; purpose:string; format:string; recipient_address:string|null}; state_version:number; safety_epoch:number};

async function request<T>(path:string,cookie:string,method:'GET'|'POST'='GET',payload?:unknown) {
 const response=await fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(15_000)});
 const body=await response.json() as T;
 return {status:response.status,body,headers:response.headers};
}
function ok(status:number,expected:number,fixture:string,step:string) { assert.equal(status,expected,`${fixture}: ${step} HTTP status`); }
function methods(turn:Turn,fixture:string) {
 const calls=turn.trace.filter(row=>row.method==='tools/call'&&row.tool_name==='get_household_brief'&&row.http_status===200);
 for(const method of ['initialize','tools/list'])assert.ok(turn.trace.some(row=>row.method===method&&row.http_status===200&&row.protocol==='2025-11-25'),`${fixture}: authenticated MCP ${method}`);
 assert.ok(calls.length>=2,`${fixture}: two real MCP current-state reads`);
 return [...new Set(turn.trace.map(row=>row.method).filter((value):value is string=>typeof value==='string'))];
}

const rows=[];
for(const spec of scenarios){
 const created=await request<{householdId:string;caseId:string}>('/api/demo','','POST',{fixture:spec.fixture,retention_acknowledged:true});
 ok(created.status,200,spec.fixture,'fictional account creation');
 const sessionCookies=created.headers.getSetCookie().map(value=>value.split(';')[0]);
 assert.ok(sessionCookies.some(value=>value.startsWith('denlumi_session=')),`${spec.fixture}: owner session`);
 assert.ok(sessionCookies.some(value=>value.startsWith('denlumi_caregiver=')),`${spec.fixture}: caregiver session`);
 const cookies=sessionCookies.join('; '); // Tokens stay in memory and are never written to evidence.

 const graphResponse=await request<Graph>(`/api/households/${created.body.householdId}/graph`,cookies);
 ok(graphResponse.status,200,spec.fixture,'household graph');
 const graph=graphResponse.body;
 const selectedCase=graph.cases.find(value=>value.id===created.body.caseId);
 assert.equal(selectedCase?.scenario_code,spec.scenario);
 assert.equal(graph.household.mode,'demo');
 assert.equal(graph.household.fictional,true);
 assert.equal(graph.physical_state_verified,false);
 assert.equal(graph.pairs.length,spec.pair_count,`${spec.fixture}: canonical pair count`);
 assert.equal(graph.participants.length,spec.pets.length,`${spec.fixture}: no fabricated participant`);
 if(spec.support_level){
  assert.equal(selectedCase?.support_level,spec.support_level);
  assert.equal(graph.contexts.length,3);
  assert.ok(graph.contexts.every(value=>value.status==='unreviewed'),`${spec.fixture}: no inferred group readiness`);
 }

 const firstResponse=await request<Turn>('/api/assistant/turn',cookies,'POST',{household_id:created.body.householdId,intent:'current_plan',message:'Read the current fictional record.',use_model:false});
 ok(firstResponse.status,200,spec.fixture,'first MCP conversation');
 const first=firstResponse.body,brief=first.brief;
 assert.equal(first.provider.status,'not_requested');
 assert.equal(first.answer_source,'database_template');
 assert.equal(first.chat_history_used,false);
 assert.equal(brief.case_id,created.body.caseId);
 assert.equal(brief.protocol_slug,spec.protocol);
 assert.equal(brief.protocol_status,'demo_only');
 assert.equal(brief.pairing,spec.pairing);
 assert.equal(brief.physical_state_verified,false);
 assert.deepEqual(brief.pets.map(p=>`${p.species}:${p.role}`).sort(),[...spec.pets].sort(),`${spec.fixture}: species and case roles`);
 const actualNewcomer=brief.pets.find(p=>p.role==='newcomer')?.species??null;
 assert.equal(actualNewcomer,spec.newcomer_species,`${spec.fixture}: newcomer direction`);
 const firstMethods=methods(first,spec.fixture);

 const preflight=await request<{status:string}>('/api/actions',cookies,'POST',{operation:'preflight',caregiver:true,input:bindState(brief)});
 ok(preflight.status,200,spec.fixture,'fictional preflight');
 assert.equal(preflight.body.status,'demo_preflight_only');
 const record=await request<{status:string;observation_status:string;safety_epoch:number;physical_state_verified:boolean}>('/api/actions',cookies,'POST',{operation:'record',input:{...bindState(brief),raw_report:'Fictional observation for Phase 8 software proof; outcome uncertain.',actor_pet_id:brief.pets[0].id,target_pet_id:brief.pets[1]?.id??null,assertion:'uncertain',source_kind:'typed',observed_at:null}});
 ok(record.status,200,spec.fixture,'fictional observation and pause');
 assert.equal(record.body.status,'guidance_paused');
 assert.equal(record.body.observation_status,'draft');
 assert.equal(record.body.safety_epoch,brief.safety_epoch+1);
 assert.equal(record.body.physical_state_verified,false);

 const stale=await request<{error:string}>('/api/actions',cookies,'POST',{operation:'preflight',caregiver:true,input:bindState(brief)});
 ok(stale.status,409,spec.fixture,'stale caregiver refusal');
 assert.equal(stale.body.error,'STALE_STATE');
 const freshResponse=await request<Turn>('/api/assistant/turn',cookies,'POST',{household_id:created.body.householdId,intent:'current_plan',message:'Why is this fictional record paused?',use_model:false});
 ok(freshResponse.status,200,spec.fixture,'fresh MCP conversation');
 const fresh=freshResponse.body;
 assert.equal(fresh.chat_history_used,false);
 assert.notEqual(fresh.conversation_id,first.conversation_id);
 assert.equal(fresh.brief.safety_epoch,record.body.safety_epoch);
 assert.equal(fresh.brief.observations[0]?.status,'draft');
 assert.ok(fresh.brief.holds.length>0);
 const freshMethods=methods(fresh,spec.fixture);

 const records=await request<{state_version:number;safety_epoch:number}>('/api/records',cookies,'POST',{action:'list',household_id:created.body.householdId});
 ok(records.status,200,spec.fixture,'private record state');
 const preview=await request<Preview>('/api/records',cookies,'POST',{action:'preview',input:{household_id:created.body.householdId,case_id:created.body.caseId,expected_state_version:records.body.state_version,expected_safety_epoch:records.body.safety_epoch,purpose:'export',format:'text',recipient_address:null,expires_at:new Date(Date.now()+60*60_000).toISOString()}});
 ok(preview.status,201,spec.fixture,'owner-only private preview');
 assert.equal(preview.body.value.purpose,'export');
 assert.equal(preview.body.value.format,'text');
 assert.equal(preview.body.value.recipient_address,null);
 assert.equal(preview.body.value.body.physical_state_verified,false);
 assert.equal(preview.body.value.body.diagnosis_generated,false);
 assert.equal(preview.body.value.body.participants.length,spec.pets.length);
 assert.equal(preview.body.value.scope.pet_ids.length,spec.pets.length);
 assert.ok(preview.body.value.body.observations.some(value=>value.status==='draft'));
 assert.ok(preview.body.value.body.plan_history.every(value=>value.protocol_status==='demo_only'));

 rows.push({fixture:spec.fixture,scenario:spec.scenario,protocol_slug:spec.protocol,pairing:spec.pairing,newcomer_species:actualNewcomer,pet_count:brief.pets.length,pair_count:graph.pairs.length,group_contexts_unreviewed:spec.fixture==='multi_pet',mcp_first:firstMethods,mcp_fresh:freshMethods,fictional_preflight:true,observation_draft_paused:true,stale_caregiver_error:stale.body.error,fresh_epoch:record.body.safety_epoch,private_summary_preview:true,physical_state_verified:false});
}

const output={checked_at:new Date().toISOString(),result:'PASS',scope:'Actual authenticated localhost HTTP, MCP and isolated Supabase with fictional demo accounts. No Bedrock request, live guidance, external send, hosted resource or human usability observation.',protocol_status:'demo_only',fixtures:rows};
await mkdir('evidence/phase8',{recursive:true});
await writeFile('evidence/phase8/pairings.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({result:output.result,fixture_count:rows.length,evidence:'evidence/phase8/pairings.json'}));
