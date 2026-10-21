import { createHousehold } from '../../../../../packages/domain/household';
import { householdActor,householdReadActor,requestKey } from '../../../lib/household-http';
import { getBrief } from '../../../../../packages/domain/state';
import { householdIndex } from '../../../../../packages/domain/coordination';
import { error,json,body } from '../../../lib/http';
export async function GET(req:Request) {
 try {const actor=await householdReadActor(req);const index=await householdIndex(actor);return json({...index,brief:index.households.length?await getBrief(actor,index.households[0].id).catch(e=>{if(['SCOPE_MISMATCH','PROTOCOL_UNAVAILABLE'].includes(e.code))return null;throw e;}):null});}catch(e){return error(e);}
}

export async function POST(req:Request) {
 try {const actor=await householdActor(req);return json(await createHousehold(actor,await body(req),requestKey(req)),201);}catch(e){return error(e);}
}
