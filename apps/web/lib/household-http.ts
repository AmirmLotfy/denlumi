import { authenticateToken } from '../../../packages/domain/auth';
import { DomainError,type Actor } from '../../../packages/domain/db';
import { cookie, guard, identity, rateLimit } from './http';
function requestBudget(req:Request,actor:Actor){
 const reading=req.method==='GET'||req.method==='HEAD';
 rateLimit(`household:${actor.userId}:${reading?'read':'write'}`,reading?120:30);
}
// Human-management operations require the app session cookie and same-origin request.
// They are intentionally absent from the model/MCP tool surface.
export async function householdActor(req:Request,requireOrigin=true,cookieName='denlumi_session') {
 guard(req,requireOrigin);
 const token=cookie(req,cookieName);if(!token)throw new DomainError('UNAUTHORIZED',401);
 const actor=await authenticateToken(token);
 // Current-record refreshes must not consume the consequential-write budget.
 requestBudget(req,actor);return actor;
}
// Existing read surfaces accept the app cookie first, then a bearer token.
// Some read surfaces additionally require that app cookie to be present.
export async function householdReadActor(req:Request,requireCookie=false){
 guard(req);
 if(requireCookie&&!cookie(req))throw new DomainError('UNAUTHORIZED',401);
 const {actor}=await identity(req);requestBudget(req,actor);return actor;
}
export const requestKey=(req:Request)=>req.headers.get('idempotency-key')??'';
