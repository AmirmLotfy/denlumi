import { DomainError } from './db';
import type { Message,Tool } from '@aws-sdk/client-bedrock-runtime';

export const modelReadTools=['get_household_brief','get_case_context','list_due_tasks','draft_handover','draft_professional_summary','explain_current_step'] as const;
type ModelResponse={output?:{message?:Message};$metadata?:{requestId?:string}};
type ToolReply={isError?:boolean;[key:string]:unknown};
export type ModelLoopResult={status:'tool_loop_completed'|'responded_without_tool';request_id?:string;model_requests:number;tool_calls:number};
/** Six MCP calls total: reserve both current-state reads and any selected detail read. */
export function modelToolBudget(intent:string){return 6-2-(['due_tasks','handover','explain'].includes(intent)?1:0);}
/** A provider response is not evidence of model-driven MCP use until an allowed tool succeeds. */
export async function runModelReadLoop(input:{
 maxToolCalls:number;brief:{household_id:string;case_id:string};messages:Message[];tools:Tool[];allowedToolNames:string[];
 invoke:(messages:Message[],tools:Tool[])=>Promise<ModelResponse>;
 callTool:(name:string,args:Record<string,unknown>)=>Promise<ToolReply>;
}):Promise<ModelLoopResult>{
 if(!Number.isInteger(input.maxToolCalls)||input.maxToolCalls<1||input.maxToolCalls>4)throw new DomainError('INVALID_TOOL_BUDGET',400);
 const messages=[...input.messages];let modelRequests=0,toolCalls=0,requestId:string|undefined;
 for(let round=0;round<2;round++){
  const response=await input.invoke(messages,input.tools);modelRequests++;requestId=response.$metadata?.requestId;
  const message=response.output?.message;
  const requested=message?.content?.flatMap(block=>block.toolUse?[block.toolUse]:[])??[];
  if(!requested.length)break;
  if(!message)throw new DomainError('MODEL_MESSAGE_MISSING',503);
  messages.push(message);
  const results=[];
  for(const call of requested){
   if(toolCalls>=input.maxToolCalls)throw new DomainError('TOOL_BUDGET_EXHAUSTED');
   if(!call.name||!call.toolUseId||!input.allowedToolNames.includes(call.name))throw new DomainError('TOOL_NOT_ALLOWED',403);
   const args=validateModelCall(call.name,call.input,input.brief);
   const answer=await input.callTool(call.name,args);
   if(answer.isError)throw new DomainError('MCP_READ_FAILED',503);
   toolCalls++;
   results.push({toolResult:{toolUseId:call.toolUseId,content:[{json:JSON.parse(JSON.stringify(answer))}],status:'success' as const}});
  }
  messages.push({role:'user',content:results});
 }
 return {status:toolCalls?'tool_loop_completed':'responded_without_tool',request_id:requestId,model_requests:modelRequests,tool_calls:toolCalls};
}
/** An authenticated user can belong to several homes: model context must stay in the selected one. */
export function validateModelCall(name:string,args:unknown,b:{household_id:string;case_id:string}) {
 if(!modelReadTools.includes(name as typeof modelReadTools[number]))throw new DomainError('TOOL_NOT_ALLOWED',403);
 if(!args||typeof args!=='object'||Array.isArray(args))throw new DomainError('INVALID_TOOL_ARGUMENTS',400);
 const a=args as Record<string,unknown>,household=['get_household_brief','list_due_tasks'].includes(name);
 const fields=name==='list_due_tasks'?['household_id','window_hours']:household?['household_id']:['case_id'];
 if(Object.keys(a).some(k=>!fields.includes(k))||fields.some(k=>!(k in a)))throw new DomainError('INVALID_TOOL_ARGUMENTS',400);
 if(household?a.household_id!==b.household_id:a.case_id!==b.case_id)throw new DomainError('SCOPE_MISMATCH',403);
 if(name==='list_due_tasks'&&(!Number.isInteger(a.window_hours)||Number(a.window_hours)<1||Number(a.window_hours)>48))throw new DomainError('INVALID_TOOL_ARGUMENTS',400);
 return a;
}
/** Candidate names are displayed, never promoted into attributed facts by text matching or a model. */
export function clarifyObservation(raw:string,pets:{id:string;nickname:string;aliases?:string[]}[],source:'typed'|'voice') {
 return {raw_report:raw,source_kind:source,actor_pet_id:null,target_pet_id:null,assertion:null,observed_at:null,
  reported_at:new Date().toISOString(),requires_human_selection:true,saved:false,
  questions:['Who was observed, and toward whom (or no other pet)?','Did the reported event happen, not happen, or is it uncertain?','When was it observed? Leave unknown if unsure.'],
  choices:pets.map(p=>({id:p.id,name:p.nickname,aliases:p.aliases??[]})),
  notice:'Select identities explicitly, including for nicknames and similar names. Review the exact words before saving a fictional report. Nothing has been confirmed.'};
}
