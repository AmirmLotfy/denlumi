import { householdGraph } from '../../../../../../../packages/domain/household';
import { json,error } from '../../../../../lib/http';
import { householdReadActor } from '../../../../../lib/household-http';
export async function GET(req:Request,context:{params:Promise<{id:string}>}) {
 try {const actor=await householdReadActor(req);return json(await householdGraph(actor,(await context.params).id));}catch(e){return error(e);}
}
