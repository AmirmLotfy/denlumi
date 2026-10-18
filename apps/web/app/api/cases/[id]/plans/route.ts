import { draftPlan } from '../../../../../../../packages/domain/planning';
import { householdActor,requestKey } from '../../../../../lib/household-http';
import { body,error,json } from '../../../../../lib/http';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){try{return json(await draftPlan(await householdActor(req),(await ctx.params).id,await body(req),requestKey(req)),201);}catch(e){return error(e);}}
