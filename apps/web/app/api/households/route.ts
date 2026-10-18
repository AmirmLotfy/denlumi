import { createHousehold } from '../../../../../packages/domain/household';
import { householdActor,requestKey } from '../../../lib/household-http';
import { listHouseholds,getBrief } from '../../../../../packages/domain/state';
import { guard,identity,error,json,body } from '../../../lib/http';
export async function GET(req:Request) {
 try {guard(req);const {actor}=await identity(req);const rows=await listHouseholds(actor);return json({households:rows,brief:rows.length?await getBrief(actor,rows[0].id).catch(e=>{if(['SCOPE_MISMATCH','PROTOCOL_UNAVAILABLE'].includes(e.code))return null;throw e;}):null});}catch(e){return error(e);}
}

export async function POST(req:Request) {
 try {const actor=await householdActor(req);return json(await createHousehold(actor,await body(req),requestKey(req)),201);}catch(e){return error(e);}
}
