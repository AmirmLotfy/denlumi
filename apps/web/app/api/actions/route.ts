import { z } from 'zod';
import { prepareSession,recordObservation,confirmObservation,pauseGuidance } from '../../../../../packages/domain/state';
import { guard,identity,body,error,json,cookie,rateLimit } from '../../../lib/http';
import { DomainError } from '../../../../../packages/domain/db';
import { authenticateToken } from '../../../../../packages/domain/auth';
export async function POST(req:Request) {
 try{
  guard(req,true);
  // This route is reserved for explicit same-origin UI actions, never the model tool dispatcher.
  const {operation,input,caregiver}=z.object({operation:z.enum(['preflight','record','confirm','pause']),input:z.unknown(),caregiver:z.boolean().optional()}).strict().parse(await body(req));
  const token=cookie(req,caregiver?'denlumi_caregiver':'denlumi_session');
  if(!token)throw new DomainError('HUMAN_SESSION_REQUIRED',401);
  const actor=await authenticateToken(token);rateLimit(actor.userId);
  const key=req.headers.get('idempotency-key')??'';
  const result=operation==='preflight'?await prepareSession(actor,input):operation==='record'?await recordObservation(actor,input,key):operation==='confirm'?await confirmObservation(actor,input,key):await pauseGuidance(actor,input,key);
  return json(result);
 }catch(e){return error(e);}
}
