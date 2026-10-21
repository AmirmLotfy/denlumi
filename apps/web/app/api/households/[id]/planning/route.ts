import { planningWorkspace } from '../../../../../../../packages/domain/planning';
import { error,json } from '../../../../../lib/http';
import { householdReadActor } from '../../../../../lib/household-http';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){try{return json(await planningWorkspace(await householdReadActor(req),(await ctx.params).id));}catch(e){return error(e);}}
