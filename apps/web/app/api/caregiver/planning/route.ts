import { planningWorkspace } from '../../../../../../packages/domain/planning';
import { DomainError } from '../../../../../../packages/domain/db';
import { error,json } from '../../../../lib/http';
import { householdActor } from '../../../../lib/household-http';

export async function GET(req:Request){
 try{
  const actor=await householdActor(req,false,'denlumi_caregiver');
  const id=new URL(req.url).searchParams.get('household_id');
  if(!id)throw new DomainError('HOUSEHOLD_REQUIRED',400);
  return json(await planningWorkspace(actor,id));
 }catch(e){return error(e);}
}
