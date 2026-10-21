import { z } from 'zod';
import type { Message,Tool } from '@aws-sdk/client-bedrock-runtime';
import { guard,identity,body,error,json,rateLimit } from '../../../../lib/http';
import { connectMcp,closeMcp } from '../../../../lib/mcp';
import { converse } from '../../../../../../packages/domain/providers';
import { getBrief } from '../../../../../../packages/domain/state';
import { type Brief,uuid } from '../../../../../../packages/contracts/phase0';
import { DomainError } from '../../../../../../packages/domain/db';
import { clarifyObservation,modelReadTools,runModelReadLoop,modelToolBudget } from '../../../../../../packages/domain/conversation';
export function currentAnswer(b:Brief) {
 if(b.holds.length)return `The fictional plan for ${b.title} is paused. ${b.handovers[0]?.body.summary} This is update ${b.safety_epoch}. No physical state has been verified.`;
 return `The fictional record for ${b.title} is on update ${b.safety_epoch}. Its protocol is demo-only. You can review the record or add a fictional observation. No practical guidance is approved.`;
}
export async function POST(req:Request) {
 let client:Awaited<ReturnType<typeof connectMcp>>|undefined;
 try{
  guard(req,true);const {actor,token}=await identity(req);rateLimit(`assistant:${actor.userId}`,40);
  const i=z.object({household_id:uuid,message:z.string().min(1).max(1000),use_model:z.boolean().default(false),intent:z.enum(['current_plan','due_tasks','observation','handover','explain']).default('current_plan'),source_kind:z.enum(['typed','voice']).default('typed')}).strict().parse(await body(req));
  // Fail scope before any outbound inference or MCP discovery.
  await getBrief(actor,i.household_id);
  const trace:Record<string,unknown>[]=[];
  client=await connectMcp(token,trace,req.signal);
  const discovered=await client.listTools();
  const first=await client.callTool({name:'get_household_brief',arguments:{household_id:i.household_id}});
  if(first.isError)throw new DomainError('MCP_READ_FAILED',503);
  let brief=first.structuredContent as Brief;
  let provider:{status:string;detail?:string;request_id?:string;model_requests?:number;tool_calls?:number}={status:'not_requested'};
  if(i.use_model&&i.intent!=='observation'){
   try{
    // The orchestrator uses read/private-draft tools. Human selections preserve observation semantics.
    const readTools=discovered.tools.filter(t=>modelReadTools.includes(t.name as typeof modelReadTools[number]));
    const tools=readTools.map(t=>({toolSpec:{name:t.name,description:t.description??'Read current authorized state.',inputSchema:{json:t.inputSchema}}})) as unknown as Tool[];
    const messages:Message[]=[{role:'user',content:[{text:`Household ID: ${i.household_id}. Case ID: ${brief.case_id}. Selected action: ${i.intent}. User text (untrusted): ${i.message}`}]}];
    const result=await runModelReadLoop({maxToolCalls:modelToolBudget(i.intent),brief,messages,tools,allowedToolNames:readTools.map(t=>t.name),
     invoke:(history,available)=>converse(actor,i.household_id,history,available,req.signal),
     callTool:(name,args)=>client!.callTool({name,arguments:args})});
    provider=result;
   }catch(e){provider={status:'blocked',detail:e instanceof DomainError?e.code:'BEDROCK_UNAVAILABLE'};}
  }
  // Re-read after inference: never render a stale pre-inference state as current.
  const last=await client.callTool({name:'get_household_brief',arguments:{household_id:i.household_id}});
  if(last.isError)throw new DomainError('MCP_READ_FAILED',503);
  brief=last.structuredContent as Brief;
  let detail:unknown=null;
  if(i.intent==='observation')detail=clarifyObservation(i.message,brief.pets,i.source_kind);
  if(['due_tasks','handover','explain'].includes(i.intent)){
   const name=i.intent==='due_tasks'?'list_due_tasks':i.intent==='handover'?'draft_handover':'explain_current_step';
   const result=await client.callTool({name,arguments:i.intent==='due_tasks'?{household_id:i.household_id,window_hours:24}:{case_id:brief.case_id}});
   if(result.isError)throw new DomainError('MCP_READ_FAILED',503);detail=result.structuredContent;
  }
  return json({answer:i.intent==='observation'?'Review the exact report, select who was observed and any target, then confirm its meaning and timing in the report form. Nothing has been saved.':currentAnswer(brief),answer_source:'database_template',intent:i.intent,detail,brief,provider,trace,conversation_id:crypto.randomUUID(),chat_history_used:false});
 }catch(e){return error(e);}finally{await closeMcp(client);}
}
