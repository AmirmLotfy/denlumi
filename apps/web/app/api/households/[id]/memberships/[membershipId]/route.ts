import { revokeMembership } from '../../../../../../../../packages/domain/household';
import { householdActor,requestKey } from '../../../../../../lib/household-http';
import { body,json,error } from '../../../../../../lib/http';
export async function DELETE(req:Request,context:{params:Promise<{id:string;membershipId:string}>}) {
 try {const actor=await householdActor(req),p=await context.params;return json(await revokeMembership(actor,p.id,p.membershipId,await body(req),requestKey(req)));}catch(e){return error(e);}
}
