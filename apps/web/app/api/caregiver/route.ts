import { getBrief,listHouseholds } from '../../../../../packages/domain/state';
import { DomainError } from '../../../../../packages/domain/db';
import { error,json } from '../../../lib/http';
import { householdActor } from '../../../lib/household-http';
export async function GET(req:Request){try{
 const actor=await householdActor(req,false,'denlumi_caregiver'),homes=await listHouseholds(actor);
 if(!homes.length)throw new DomainError('SCOPE_MISMATCH',403);
 return json(await getBrief(actor,homes[0].id));
}catch(e){return error(e);}}
