import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getBrief,caseHousehold,pauseGuidance } from '../../../packages/domain/state';
import { sessionPreflight,recordSessionObservation } from '../../../packages/domain/sessions';
import { listDueTasks } from '../../../packages/domain/routines';
import { draftPrivateSummary } from '../../../packages/domain/records';
import { stateInput,pauseInput,uuid } from '../../../packages/contracts/phase0';
import { sessionObservationInput } from '../../../packages/contracts/phase45';
import { type Actor, DomainError } from '../../../packages/domain/db';
import { origin } from './http';

export const MCP_VERSION='2025-11-25';
const schemas={
 get_household_brief:z.object({household_id:uuid}).strict(),
 get_case_context:z.object({case_id:uuid}).strict(),
 list_due_tasks:z.object({household_id:uuid,window_hours:z.number().int().min(1).max(48)}).strict(),
 prepare_session:stateInput,
 record_observation:sessionObservationInput.extend({session_id:uuid}).strict(),
 pause_guidance:pauseInput,
 draft_handover:z.object({case_id:uuid}).strict(),
 explain_current_step:z.object({case_id:uuid}).strict(),
 draft_professional_summary:z.object({case_id:uuid}).strict()
};
const descriptions={get_household_brief:'Retrieve the current scoped fictional household state from the database.',get_case_context:'Retrieve the current case, participants, demo protocol and restrictions.',list_due_tasks:'Read scoped routine tasks and independent attributed reports. No report is not proof of completion or ingestion.',prepare_session:'Check current fictional eligibility and return a human start destination. Does not start a session.',record_observation:'Record a fictional session draft. Human confirmation is a separate authenticated UI action.',pause_guidance:'Pause software guidance only. Does not physically control or supervise animals.'};
export const toolDefinitions=Object.entries(schemas).map(([name,s])=>{
 const {$schema,...inputSchema}=z.toJSONSchema(s);
 return {name,description:name==='draft_professional_summary'?'Prepare a private attributed factual summary. Does not send, share or grant access.':name==='draft_handover'?'Prepare a factual private draft from current reports. Never publish or send.':name==='explain_current_step'?'Retrieve current rationale availability and sources. Demo content is not practical animal guidance.':descriptions[name as keyof typeof descriptions],inputSchema:inputSchema as {type:'object'}};
});
export async function dispatch(actor:Actor,name:string,args:unknown,key:string) {
 if(!Object.hasOwn(schemas,name))throw new DomainError('TOOL_NOT_ALLOWED',403);
 const parsed=schemas[name as keyof typeof schemas].parse(args);
 if(name==='get_household_brief')return getBrief(actor,(parsed as {household_id:string}).household_id);
 if(name==='draft_professional_summary'){const id=(parsed as {case_id:string}).case_id;return draftPrivateSummary(actor,await caseHousehold(actor,id),id);}
 if(['get_case_context','draft_handover','explain_current_step'].includes(name)){
  const id=(parsed as {case_id:string}).case_id;
  const b=await getBrief(actor,await caseHousehold(actor,id),id);
  if(name==='get_case_context')return b;
  const meta={as_of:b.as_of,safety_epoch:b.safety_epoch,support_level:b.support_level,source_ids:b.source_ids,stale:b.stale,physical_state_verified:false};
  if(name==='explain_current_step')return {...meta,status:'no_approved_practical_content',current_step:b.current_step,protocol_status:b.protocol_status,rationale:'This fictional protocol demonstrates software state only. No practical animal-handling rationale is approved.',holds:b.holds};
  return {...meta,status:'private_draft',published:false,participants:b.pets,reports:b.observations,latest_handover:b.handovers[0]??null,unknowns:['No physical state is verified.','No professional assessment is recorded.']};
 }
 if(name==='list_due_tasks'){const p=parsed as {household_id:string;window_hours:number};return listDueTasks(actor,p.household_id,p.window_hours);}
 if(name==='prepare_session')return sessionPreflight(actor,parsed);
 if(name==='record_observation'){const p=parsed as z.infer<typeof schemas.record_observation>;const {session_id,...input}=p;return recordSessionObservation(actor,session_id,input,key);}
 return pauseGuidance(actor,parsed,key);
}
type McpSession={server:Server;transport:WebStandardStreamableHTTPServerTransport;actor:Actor;key:string;busy:boolean;lastUsed:number};
const sessions=new Map<string,McpSession>();
function sameActor(a:Actor,b:Actor){return a.userId===b.userId&&a.sessionId===b.sessionId;}
async function createMcpSession(actor:Actor) {
  const server=new Server({name:'denlumi-phase0',version:'0.0.1'},{capabilities:{tools:{}}});
  let entry:McpSession;
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:toolDefinitions}));
  server.setRequestHandler(CallToolRequestSchema,async request=>{
   try{
   const result=await dispatch(entry.actor,request.params.name,request.params.arguments,entry.key);
   return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result as Record<string,unknown>};
   }catch(e){return {isError:true,content:[{type:'text',text:JSON.stringify({error:e instanceof DomainError?e.code:e instanceof z.ZodError?'INVALID_INPUT':'SERVICE_UNAVAILABLE'})}]};}
  });
 const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:()=>crypto.randomUUID(),enableJsonResponse:true,
  onsessioninitialized:id=>{sessions.set(id,entry);},onsessionclosed:id=>{sessions.delete(id);}});
 entry={server,transport,actor,key:'',busy:false,lastUsed:Date.now()};
  await server.connect(transport);
 return entry;
}
export async function handleMcp(req:Request,actor:Actor,parsed?:unknown) {
 const id=req.headers.get('mcp-session-id');
 let entry=id?sessions.get(id):undefined;
 if(id&&!entry)throw new DomainError('MCP_SESSION_NOT_FOUND',404);
 if(entry&&!sameActor(entry.actor,actor))throw new DomainError('SCOPE_MISMATCH',403);
 if(!entry)entry=await createMcpSession(actor);
 if(entry.busy)throw new DomainError('MCP_SESSION_BUSY',409);
 entry.busy=true;entry.lastUsed=Date.now();entry.key=req.headers.get('idempotency-key')??'';
 try{return await entry.transport.handleRequest(req,parsed===undefined?undefined:{parsedBody:parsed});}
 finally{
  entry.busy=false;entry.key='';
  if(sessions.size>100)for(const [sid,value] of sessions)if(Date.now()-value.lastUsed>15*60_000){sessions.delete(sid);void value.server.close();}
 }
}
export async function connectMcp(token:string,trace:Record<string,unknown>[]=[],signal?:AbortSignal) {
 const client=new Client({name:'denlumi-browser-orchestrator',version:'0.0.1'});
 const fetchTrace:typeof fetch=async(input,init)=>{
  const requestBody=typeof init?.body==='string'?JSON.parse(init.body):undefined;
  const response=await fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(10000),...(signal?[signal]:[])])});
  if(requestBody)trace.push({method:requestBody.method,...(requestBody.method==='tools/call'?{tool_name:requestBody.params?.name}:{}),http_status:response.status,protocol:new Headers(init?.headers).get('mcp-protocol-version')??MCP_VERSION});
  return response;
 };
 await client.connect(new StreamableHTTPClientTransport(new URL('/api/mcp',origin()),{requestInit:{headers:{Authorization:`Bearer ${token}`,Origin:origin()}},fetch:fetchTrace}));
 return client;
}
