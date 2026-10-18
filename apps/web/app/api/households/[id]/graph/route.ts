import { householdGraph } from '../../../../../../../packages/domain/household';
import { guard,identity,json,error } from '../../../../../lib/http';
export async function GET(req:Request,context:{params:Promise<{id:string}>}) {
 try {guard(req);const {actor}=await identity(req);return json(await householdGraph(actor,(await context.params).id));}catch(e){return error(e);}
}
