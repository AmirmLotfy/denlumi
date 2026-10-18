import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateModelCall, clarifyObservation, runModelReadLoop,modelToolBudget } from '../packages/domain/conversation';
import type { Message } from '@aws-sdk/client-bedrock-runtime';
import { floatToPCM } from '../packages/domain/audio';
import { dispatch,toolDefinitions } from '../apps/web/lib/mcp';
const pets=[{id:'a',nickname:'Nora',aliases:['Noor']},{id:'b',nickname:'Nova',aliases:['Noor']}];
test('observation clarification never resolves pronouns, similar names or duplicate aliases automatically',()=>{
 for(const raw of ['He chased her','Noor chased Nova','Nora did not chase Nova','I am not sure what Nora did']){
  const r=clarifyObservation(raw,pets,'voice');
  assert.equal(r.raw_report,raw);assert.equal(r.actor_pet_id,null);assert.equal(r.target_pet_id,null);
  assert.equal(r.assertion,null);assert.equal(r.observed_at,null);assert.equal(r.source_kind,'voice');
  assert.equal(r.requires_human_selection,true);assert.equal(r.saved,false);
 }
});
test('model tools are exact whitelist scoped to selected household/case, including prototype keys and extra arguments',()=>{
 const b={household_id:'h',case_id:'c'};
 assert.doesNotThrow(()=>validateModelCall('get_case_context',{case_id:'c'},b));
 for(const name of ['advance_plan','clear_hold','share','invite','confirm_observation','operate_device','constructor','toString'])assert.throws(()=>validateModelCall(name,{},b));
 assert.throws(()=>validateModelCall('get_case_context',{case_id:'other'},b));
 assert.throws(()=>validateModelCall('get_household_brief',{household_id:'other'},b));
 assert.throws(()=>validateModelCall('get_household_brief',{household_id:'h',actor_user_id:'forged'},b));
 assert.throws(()=>validateModelCall('list_due_tasks',{household_id:'h',window_hours:10000},b));
});
test('model-driven read loop records tool use only after a scoped MCP result and feeds it into the next model turn',async()=>{
 const seen:Message[][]=[];const names:string[]=[];
 const result=await runModelReadLoop({maxToolCalls:4,brief:{household_id:'h',case_id:'c'},messages:[{role:'user',content:[{text:'fictional check-in'}]}],tools:[],allowedToolNames:['get_household_brief'],
  invoke:async messages=>{seen.push(structuredClone(messages));return seen.length===1?
   {output:{message:{role:'assistant',content:[{toolUse:{toolUseId:'read-1',name:'get_household_brief',input:{household_id:'h'}}}]} as Message},$metadata:{requestId:'model-1'}}:
   {output:{message:{role:'assistant',content:[{text:'ignored model prose'}]} as Message},$metadata:{requestId:'model-2'}};},
  callTool:async(name,args)=>{names.push(name);assert.deepEqual(args,{household_id:'h'});return {isError:false,structuredContent:{safety_epoch:2}};}});
 assert.deepEqual(result,{status:'tool_loop_completed',request_id:'model-2',model_requests:2,tool_calls:1});
 assert.deepEqual(names,['get_household_brief']);
 assert.equal(seen[1][2].content?.[0].toolResult?.toolUseId,'read-1');
 assert.equal(seen[1][2].content?.[0].toolResult?.status,'success');
});
test('model response without tool use is not reported as a completed tool loop',async()=>{
 let called=false;
 const result=await runModelReadLoop({maxToolCalls:4,brief:{household_id:'h',case_id:'c'},messages:[],tools:[],allowedToolNames:['get_household_brief'],
  invoke:async()=>({output:{message:{role:'assistant',content:[{text:'unsupported claim'}]}},$metadata:{requestId:'model-1'}}),
  callTool:async()=>{called=true;return {isError:false};}});
 assert.equal(result.status,'responded_without_tool');assert.equal(result.tool_calls,0);assert.equal(called,false);
});
test('six-call turn budget reserves current-state and detail reads across repeated model rounds',async()=>{
 for(const intent of ['current_plan','due_tasks','handover','explain','observation']){
  const budget=modelToolBudget(intent),reserved=['due_tasks','handover','explain'].includes(intent)?3:2;
  assert.equal(budget+reserved,6);
  let calls=0,rounds=0;
  await assert.rejects(runModelReadLoop({maxToolCalls:budget,brief:{household_id:'h',case_id:'c'},messages:[],tools:[],allowedToolNames:['get_household_brief'],
   invoke:async()=>{rounds++;return {output:{message:{role:'assistant',content:Array.from({length:rounds===1?2:5},(_,index)=>({toolUse:{toolUseId:`r${rounds}-${index}`,name:'get_household_brief',input:{household_id:'h'}}}))} as Message}};},
   callTool:async()=>{calls++;return {isError:false};}}),{code:'TOOL_BUDGET_EXHAUSTED'});
  assert.equal(calls,budget);assert.equal(rounds,2);
 }
});
test('model read loop refuses forbidden and cross-household calls before any MCP request',async()=>{
 const requests:{name:string;input:Record<string,unknown>}[]=[{name:'advance_plan',input:{case_id:'c'}},{name:'get_household_brief',input:{household_id:'foreign'}}];
 for(const {name,input} of requests){
  let called=false;
  await assert.rejects(runModelReadLoop({maxToolCalls:4,brief:{household_id:'h',case_id:'c'},messages:[],tools:[],allowedToolNames:['get_household_brief'],
  invoke:async()=>({output:{message:{role:'assistant',content:[{toolUse:{toolUseId:'attempt',name,input}}]} as Message},$metadata:{requestId:'model-1'}}),
   callTool:async()=>{called=true;return {isError:false};}}));
  assert.equal(called,false);
 }
});
test('PCM encodes bounded signed little endian mono without WAV header',()=>{
 const pcm=floatToPCM(new Float32Array([-2,-1,0,1,2]));
 const view=new DataView(pcm.buffer);assert.equal(pcm.length,10);
 assert.deepEqual(Array.from({length:5},(_,i)=>view.getInt16(i*2,true)),[-32768,-32768,0,32767,32767]);
});
test('MCP publishes nine bounded tools and rejects forbidden or inherited names before database access',async()=>{
 assert.equal(toolDefinitions.length,9);
 for(const name of ['confirm_observation','authorize_share','advance_plan','clear_hold','constructor','toString'])await assert.rejects(dispatch({userId:'forged',sessionId:'forged'},name,{},''),{code:'TOOL_NOT_ALLOWED'});
});
