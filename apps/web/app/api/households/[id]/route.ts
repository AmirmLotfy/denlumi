import { getBrief } from '../../../../../../packages/domain/state';
import { uuid } from '../../../../../../packages/contracts/phase0';
import { guard,identity,error,json } from '../../../../lib/http';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}) {
 try{guard(req);const {actor}=await identity(req);return json(await getBrief(actor,uuid.parse((await ctx.params).id)));}catch(e){return error(e);}
}
