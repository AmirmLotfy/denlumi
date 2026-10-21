import { createRoutine,listRoutineRules } from '../../../../../../../packages/domain/routines';
import { householdActor,householdReadActor,requestKey } from '../../../../../lib/household-http';
import { body,error,json } from '../../../../../lib/http';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){try{return json(await listRoutineRules(await householdReadActor(req,true),(await ctx.params).id));}catch(e){return error(e);}}
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){try{return json(await createRoutine(await householdActor(req),(await ctx.params).id,await body(req),requestKey(req)),201);}catch(e){return error(e);}}
