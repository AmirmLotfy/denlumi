import { z } from 'zod';
import { acknowledgeHandover } from '../../../../../../packages/domain/planning';
import { authenticateToken } from '../../../../../../packages/domain/auth';
import { DomainError } from '../../../../../../packages/domain/db';
import { body,cookie,error,guard,json,rateLimit } from '../../../../lib/http';

const input=z.object({handover_id:z.string().uuid(),acknowledged_digest:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export async function POST(req:Request){
 try{
  guard(req,true);
  const token=cookie(req,'denlumi_caregiver');
  if(!token)throw new DomainError('UNAUTHORIZED',401);
  const actor=await authenticateToken(token);rateLimit(`caregiver-ack:${actor.userId}`,30);
  const parsed=input.parse(await body(req));
  return json(await acknowledgeHandover(actor,parsed.handover_id,{acknowledged_digest:parsed.acknowledged_digest},req.headers.get('idempotency-key')??''));
 }catch(e){return error(e);}
}
