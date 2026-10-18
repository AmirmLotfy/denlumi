import { getBrief,listHouseholds } from '../../../../../packages/domain/state';
import { authenticateToken } from '../../../../../packages/domain/auth';
import { DomainError } from '../../../../../packages/domain/db';
import { guard,cookie,error,json } from '../../../lib/http';
export async function GET(req:Request){try{
 guard(req);const token=cookie(req,'denlumi_caregiver');if(!token)throw new DomainError('UNAUTHORIZED',401);
 const actor=await authenticateToken(token),homes=await listHouseholds(actor);
 if(!homes.length)throw new DomainError('SCOPE_MISMATCH',403);
 return json(await getBrief(actor,homes[0].id));
}catch(e){return error(e);}}
