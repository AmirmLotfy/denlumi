import { planningWorkspace } from '../../../../../../../packages/domain/planning';
import { error,guard,identity,json } from '../../../../../lib/http';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){try{guard(req);return json(await planningWorkspace((await identity(req)).actor,(await ctx.params).id));}catch(e){return error(e);}}
