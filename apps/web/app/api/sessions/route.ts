import { startSession } from '../../../../../packages/domain/sessions';
import { householdActor,requestKey } from '../../../lib/household-http';
import { body,error,json } from '../../../lib/http';
export async function POST(req:Request){try{return json(await startSession(await householdActor(req),await body(req),requestKey(req)),201);}catch(e){return error(e);}}
