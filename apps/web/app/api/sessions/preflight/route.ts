import { sessionPreflight } from '../../../../../../packages/domain/sessions';
import { householdActor } from '../../../../lib/household-http';
import { body,error,json } from '../../../../lib/http';

// Explicit same-origin human read. MCP's prepare_session remains read-only and
// neither route can start or advance a session.
export async function POST(req:Request){
 try{return json(await sessionPreflight(await householdActor(req),await body(req)));}
 catch(e){return error(e);}
}
