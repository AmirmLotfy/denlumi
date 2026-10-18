import { sessionHistory } from '../../../../../../packages/domain/sessions';
import { householdActor } from '../../../../lib/household-http';
import { error,json } from '../../../../lib/http';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){try{return json(await sessionHistory(await householdActor(req,false),(await ctx.params).id));}catch(e){return error(e);}}
