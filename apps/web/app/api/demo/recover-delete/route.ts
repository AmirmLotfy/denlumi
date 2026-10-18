import { z } from 'zod';
import { recoverExpiredDemoDeletion } from '../../../../../../packages/domain/records';
import { body,error,guard,json,rateLimit } from '../../../../lib/http';

// Local fictional-demo deletion only. The code is a high-entropy possession
// credential; this route never signs in, restores guidance or exposes records.
export async function POST(req:Request){try{
 guard(req,true);rateLimit('demo-deletion-recovery',10);
 const input=z.object({code:z.string().min(1).max(100),confirm_deletion:z.literal(true)}).strict().parse(await body(req));
 return json(await recoverExpiredDemoDeletion(input.code),202);
}catch(e){return error(e);}}
