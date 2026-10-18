import { generateOccurrences,listDueTasks } from '../../../../../../../packages/domain/routines';
import { householdActor,requestKey } from '../../../../../lib/household-http';
import { body,error,json } from '../../../../../lib/http';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){try{return json(await listDueTasks(await householdActor(req,false),(await ctx.params).id));}catch(e){return error(e);}}
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){try{return json(await generateOccurrences(await householdActor(req),(await ctx.params).id,await body(req),requestKey(req)));}catch(e){return error(e);}}
