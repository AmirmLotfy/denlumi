import { updateRoutine } from '../../../../../../../../packages/domain/routines';
import { householdActor,requestKey } from '../../../../../../lib/household-http';
import { body,error,json } from '../../../../../../lib/http';
export async function PUT(req:Request,ctx:{params:Promise<{id:string;ruleId:string}>}){try{const p=await ctx.params;return json(await updateRoutine(await householdActor(req),p.id,p.ruleId,await body(req),requestKey(req)));}catch(e){return error(e);}}
