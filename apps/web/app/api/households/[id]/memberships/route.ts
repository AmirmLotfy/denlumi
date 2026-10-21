import { grantMembership } from '../../../../../../../packages/domain/household';
import { householdActor,householdReadActor,requestKey } from '../../../../../lib/household-http';
import { body,json,error } from '../../../../../lib/http';
import { householdMembers } from '../../../../../../../packages/domain/coordination';
export async function GET(req:Request,context:{params:Promise<{id:string}>}){
 try{const actor=await householdReadActor(req);return json(await householdMembers(actor,(await context.params).id));}catch(e){return error(e);}
}
export async function POST(req:Request,context:{params:Promise<{id:string}>}) {
 try {const actor=await householdActor(req),p=await context.params;return json(await grantMembership(actor,p.id,await body(req),requestKey(req)));}catch(e){return error(e);}
}
