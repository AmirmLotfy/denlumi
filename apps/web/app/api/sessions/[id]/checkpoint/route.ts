import { checkpointSession } from '../../../../../../../packages/domain/sessions';
import { householdActor } from '../../../../../lib/household-http';
import { body,error,json } from '../../../../../lib/http';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){try{return json(await checkpointSession(await householdActor(req),(await ctx.params).id,await body(req)));}catch(e){return error(e);}}
