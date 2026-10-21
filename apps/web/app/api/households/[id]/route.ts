import { getBrief } from '../../../../../../packages/domain/state';
import { uuid } from '../../../../../../packages/contracts/phase0';
import { error,json } from '../../../../lib/http';
import { householdReadActor } from '../../../../lib/household-http';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}) {
 try{const actor=await householdReadActor(req);return json(await getBrief(actor,uuid.parse((await ctx.params).id)));}catch(e){return error(e);}
}
