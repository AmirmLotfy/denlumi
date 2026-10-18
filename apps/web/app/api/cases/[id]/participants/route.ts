import { addCaseParticipant } from '../../../../../../../packages/domain/household';
import { householdActor,requestKey } from '../../../../../lib/household-http';
import { body,json,error } from '../../../../../lib/http';
export async function POST(req:Request,context:{params:Promise<{id:string}>}) {
 try {const actor=await householdActor(req);return json(await addCaseParticipant(actor,(await context.params).id,await body(req),requestKey(req)));}catch(e){return error(e);}
}
