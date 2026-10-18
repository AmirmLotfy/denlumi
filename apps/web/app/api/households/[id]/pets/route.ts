import { addPet } from '../../../../../../../packages/domain/household';
import { householdActor,requestKey } from '../../../../../lib/household-http';
import { body,json,error } from '../../../../../lib/http';
export async function POST(req:Request,context:{params:Promise<{id:string}>}) {
 try {const actor=await householdActor(req),p=await context.params;return json(await addPet(actor,p.id,await body(req),requestKey(req)));}catch(e){return error(e);}
}
