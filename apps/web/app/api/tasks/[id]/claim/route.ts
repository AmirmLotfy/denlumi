import { claimTask } from '../../../../../../../packages/domain/routines';
import { householdActor,requestKey } from '../../../../../lib/household-http';
import { body,error,json } from '../../../../../lib/http';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){try{return json(await claimTask(await householdActor(req),(await ctx.params).id,await body(req),requestKey(req)));}catch(e){return error(e);}}
