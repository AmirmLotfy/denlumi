import { planningWorkspace } from '../../../../../../packages/domain/planning';
import { authenticateToken } from '../../../../../../packages/domain/auth';
import { DomainError } from '../../../../../../packages/domain/db';
import { cookie,error,guard,json } from '../../../../lib/http';

export async function GET(req:Request){
 try{
  guard(req);
  const token=cookie(req,'denlumi_caregiver');
  if(!token)throw new DomainError('UNAUTHORIZED',401);
  const actor=await authenticateToken(token);
  const id=new URL(req.url).searchParams.get('household_id');
  if(!id)throw new DomainError('HOUSEHOLD_REQUIRED',400);
  return json(await planningWorkspace(actor,id));
 }catch(e){return error(e);}
}
